/**
 * GitHub API client — authenticated fetch wrapper.
 *
 * ADR-001 implementation notes:
 * - Reads PAT from process.env.GITHUB_TOKEN.
 * - If token is absent, proceeds without auth (lower rate limit — acceptable for dev).
 * - Attaches required headers for the GitHub REST API.
 * - Logs x-ratelimit-remaining after each response.
 */

const GITHUB_API_BASE = "https://api.github.com";
const USER_AGENT = "github-skill-scanner/1.0";

function buildHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": USER_AGENT,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    console.warn(
      "[scanner] GITHUB_TOKEN is not set — proceeding without auth. " +
        "Rate limits will be lower (60 req/hr unauthenticated vs 5000 req/hr authenticated)."
    );
  }
  return headers;
}

// Build headers once per process; token is read at startup.
const REQUEST_HEADERS = buildHeaders();

/**
 * Fetch a GitHub API URL with the required auth headers.
 * Returns the raw Response — callers handle JSON parsing and status checks.
 * Logs rate limit remaining after each response.
 */
export async function githubFetch(url: string): Promise<Response> {
  const fullUrl = url.startsWith("http") ? url : `${GITHUB_API_BASE}${url}`;
  const response = await fetch(fullUrl, { headers: REQUEST_HEADERS });

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
