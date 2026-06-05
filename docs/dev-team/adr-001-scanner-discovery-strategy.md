# Architecture Decision Record (ADR)
**ADR Number:** ADR-001
**Title:** Discover SKILL.md files via the GitHub Git Trees API (recursive) with fixed layout-matching rules
**Author:** Marcus Chen (Solution Architect)
**Date:** 2026-06-04
**Status:** Proposed

---

## Context

The scanner (`src/scan`) must find **every** `SKILL.md` in each configured repo. A repo can host
multiple skills, each in its own directory; the directory name is the `--skill` identifier
(requirements must-have #2, OQ-2). We need to decide *how* the scanner enumerates a repo's files
and *which* paths count as a skill (OQ-6).

Fixed inputs that shape this decision:
- Under 20 repos at launch, all **public** (OQ-4, OQ-3).
- A **PAT stored as an Actions secret** is available for the higher authenticated rate limit (OQ-3).
- Full scan must complete in **under 60 seconds**, and sequential per-repo scanning is acceptable (OQ-4).
- Confirmed real-world layout: `anthropics/skills` uses top-level `<skill-name>/SKILL.md`.
- The scanner runs as a Node 20 script in GitHub Actions and uses `fetch` (built in on Node 20).

The two sub-questions are: (a) which GitHub API to enumerate files, and (b) the exact set of
conventional layouts that qualify as a skill.

---

## Decision Drivers

1. **Minimize API calls per repo** — the 60s budget and rate limits both reward fewer round-trips.
2. **Reliability and graceful degradation** — one bad repo must not fail the whole scan (must-have #2).
3. **Simplicity** — small team, one-week runway, plain JS, "simple over clever."
4. **Deterministic, documentable matching rules** — the Lead must implement them without ambiguity, and authors must be able to predict whether their layout is discovered.

---

## Options Considered

### Option 1: Git Trees API, recursive (`GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`)

Resolve the default branch (or trust `HEAD`), then fetch the **entire file tree in one recursive
call**. Filter the returned `tree[]` entries for paths whose basename is `SKILL.md`, apply the
layout rules below, and fetch each matching file's raw content to parse frontmatter.

**Pros:**
- **One call enumerates the whole repo** — best possible cost for "find all files matching a name."
- Returns full paths, so directory-derived `skillName` falls out directly.
- Stable, well-documented endpoint; not subject to Search API's separate, stricter rate limit.

**Cons:**
- Recursive trees are **truncated** for very large repos (`truncated: true` in the response). Skill
  repos are small, so this is a low risk, but the scanner must detect and log the flag.
- Still needs one content fetch per discovered `SKILL.md` (unavoidable for any approach that reads frontmatter).
- Needs the default branch name; one extra call per repo unless we assume a branch.

**Estimated effort:** Small

---

### Option 2: Contents API directory walk (`GET /repos/{owner}/{repo}/contents/{path}`)

Start at the repo root, list directory entries, and recurse into subdirectories looking for `SKILL.md`.

**Pros:**
- Returns file content metadata inline for small files (can sometimes skip a separate fetch).
- Conceptually simple at the root level.

**Cons:**
- **One API call per directory.** A repo with N skill directories costs O(directories) calls — for
  20 repos this multiplies fast and threatens both the 60s budget and the rate limit.
- Recursion logic and depth control must be hand-written and carefully bounded.
- Far more failure surface (each directory call can fail independently).

**Estimated effort:** Medium

---

### Option 3: Code Search API (`GET /search/code?q=filename:SKILL.md+repo:{owner}/{repo}`)

Ask GitHub to find `SKILL.md` files by name across the repo.

**Pros:**
- One query returns matching paths without walking the tree.

**Cons:**
- **Search has its own, much lower rate limit** (~30 requests/min authenticated) — fragile across 20 repos.
- **Search indexing is eventually consistent** — newly pushed `SKILL.md` files may not appear for some
  time. This directly undermines "new skills appear on the next scan" (Story 4).
- Code Search has historically required auth and has coverage caveats for some repos; less predictable.

**Estimated effort:** Small (to call) but **high reliability risk**

---

## Decision

**We will: Option 1 — the recursive Git Trees API.**

It enumerates an entire repo's files in a single, predictable call, which is the cheapest reliable
way to satisfy "find all `SKILL.md` files." It avoids the Contents API's per-directory call
explosion and the Search API's indexing lag and stricter rate limit. For sub-20 small repos this
keeps us comfortably inside both the 60s budget and the 5,000 req/hr authenticated limit. We accept
the truncation edge case (logged, not silently ignored) because skill repos are small.

### Per-repo algorithm
1. `GET /repos/{owner}/{repo}` to read `default_branch` (1 call). Fail soft on 404/403.
2. `GET /repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1` (1 call). If `truncated` is
   `true`, log a warning (some skills may be missed) and continue with what was returned.
3. Filter `tree[]` to `type === "blob"` entries whose **basename is exactly `SKILL.md`** (case-sensitive).
4. Apply the layout rules below to derive `skillName` from each matching path.
5. For each kept entry, fetch raw content (`https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`
   — un-rate-limited and avoids base64 decoding) and parse YAML frontmatter (see ADR-002).

### Conventional layouts to match (resolves OQ-6)
Match a `SKILL.md` blob if its path fits one of these shapes (`<skill>` = a single path segment):

| # | Path shape | `skillName` derivation | Example |
|---|-----------|------------------------|---------|
| L1 | `SKILL.md` (repo root) | the repo name | `SKILL.md` -> skill = `<repo>` |
| L2 | `<skill>/SKILL.md` | the parent directory | `frontend-design/SKILL.md` -> `frontend-design` (the anthropics/skills case) |
| L3 | `skills/<skill>/SKILL.md` | the directory under `skills/` | `skills/pdf/SKILL.md` -> `pdf` |

**Matching rules:**
- Match on the **full path against these three shapes**, not a blanket "any `SKILL.md` anywhere."
  This keeps `skillName` derivation unambiguous and avoids surfacing example/test fixtures buried
  deep in a repo (e.g. `docs/examples/x/SKILL.md` is intentionally **not** matched).
- **Recursion depth is effectively capped at 3 segments** by the rule set (L3 is the deepest). The
  recursive tree may return deeper paths; we simply do not match them.
- Matching is **case-sensitive on the filename** (`SKILL.md`, not `skill.md`) to mirror how the
  install tooling and authors name the file. Flag to PM if a case-insensitive variant is desired.
- A repo can yield matches from **multiple** layouts simultaneously; dedupe by resolved `path`.

---

## Consequences

### Positive
- ~2 API calls + N raw fetches per repo. For 20 repos with a handful of skills each, this is tens of
  requests total — orders of magnitude under the rate limit and comfortably inside 60s.
- Directory-derived `skillName` is a pure function of the matched path — easy to test.
- Raw-content fetches don't count against the core API rate limit and avoid base64 handling.

### Negative
- We deliberately **do not discover non-conventional layouts** (e.g. `SKILL.md` four levels deep, or
  oddly named files). This is a known, documented limitation — authors must follow L1–L3.
- Two-step (repo metadata, then tree) means a marginal extra call per repo; negligible at this scale.

### Neutral / Watch
- **Truncation flag** must be surfaced in logs. If skill repos ever grow huge, revisit.
- If a future repo nests skills deeper or uses a new convention, add a layout rule here (and supersede
  this ADR's table) rather than loosening matching to "any SKILL.md."
- If repo count grows well past 20, the sequential model still holds for a while; parallelize per-repo
  (bounded concurrency) before touching the discovery strategy.

---

## The Road Not Taken

**Contents API walk (Option 2)** was the runner-up — it needs no branch lookup and can inline small
file content. We rejected it on call-count: per-directory recursion is the wrong cost curve even at
this scale. **Code Search (Option 3)** was rejected outright on indexing lag, which conflicts with
the "fresh catalog" promise. We'd revisit Trees-vs-Contents only if recursive-tree truncation starts
biting real repos.

---

## Implementation Notes

- Config file: a list of `{ owner, repo }` (per requirements must-have #1). Path `src/scan/repos.json`.
- Per-repo failures (404/403/network/rate-limit) -> log, skip, continue. Exit non-zero **only if all
  repos fail** (must-have #2 acceptance).
- Set request headers: `Authorization: Bearer <PAT>`, `Accept: application/vnd.github+json`,
  `X-GitHub-Api-Version: 2022-11-28`, and a `User-Agent`.
- After each response, you may read `x-ratelimit-remaining`; at this scale a simple guard/log is enough
  (no backoff machinery needed for v1).
- Content parsing (frontmatter -> fields) is specified in **ADR-002**; this ADR stops at "which paths,
  fetched how."

---

## Links

- `requirements.md` must-have #1, #2; OQ-2, OQ-3, OQ-4, OQ-6
- ADR-002 (output schema — what each discovered skill becomes)
- ADR-004 (CI/CD — where the scanner runs and how the PAT is provided)
