/**
 * GitHub API client — authenticated fetch wrapper.
 *
 * ADR-001 / ADR-006 implementation notes:
 * - Token is selected PER REQUEST based on the target host (ADR-006 Decision 4-PAT).
 *   - host === "github.com" → process.env.GITHUB_TOKEN
 *   - any other host (GHES) → process.env.GHES_TOKEN
 * - If the host's token is absent, proceeds without auth (lower rate limit) and logs
 *   a warning naming the host whose token is missing. This mirrors the existing
 *   unauthenticated-fallback behavior; no new hard-failure mode is introduced.
 * - The module-load-time frozen REQUEST_HEADERS constant has been replaced by
 *   buildHeaders(host) so the correct PAT is selected per request. This is the
 *   structural guarantee that a GHES PAT never reaches github.com and vice versa.
 * - Logs x-ratelimit-remaining after each response.
 */

const USER_AGENT = "github-skill-scanner/1.0";

/**
 * Builds request headers for a GitHub API call to the given host.
 *
 * Token selection (ADR-006 Decision 4-PAT / GHE-4 AC#8):
 *   host === "github.com" → GITHUB_TOKEN
 *   any other host → GHES_TOKEN
 *
 * This is an exact-equality check, never a substring match (TC-227: a host
 * like "xgithub.com" must route to GHES_TOKEN, not GITHUB_TOKEN).
 *
 * If the selected token is absent, logs a warning and returns headers without
 * Authorization — the scanner proceeds unauthenticated.
 */
export function buildHeaders(host: string): Record<string, string> {
  const isGithubDotCom = host === "github.com";
  const token = isGithubDotCom
    ? process.env.GITHUB_TOKEN
    : process.env.GHES_TOKEN;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": USER_AGENT,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    const envVar = isGithubDotCom ? "GITHUB_TOKEN" : "GHES_TOKEN";
    console.warn(
      `[scanner] ${envVar} is not set for host ${host} — proceeding without auth. ` +
        "Rate limits will be lower (60 req/hr unauthenticated vs 5000 req/hr authenticated)."
    );
  }

  return headers;
}

/**
 * Maps a URL hostname to the "config host" used for token selection.
 *
 * github.com serves its REST API at api.github.com (a different hostname).
 * GHES serves everything at the single configured host.
 * This mapping ensures requests to api.github.com use GITHUB_TOKEN, not GHES_TOKEN.
 *
 * The mapping is explicit and exhaustive:
 *   api.github.com → "github.com" (the config host; token = GITHUB_TOKEN)
 *   any other hostname → that hostname (the GHES config host; token = GHES_TOKEN)
 */
function configHostFromUrlHostname(hostname: string): string {
  if (hostname === "api.github.com" || hostname === "github.com") {
    return "github.com";
  }
  return hostname;
}

/**
 * Fetch a GitHub API URL with host-appropriate auth headers.
 *
 * The config host is inferred from the URL hostname: api.github.com maps back to
 * the "github.com" config host; every other hostname is a GHES host. This ensures
 * the token selected always matches the actual request target — the PAT-routing
 * security invariant (ADR-006 Decision 4-PAT).
 *
 * Returns the raw Response — callers handle JSON parsing and status checks.
 * Logs rate limit remaining after each response.
 */
export async function githubFetch(url: string): Promise<Response> {
  // Derive config host from the full URL so header selection is always tied to the
  // actual destination, never to a separate parameter that could diverge.
  let configHost: string;
  try {
    configHost = configHostFromUrlHostname(new URL(url).hostname);
  } catch {
    // Non-parseable URL — fall back to treating as github.com (existing behavior)
    configHost = "github.com";
  }
  const host = configHost;

  const headers = buildHeaders(host);
  const response = await fetch(url, { headers });

  const remaining = response.headers.get("x-ratelimit-remaining");
  if (remaining !== null) {
    const rem = parseInt(remaining, 10);
    if (rem < 50) {
      console.warn(`[scanner] Rate limit low: ${rem} requests remaining`);
    } else {
      console.log(`[scanner] Rate limit remaining: ${rem}`);
    }
  }

  return response;
}
