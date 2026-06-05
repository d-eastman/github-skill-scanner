/**
 * JSON envelope assembly and file write.
 *
 * Assembles the SkillsCatalog envelope (ADR-002) and writes data/skills.json.
 * Sorts skills by repo then skillName for stable git diffs (ADR-002).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { SkillEntry, SkillsCatalog } from "../types/skills.js";

// Resolve the repo root regardless of cwd
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../");
const DATA_DIR = path.join(REPO_ROOT, "data");
const OUTPUT_PATH = path.join(DATA_DIR, "skills.json");

export interface ScanResult {
  skills: SkillEntry[];
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
 * Write the SkillsCatalog envelope to data/skills.json.
 * Creates the data/ directory if it doesn't exist.
 * Never writes an absent file — zero skills → valid empty envelope.
 */
export function writeCatalog(result: ScanResult): void {
  const sortedSkills = [...result.skills].sort(compareSkills);

  const catalog: SkillsCatalog = {
    metadata: {
      schemaVersion: 1,
      lastScanned: new Date().toISOString(),
      repoCount: result.repoCount,
      reposSucceeded: result.reposSucceeded,
      reposFailed: result.reposFailed,
      skillCount: sortedSkills.length,
    },
    skills: sortedSkills,
  };

  // Invariant: skillCount must match skills.length
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
