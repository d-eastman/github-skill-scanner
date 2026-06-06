/**
 * Host-to-URL derivation helpers — ADR-006 Decision 2.
 *
 * All URL construction for the scanner is derived from a single `host` string
 * (a bare hostname, no scheme, no trailing slash).
 *
 * github.com is special-cased with an exact equality check because github.com
 * splits API and raw content across separate subdomains (api.github.com), while
 * every GHES host serves the REST API at https://<host>/api/v3. The check is
 * host === "github.com" — a whitelist, never a substring match (TC-227).
 *
 * Pure functions — no side effects, no env reads, no network. Safe to unit-test
 * directly.
 */

/**
 * Returns the REST API base URL for the given host.
 * - github.com → https://api.github.com
 * - any other host → https://<host>/api/v3
 *
 * The returned value has no trailing slash.
 */
export function apiBase(host: string): string {
  if (host === "github.com") {
    return "https://api.github.com";
  }
  return `https://${host}/api/v3`;
}

/**
 * Returns the browser-navigable repository URL.
 * - github.com → https://github.com/<owner>/<repo>
 * - any other host → https://<host>/<owner>/<repo>
 *
 * No trailing slash (ADR-002 invariant).
 * No /api/v3 segment — this is the browsable URL, not the API URL.
 */
export function repoUrl(host: string, owner: string, repo: string): string {
  return `https://${host}/${owner}/${repo}`;
}

/**
 * Returns the Contents API URL for a given file path.
 * Both github.com and GHES use the same /repos/.../contents/... path shape;
 * only the base URL differs.
 *
 * https://<apiBase>/repos/<owner>/<repo>/contents/<path>?ref=<branch>
 */
export function contentsUrl(
  host: string,
  owner: string,
  repo: string,
  filePath: string,
  branch: string
): string {
  const base = apiBase(host);
  return `${base}/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
}

/**
 * Returns the repo info URL used to fetch the default branch.
 * https://<apiBase>/repos/<owner>/<repo>
 */
export function repoInfoUrl(host: string, owner: string, repo: string): string {
  const base = apiBase(host);
  return `${base}/repos/${owner}/${repo}`;
}

/**
 * Returns the Git Trees URL for recursive tree fetching.
 * https://<apiBase>/repos/<owner>/<repo>/git/trees/<branch>?recursive=1
 */
export function treeUrl(
  host: string,
  owner: string,
  repo: string,
  branch: string
): string {
  const base = apiBase(host);
  return `${base}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
}
