/**
 * Fetch size limits for the scanner (SEC-003 / TD-008).
 *
 * A maliciously large SKILL.md in a scanned repo could exhaust the Actions
 * runner's memory if buffered unbounded. We cap raw content at a generous
 * ceiling — a SKILL.md frontmatter file is realistically a few KB.
 *
 * The primary guard is the Content-Length header (raw.githubusercontent.com
 * reliably sends it for files), checked BEFORE the body is read. The actual
 * byte length is re-checked after reading as a belt-and-suspenders against a
 * missing or understated header.
 */

/** Maximum accepted SKILL.md size, in bytes (1 MB). */
export const MAX_CONTENT_BYTES = 1024 * 1024;

/**
 * Returns true if the declared Content-Length exceeds the limit.
 * A missing or unparseable header returns false (unknown size — defer to the
 * post-read byte-length check in the caller).
 */
export function exceedsSizeLimit(
  contentLengthHeader: string | null,
  maxBytes: number = MAX_CONTENT_BYTES
): boolean {
  if (contentLengthHeader === null) return false;
  const declared = Number.parseInt(contentLengthHeader, 10);
  if (Number.isNaN(declared)) return false;
  return declared > maxBytes;
}
