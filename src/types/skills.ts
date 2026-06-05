/**
 * Shared TypeScript types for the ADR-002 data contract.
 *
 * Both the scanner (src/scan/) and the frontend (src/fe/) import from this module.
 * This file is the single source of truth for the skills.json schema.
 * Any field change here is a type error in one or both halves — that is the point.
 *
 * Schema version: 1 (bump schemaVersion in SkillsMetadata on any breaking change).
 * See: docs/dev-team/adr-002-data-schema-output-contract.md
 */

/**
 * A single skill extracted from a SKILL.md file in a configured repository.
 *
 * - `name` and `description` come from YAML frontmatter and may be null when
 *   the frontmatter is missing or malformed.
 * - `skillName` is always present — derived from the directory containing the SKILL.md
 *   (or the repo name for a root-level SKILL.md). This is the --skill value in the
 *   install command.
 * - `skillName` is not globally unique: two repos may both have a skill named "pdf".
 *   Key list items on `repo + '/' + path`, not on `skillName` alone.
 */
export interface SkillEntry {
  name: string | null;
  description: string | null;
  skillName: string;
  repo: string;
  repoUrl: string;
  path: string;
}

/**
 * Metadata written by the scanner at the top of every skills.json.
 * These fields are the Tier A health metrics from success-metrics.md.
 */
export interface SkillsMetadata {
  schemaVersion: number;
  lastScanned: string;
  repoCount: number;
  reposSucceeded: number;
  reposFailed: number;
  skillCount: number;
}

/**
 * The full envelope written to data/skills.json.
 * Frontend reads `catalog.skills` and `catalog.metadata`.
 * `skills` is always an array — never absent, never null.
 */
export interface SkillsCatalog {
  metadata: SkillsMetadata;
  skills: SkillEntry[];
}
