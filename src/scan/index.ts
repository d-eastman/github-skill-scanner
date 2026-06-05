/**
 * Scanner entry point — `npm run scan`
 *
 * Implements the per-repo algorithm from ADR-001:
 * 1. Read repos.json config
 * 2. For each repo:
 *    a. GET /repos/{owner}/{repo} → default_branch (fail soft on 403/404)
 *    b. GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1 → tree
 *    c. Log warning if truncated
 *    d. Filter blobs for SKILL.md paths matching L1/L2/L3 layouts
 *    e. Fetch raw content; parse frontmatter; build SkillEntry
 * 3. Assemble and write the ADR-002 envelope to data/skills.json
 * 4. Exit 0 on success; exit 1 only if ALL repos failed
 *
 * Authentication: reads GITHUB_TOKEN from process.env (never hardcoded).
 * Missing token → warning + proceed without auth (dev mode).
 */

import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { githubFetch } from "./client.js";
import { matchSkillPath } from "./layout.js";
import { parseFrontmatter } from "./parser.js";
import { writeCatalog } from "./writer.js";
import { MAX_CONTENT_BYTES, exceedsSizeLimit } from "./limits.js";
import type { SkillEntry, ScannedRepo } from "../types/skills.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

interface RepoConfig {
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

function loadReposConfig(): RepoConfig[] {
  const configPath = path.join(__dirname, "repos.json");
  const configs = require(configPath) as RepoConfig[];
  if (!Array.isArray(configs) || configs.length === 0) {
    throw new Error(`[scanner] repos.json is empty or not an array at ${configPath}`);
  }
  return configs;
}

async function getDefaultBranch(
  owner: string,
  repo: string
): Promise<string | null> {
  const url = `/repos/${owner}/${repo}`;
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
  owner: string,
  repo: string,
  branch: string
): Promise<GitTreeResponse | null> {
  const url = `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
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

async function fetchRawContent(
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): Promise<string | null> {
  // Raw content fetches use raw.githubusercontent.com — does not count against core API rate limit.
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    console.error(`[scanner] Network error fetching raw content ${url}: ${err}`);
    return null;
  }

  if (!response.ok) {
    console.error(`[scanner] Failed to fetch raw content ${url}: HTTP ${response.status}`);
    return null;
  }

  // SEC-003 / TD-008: reject oversized files before/after reading to avoid
  // unbounded memory use on the runner. Primary guard is the declared length.
  if (exceedsSizeLimit(response.headers.get("content-length"))) {
    console.warn(
      `[scanner] Skipping ${url}: declared size exceeds ${MAX_CONTENT_BYTES} byte limit`
    );
    return null;
  }

  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_CONTENT_BYTES) {
    console.warn(
      `[scanner] Skipping ${url}: content exceeds ${MAX_CONTENT_BYTES} byte limit`
    );
    return null;
  }
  return text;
}

async function scanRepo(config: RepoConfig): Promise<{
  skills: SkillEntry[];
  succeeded: boolean;
  repoUrl: string;
}> {
  const { owner, repo } = config;
  const repoSlug = `${owner}/${repo}`;
  const repoUrl = `https://github.com/${owner}/${repo}`;

  console.log(`[scanner] Scanning ${repoSlug}...`);

  // Step 1: get default branch
  const branch = await getDefaultBranch(owner, repo);
  if (!branch) {
    console.error(`[scanner] Skipping ${repoSlug} — could not determine default branch`);
    return { skills: [], succeeded: false, repoUrl };
  }

  // Step 2: get recursive tree
  const tree = await getRepoTree(owner, repo, branch);
  if (!tree) {
    console.error(`[scanner] Skipping ${repoSlug} — could not fetch git tree`);
    return { skills: [], succeeded: false, repoUrl };
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
    return { skills: [], succeeded: true, repoUrl };
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

    // Step 5: fetch raw content
    const content = await fetchRawContent(owner, repo, branch, blob.path);
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
        repoUrl,
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
      repoUrl,
      path: blob.path,
    });

    console.log(
      `[scanner] Found skill: ${layoutMatch.skillName} (${layoutMatch.layout}) in ${repoSlug}`
    );
  }

  return { skills, succeeded: true, repoUrl };
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

main().catch((err) => {
  console.error("[scanner] Fatal error:", err);
  process.exit(1);
});
