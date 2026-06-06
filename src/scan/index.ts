/**
 * Scanner entry point — `npm run scan`
 *
 * Implements the per-repo algorithm from ADR-001:
 * 1. Read repos.json config
 * 2. For each repo:
 *    a. GET <apiBase>/repos/{owner}/{repo} → default_branch (fail soft on 403/404)
 *    b. GET <apiBase>/repos/{owner}/{repo}/git/trees/{branch}?recursive=1 → tree
 *    c. Log warning if truncated
 *    d. Filter blobs for SKILL.md paths matching L1/L2/L3 layouts
 *    e. Fetch file content via Contents API; parse frontmatter; build SkillEntry
 * 3. Assemble and write the ADR-002 envelope to data/skills.json
 * 4. Exit 0 on success; exit 1 only if ALL repos failed
 *
 * Host parameterization: each repos.json entry carries a `host` bare hostname.
 * All API URLs (repo info, git trees, contents) are derived from that host via
 * src/scan/host.ts (ADR-006 Decisions 1 and 2). Token selection is per-request
 * in src/scan/client.ts (ADR-006 Decision 4-PAT).
 *
 * Raw content is fetched via the Contents API (ADR-006 Decision 3). The Contents
 * API is on the same api/v3 base as every other call, so the per-host token
 * routing covers content fetches too. This also means content works on GHES
 * where a separate raw content domain does not exist.
 * Note: Contents API calls count against the core REST rate limit.
 *
 * Missing token → warning + proceed without auth (existing fail-soft behavior).
 */

import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { githubFetch } from "./client.js";
import { matchSkillPath } from "./layout.js";
import { parseFrontmatter } from "./parser.js";
import { writeCatalog } from "./writer.js";
import { MAX_CONTENT_BYTES, exceedsSizeLimit } from "./limits.js";
import {
  repoUrl as deriveRepoUrl,
  repoInfoUrl as deriveRepoInfoUrl,
  treeUrl as deriveTreeUrl,
  contentsUrl as deriveContentsUrl,
} from "./host.js";
import type { SkillEntry, ScannedRepo } from "../types/skills.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

/**
 * Config shape for a single repo entry in repos.json.
 *
 * `host` is a required bare hostname (e.g. "github.com" or "github.example.com").
 * No scheme, no /api/v3, no trailing slash. The scanner derives all URLs from it.
 *
 * Missing or empty `host` causes loadReposConfig to throw immediately (fail fast)
 * because a missing host would produce https://undefined/api/v3 URLs that fail
 * silently — the worst failure mode for this scanner (looks green, returns nothing).
 */
export interface RepoConfig {
  host: string;
  owner: string;
  repo: string;
}

interface GitTreeEntry {
  path: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  url: string;
}

interface GitTreeResponse {
  tree: GitTreeEntry[];
  truncated: boolean;
}

interface RepoInfoResponse {
  default_branch: string;
}

/**
 * Validates a raw config array parsed from repos.json.
 * Throws if any entry is missing a required `host` field or has an empty host.
 * Pure function — no IO, safe to unit-test directly.
 */
export function validateReposConfig(configs: RepoConfig[]): void {
  for (let i = 0; i < configs.length; i++) {
    const entry = configs[i];
    if (typeof entry.host !== "string" || entry.host.trim() === "") {
      throw new Error(
        `[scanner] repos.json entry ${i} is missing a required "host" field. ` +
          'Each entry must have a bare hostname (e.g. "github.com" or "github.example.com"). ' +
          "A missing host cannot be defaulted safely — it would produce malformed API URLs."
      );
    }
  }
}

export function loadReposConfig(): RepoConfig[] {
  const configPath = path.join(__dirname, "repos.json");
  const configs = require(configPath) as RepoConfig[];
  if (!Array.isArray(configs) || configs.length === 0) {
    throw new Error(`[scanner] repos.json is empty or not an array at ${configPath}`);
  }
  validateReposConfig(configs);
  return configs;
}

async function getDefaultBranch(
  host: string,
  owner: string,
  repo: string
): Promise<string | null> {
  const url = deriveRepoInfoUrl(host, owner, repo);
  let response: Response;
  try {
    response = await githubFetch(url);
  } catch (err) {
    console.error(`[scanner] Network error fetching repo info for ${owner}/${repo}: ${err}`);
    return null;
  }

  if (!response.ok) {
    console.error(
      `[scanner] Failed to fetch repo info for ${owner}/${repo}: HTTP ${response.status}`
    );
    return null;
  }

  const data = (await response.json()) as RepoInfoResponse;
  return data.default_branch;
}

