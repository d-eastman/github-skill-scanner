/**
 * SKILL.md path matching and skillName derivation.
 *
 * Pure functions — no I/O. Implements ADR-001 layout rules L1–L3.
 *
 * Layout rules (from ADR-001):
 *   L1: SKILL.md                     → skillName = repo name
 *   L2: <skill>/SKILL.md             → skillName = first path segment
 *   L3: skills/<skill>/SKILL.md      → skillName = second path segment
 *
 * Anything that doesn't match one of these three shapes returns null.
 * This is intentional — we do not match SKILL.md buried four levels deep.
 */

const SKILL_FILENAME = "SKILL.md";

export type LayoutMatch = {
  skillName: string;
  layout: "L1" | "L2" | "L3";
};

/**
 * Match a repo-relative file path against the three conventional SKILL.md layouts.
 *
 * @param filePath - repo-relative path (e.g. "frontend-design/SKILL.md")
 * @param repoName - the repo name (used as skillName for L1 matches)
 * @returns LayoutMatch if the path matches a layout, null otherwise
 */
export function matchSkillPath(
  filePath: string,
  repoName: string
): LayoutMatch | null {
  // Normalise: strip any leading slash, collapse any double slashes.
  const normalised = filePath.replace(/^\//, "").replace(/\/\//g, "/");
  const segments = normalised.split("/");

  // Reject paths with empty segments (catches root-only slash, trailing slash, etc.)
  if (segments.some((s) => s === "")) {
    return null;
  }

  const filename = segments[segments.length - 1];
  if (filename !== SKILL_FILENAME) {
    return null;
  }

  // L1: exactly one segment and it is SKILL.md
  if (segments.length === 1) {
    return { skillName: repoName, layout: "L1" };
  }

  // L2: exactly two segments — <skill>/SKILL.md
  if (segments.length === 2) {
    const skillName = segments[0];
    return { skillName, layout: "L2" };
  }

  // L3: exactly three segments — skills/<skill>/SKILL.md
  // The first segment must be literally "skills"
  if (segments.length === 3 && segments[0] === "skills") {
    const skillName = segments[1];
    return { skillName, layout: "L3" };
  }

  // Anything else (four or more segments, or three segments where the prefix isn't "skills")
  return null;
}

/**
 * Convenience: return the skillName if the path matches, or null.
 */
export function deriveSkillName(filePath: string, repoName: string): string | null {
  const match = matchSkillPath(filePath, repoName);
  return match ? match.skillName : null;
}
