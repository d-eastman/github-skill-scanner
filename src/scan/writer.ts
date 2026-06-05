/**
 * JSON envelope assembly and file write.
 *
 * Assembles the SkillsCatalog envelope (ADR-002) and writes data/skills.json.
 * Sorts skills by repo then skillName for stable git diffs (ADR-002).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { SkillEntry, SkillsCatalog, ScannedRepo } from "../types/skills.js";

// Resolve the repo root regardless of cwd
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../");
const DATA_DIR = path.join(REPO_ROOT, "data");
const OUTPUT_PATH = path.join(DATA_DIR, "skills.json");

export interface ScanResult {
  skills: SkillEntry[];
  repos: ScannedRepo[];
  repoCount: number;
  reposSucceeded: number;
  reposFailed: number;
}

/**
 * Sort comparator: by repo ascending, then by skillName ascending.
 * Case-sensitive sort (consistent with how JS default sort works on strings).
 */
function compareSkills(a: SkillEntry, b: SkillEntry): number {
  if (a.repo < b.repo) return -1;
  if (a.repo > b.repo) return 1;
  if (a.skillName < b.skillName) return -1;
  if (a.skillName > b.skillName) return 1;
  return 0;
}

/**
 * Sort comparator for ScannedRepo: by repo ascending.
 * Stable git diffs even when config order changes.
 */
function compareRepos(a: ScannedRepo, b: ScannedRepo): number {
  if (a.repo < b.repo) return -1;
  if (a.repo > b.repo) return 1;
  return 0;
}

/**
 * Write the SkillsCatalog envelope to data/skills.json.
 * Creates the data/ directory if it doesn't exist.
 * Never writes an absent file — zero skills → valid empty envelope.
 *
 * ADR-002 addendum invariants enforced here (violations are bugs; throw):
 *   1. repos.length === repoCount
 *   2. sum(skillCount) === skillCount === skills.length
 *   3. status === "failed" implies skillCount === 0
 *   4. count(succeeded) === reposSucceeded; count(failed) === reposFailed
 */
export function writeCatalog(result: ScanResult): void {
  const sortedSkills = [...result.skills].sort(compareSkills);
  const sortedRepos = [...result.repos].sort(compareRepos);

  // --- Invariant checks (violations are bugs, not data issues) ---

  // Invariant 1: repos.length === repoCount
  if (sortedRepos.length !== result.repoCount) {
    throw new Error(
      `[scanner] Bug: repos.length (${sortedRepos.length}) !== repoCount (${result.repoCount})`
    );
  }

  // Invariant 3: failed entries must have skillCount === 0
  // Coerce to enforce the invariant (a caller passing skillCount > 0 for a failed repo is a bug)
  for (const r of sortedRepos) {
    if (r.status === "failed" && r.skillCount !== 0) {
      throw new Error(
        `[scanner] Bug: repo "${r.repo}" has status "failed" but skillCount ${r.skillCount} (must be 0)`
      );
    }
  }

  // Invariant 2: sum(skillCount) === skills.length
  const sumSkillCount = sortedRepos.reduce((acc, r) => acc + r.skillCount, 0);
  if (sumSkillCount !== sortedSkills.length) {
    throw new Error(
      `[scanner] Bug: sum(repos[].skillCount) (${sumSkillCount}) !== skills.length (${sortedSkills.length})`
    );
  }

  // Invariant 4: derived counts must match provided counts
  const succeededCount = sortedRepos.filter((r) => r.status === "succeeded").length;
  const failedCount = sortedRepos.filter((r) => r.status === "failed").length;
  if (succeededCount !== result.reposSucceeded) {
    throw new Error(
      `[scanner] Bug: count(succeeded) (${succeededCount}) !== reposSucceeded (${result.reposSucceeded})`
    );
  }
  if (failedCount !== result.reposFailed) {
    throw new Error(
      `[scanner] Bug: count(failed) (${failedCount}) !== reposFailed (${result.reposFailed})`
    );
  }

  const catalog: SkillsCatalog = {
    metadata: {
      schemaVersion: 1,
      lastScanned: new Date().toISOString(),
      repoCount: result.repoCount,
      reposSucceeded: result.reposSucceeded,
      reposFailed: result.reposFailed,
      skillCount: sortedSkills.length,
      repos: sortedRepos,
    },
    skills: sortedSkills,
  };

  // Invariant: skillCount must match skills.length (final check)
  if (catalog.metadata.skillCount !== catalog.skills.length) {
    throw new Error(
      `[scanner] Bug: skillCount (${catalog.metadata.skillCount}) !== skills.length (${catalog.skills.length})`
    );
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf-8");

  console.log(
    `[scanner] Wrote ${catalog.metadata.skillCount} skills to ${OUTPUT_PATH} ` +
      `(${result.reposSucceeded}/${result.repoCount} repos succeeded)`
  );
}