async function getRepoTree(
  host: string,
  owner: string,
  repo: string,
  branch: string
): Promise<GitTreeResponse | null> {
  const url = deriveTreeUrl(host, owner, repo, branch);
  let response: Response;
  try {
    response = await githubFetch(url);
  } catch (err) {
    console.error(`[scanner] Network error fetching tree for ${owner}/${repo}: ${err}`);
    return null;
  }

  if (!response.ok) {
    console.error(
      `[scanner] Failed to fetch tree for ${owner}/${repo}: HTTP ${response.status}`
    );
    return null;
  }

  return (await response.json()) as GitTreeResponse;
}

/**
 * Fetches file content via the GitHub Contents API (ADR-006 Decision 3).
 *
 * Uses the Contents API endpoint on the same api/v3 base as every other call,
 * routed through githubFetch so per-host token selection applies (GHE-4).
 * The previous approach used a separate content-serving domain that is not
 * available on GHES and had no authentication. The Contents API resolves both.
 *
 * Two response paths:
 * 1. Accept: application/vnd.github.raw → raw bytes; use response.text() directly.
 * 2. Fallback: default JSON envelope with base64-encoded `content` field.
 *    Decode with Buffer.from(content, "base64") after stripping GitHub's \n padding.
 *
 * Size guards from limits.ts are preserved (SEC-003 / TD-008):
 * - Pre-read: Content-Length header check before body is read.
 * - Post-read: Buffer.byteLength check after decode as belt-and-suspenders.
 *   For the JSON/base64 path, Content-Length describes the JSON envelope (not the
 *   decoded file), so the pre-read check may not fire — the post-read check is
 *   the effective guard for that path.
 *
 * Note: Contents API calls count against the core REST rate limit (5000 req/hr
 * authenticated). At under-20-repo scale this is negligible vs. the 5000/hr budget.
 * The rate-limit headers are logged by githubFetch as for all other calls.
 */
export async function fetchRawContent(
  host: string,
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): Promise<string | null> {
  const url = deriveContentsUrl(host, owner, repo, filePath, branch);
  let response: Response;
  try {
    response = await githubFetch(url);
  } catch (err) {
    console.error(`[scanner] Network error fetching content ${url}: ${err}`);
    return null;
  }

  if (!response.ok) {
    console.error(`[scanner] Failed to fetch content ${url}: HTTP ${response.status}`);
    return null;
  }

  // Pre-read size guard (SEC-003 / TD-008): check declared Content-Length before
  // reading the body. For the raw media type path this reflects the file size;
  // for the JSON path it reflects the envelope size (the post-read check handles
  // the decoded size in that branch).
  if (exceedsSizeLimit(response.headers.get("content-length"))) {
    console.warn(
      `[scanner] Skipping ${url}: declared size exceeds ${MAX_CONTENT_BYTES} byte limit`
    );
    return null;
  }

  // Determine response type: if Content-Type is application/json (or starts with it),
  // this is the base64-JSON envelope — decode it. Otherwise treat as raw text.
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.startsWith("application/json")) {
    // Base64 fallback path (ADR-006 Decision 3 note — for GHES instances that do not
    // honor Accept: application/vnd.github.raw).
    interface ContentsApiResponse {
      content?: string;
      encoding?: string;
    }
    const json = (await response.json()) as ContentsApiResponse;
    if (
      json.encoding === "base64" &&
      typeof json.content === "string"
    ) {
      // GitHub pads base64 content with \n line breaks — strip before decoding.
      const decoded = Buffer.from(json.content.replace(/\n/g, ""), "base64").toString("utf8");
      // Post-read byte-length guard on the decoded content (SEC-003 / TD-008).
      if (Buffer.byteLength(decoded, "utf8") > MAX_CONTENT_BYTES) {
        console.warn(
          `[scanner] Skipping ${url}: decoded content exceeds ${MAX_CONTENT_BYTES} byte limit`
        );
        return null;
      }
      return decoded;
    }
    // Unexpected JSON shape — emit a warning and skip (fail-soft per ADR-001).
    console.warn(`[scanner] Unexpected Contents API response shape for ${url} — skipping`);
    return null;
  }

  // Raw text path (preferred — when Accept: application/vnd.github.raw is honored).
  const text = await response.text();
  // Post-read byte-length guard (belt-and-suspenders, SEC-003 / TD-008).
  if (Buffer.byteLength(text, "utf8") > MAX_CONTENT_BYTES) {
    console.warn(
      `[scanner] Skipping ${url}: content exceeds ${MAX_CONTENT_BYTES} byte limit`
    );
    return null;
  }
  return text;
}

