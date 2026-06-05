/**
 * SKILL.md YAML frontmatter extraction.
 *
 * Uses gray-matter for robust frontmatter parsing. Never throws — malformed or
 * absent frontmatter yields null fields with a logged warning.
 *
 * See: docs/dev-team/adr-002 (must-have #3 — tolerant parsing)
 */

import matter from "gray-matter";

export interface ParsedFrontmatter {
  name: string | null;
  description: string | null;
}

/**
 * SEC-001: Disable gray-matter's built-in JavaScript engines.
 *
 * gray-matter supports `---js` and `---javascript` frontmatter delimiters that
 * invoke eval() on the frontmatter block. A crafted SKILL.md from any scanned
 * repo could execute arbitrary code on the Actions runner with access to SCAN_PAT.
 *
 * Replacing both engine parsers with functions that throw causes gray-matter to
 * treat `---js` blocks as malformed frontmatter. The existing try/catch in
 * parseFrontmatter handles the thrown error and returns null fields — the same
 * documented behavior as any other malformed input. Only YAML frontmatter is
 * intentionally supported.
 *
 * Note: passing `language: 'yaml'` does NOT mitigate because gray-matter ignores
 * it when a delimiter language is explicitly present in the file. Engine override
 * is the correct control.
 */
/**
 * Gray-matter engine parse functions must match `(input: string) => object`.
 * These implementations always throw, so they never return — but the signature
 * must satisfy the type. The `never` return type is assignable to `object`.
 */
function disabledJsEngine(_input: string): never {
  throw new Error("JavaScript engine disabled for security");
}

const SAFE_MATTER_OPTIONS = {
  engines: {
    javascript: { parse: disabledJsEngine },
    js: { parse: disabledJsEngine },
  },
};

/**
 * Parse YAML frontmatter from raw SKILL.md content.
 *
 * Extracts `name` and `description` from the frontmatter block.
 * Both fields are coerced to strings; non-string values (numbers, booleans, etc.)
 * are converted via String(). Missing or null values remain null.
 *
 * JavaScript frontmatter (`---js`) is explicitly disabled — see SAFE_MATTER_OPTIONS.
 *
 * @param content - raw file content string
 * @param filePath - path for logging context
 * @returns { name, description } — either may be null
 */
export function parseFrontmatter(
  content: string,
  filePath: string
): ParsedFrontmatter {
  let data: Record<string, unknown> = {};

  try {
    const parsed = matter(content, SAFE_MATTER_OPTIONS);
    data = parsed.data as Record<string, unknown>;
  } catch (err) {
    console.warn(
      `[scanner] Malformed frontmatter in ${filePath} — name and description will be null. ` +
        `Error: ${err instanceof Error ? err.message : String(err)}`
    );
    return { name: null, description: null };
  }

  const name = coerceToString(data["name"], filePath, "name");
  const description = coerceToString(data["description"], filePath, "description");

  return { name, description };
}

function coerceToString(
  value: unknown,
  filePath: string,
  field: string
): string | null {
  if (value === undefined || value === null) {
    console.warn(
      `[scanner] Missing frontmatter field "${field}" in ${filePath} — will be null`
    );
    return null;
  }
  if (typeof value === "string") {
    return value.trim() === "" ? null : value.trim();
  }
  // Non-string value (number, boolean, array, etc.) — coerce and warn
  console.warn(
    `[scanner] Frontmatter field "${field}" in ${filePath} is not a string (got ${typeof value}) — coercing`
  );
  return String(value);
}