export async function scanRepo(config: RepoConfig): Promise<{
  skills: SkillEntry[];
  succeeded: boolean;
  repoUrl: string;
}> {
  const { host, owner, repo } = config;
  const repoSlug = `${owner}/${repo}`;
  // repoUrl is derived from the host — the browser-navigable URL, no /api/v3 (ADR-006 Decision 2).
  const repoUrlValue = deriveRepoUrl(host, owner, repo);

  console.log(`[scanner] Scanning ${repoSlug}...`);

  // Step 1: get default branch
  const branch = await getDefaultBranch(host, owner, repo);
  if (!branch) {
    console.error(`[scanner] Skipping ${repoSlug} — could not determine default branch`);
    return { skills: [], succeeded: false, repoUrl: repoUrlValue };
  }

  // Step 2: get recursive tree
  const tree = await getRepoTree(host, owner, repo, branch);
  if (!tree) {
    console.error(`[scanner] Skipping ${repoSlug} — could not fetch git tree`);
    return { skills: [], succeeded: false, repoUrl: repoUrlValue };
  }

  if (tree.truncated) {
    console.warn(
      `[scanner] WARNING: tree for ${repoSlug} is truncated. Some SKILL.md files may be missed.`
    );
  }

  // Step 3: filter blobs whose basename is SKILL.md
  const skillBlobs = tree.tree.filter(
    (entry) =>
      entry.type === "blob" && entry.path.split("/").pop() === "SKILL.md"
  );

  if (skillBlobs.length === 0) {
    console.warn(`[scanner] No SKILL.md files found in ${repoSlug}`);
    return { skills: [], succeeded: true, repoUrl: repoUrlValue };
  }

  // Step 4: apply layout matching and build skill entries
  const skills: SkillEntry[] = [];
  const seenPaths = new Set<string>();

  for (const blob of skillBlobs) {
    // Dedupe by path (ADR-001: dedupe by resolved path)
    if (seenPaths.has(blob.path)) {
      continue;
    }
    seenPaths.add(blob.path);

    const layoutMatch = matchSkillPath(blob.path, repo);
    if (!layoutMatch) {
      // Path doesn't match any of L1/L2/L3 — intentionally ignored
      console.log(`[scanner] Skipping non-conventional path: ${repoSlug}/${blob.path}`);
      continue;
    }

    // Step 5: fetch content via Contents API (ADR-006 Decision 3)
    const content = await fetchRawContent(host, owner, repo, branch, blob.path);
    if (!content) {
      // Emit entry with null fields rather than skipping (ADR-002 tolerance rule)
      console.warn(
        `[scanner] Could not fetch content for ${repoSlug}/${blob.path} — emitting with null fields`
      );
      skills.push({
        name: null,
        description: null,
        skillName: layoutMatch.skillName,
        repo: repoSlug,
        repoUrl: repoUrlValue,
        path: blob.path,
      });
      continue;
    }

    // Step 6: parse frontmatter
    const { name, description } = parseFrontmatter(content, `${repoSlug}/${blob.path}`);

    skills.push({
      name,
      description,
      skillName: layoutMatch.skillName,
      repo: repoSlug,
      repoUrl: repoUrlValue,
      path: blob.path,
    });

    console.log(
      `[scanner] Found skill: ${layoutMatch.skillName} (${layoutMatch.layout}) in ${repoSlug}`
    );
  }

  return { skills, succeeded: true, repoUrl: repoUrlValue };
}

async function main(): Promise<void> {
  console.log("[scanner] Starting GitHub Skill Scanner...");

  const repos = loadReposConfig();
  console.log(`[scanner] Scanning ${repos.length} repo(s)...`);

  const allSkills: SkillEntry[] = [];
  const allRepos: ScannedRepo[] = [];
  let reposSucceeded = 0;
  let reposFailed = 0;

  for (const repoConfig of repos) {
    const { skills, succeeded, repoUrl } = await scanRepo(repoConfig);
    const repoSlug = `${repoConfig.owner}/${repoConfig.repo}`;
    if (succeeded) {
      reposSucceeded++;
      allSkills.push(...skills);
      allRepos.push({
        repo: repoSlug,
        repoUrl,
        skillCount: skills.length,
        status: "succeeded",
      });
    } else {
      reposFailed++;
      allRepos.push({
        repo: repoSlug,
        repoUrl,
        skillCount: 0,
        status: "failed",
      });
    }
  }

  writeCatalog({
    skills: allSkills,
    repos: allRepos,
    repoCount: repos.length,
    reposSucceeded,
    reposFailed,
  });

  // Exit non-zero only if ALL repos failed (ADR-001, must-have #2)
  if (reposFailed > 0 && reposSucceeded === 0) {
    console.error("[scanner] All repos failed. Exiting with error.");
    process.exit(1);
  }

  if (reposFailed > 0) {
    console.warn(
      `[scanner] ${reposFailed}/${repos.length} repos failed. Partial results written.`
    );
  }

  console.log("[scanner] Done.");
}

// Only execute main() when this file is run directly (not imported by tests).
// import.meta.url is the file:// URL of this module; process.argv[1] is the
// entry point path. Comparing them prevents main() from running on import.
if (process.argv[1] === __filename) {
  main().catch((err) => {
    console.error("[scanner] Fatal error:", err);
    process.exit(1);
  });
}
