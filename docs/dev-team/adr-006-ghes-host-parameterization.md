# Architecture Decision Record (ADR)
**ADR Number:** ADR-006
**Title:** Parameterize the scanner on a single GitHub host — derive every URL and the auth token from one `host` setting; fetch raw content via the Contents API
**Author:** Marcus Chen (Solution Architect)
**Date:** 2026-06-05
**Status:** Proposed

---

## Context

The scanner hard-codes github.com in three places:

- `src/scan/client.ts` — `GITHUB_API_BASE = "https://api.github.com"`, token from `process.env.GITHUB_TOKEN`.
- `src/scan/index.ts` — raw content from `https://raw.githubusercontent.com/...`, and `repoUrl = "https://github.com/<owner>/<repo>"`.

The BA delta (`requirements-github-enterprise.md`, GHE-1..5) requires the scanner to target a **single GitHub Enterprise Server (GHES)** host instead. On GHES:

- The REST API lives at `https://<host>/api/v3` (not `https://api.github.com`).
- There is **no** `raw.githubusercontent.com` — raw content is served from the GHES host itself, or read through the Contents API.
- `repoUrl` (which drives the frontend install command and card links) must point at the GHES host.
- Auth requires a **PAT issued by the GHES instance**; a github.com token is rejected by GHES and, conversely, the GHES PAT must never be sent to github.com.

**Fixed inputs (stakeholder, not up for re-litigation):** enterprise-only target; exactly **one** GHES host per deployment; one dedicated PAT for that host stored as a separate Actions secret; the existing `SCAN_PAT` continues to push `data/` to *this* github.com repo. This is **not** a mixed github.com + GHES catalog (out of scope per the delta).

**Unchanged by design:** the discovery algorithm (ADR-001 — Git Trees API at `/repos/{o}/{r}/git/trees/{branch}?recursive=1`, L1/L2/L3 matching, fail-soft), the data envelope (ADR-002), and all frontend behavior (which is already driven entirely by `repoUrl` in the data).

This ADR sets the **contract**: where the host lives, how every URL and the token are derived from it, whether github.com stays supported, and how PATs are routed. It does not write production code — the Lead implements.

### What the existing tests assume (the backward-compat blast radius)

Confirmed by inspection. Every existing test that touches a URL hard-codes the github.com forms:

- `tests/scanner/writer.test.ts`, `tests/fe/frontend.test.tsx`, `tests/e2e/fixtures/skills.json`, `tests/e2e/catalog.spec.ts` all assert `repoUrl: "https://github.com/<owner>/<repo>"` and the github.com install command (`npx skills add https://github.com/anthropics/skills ...`).
- These are the project's **90 unit + 12 e2e** green tests (README index, 2026-06-05).
- Note: the frontend and writer tests *feed* `repoUrl` in as data — they don't exercise the scanner's URL derivation. The github.com strings live in scanner-produced data and e2e fixtures. There is **no direct unit test on `client.ts` or `index.ts`** today (scanner tests cover `layout`, `parser`, `limits`, `writer`), so the Lead has latitude on the internal injection mechanism — but anything that changes the *default* output of the scanner away from github.com would turn those existing data/fixture assertions red.

---

## Decision Drivers

1. **Single source of truth for the host (GHE-5).** One place to set the host; every URL derived from it, never duplicated.
2. **No cross-host token leakage (GHE-4).** The GHES PAT must reach only the GHES host; the github.com push token must reach only github.com. This is a security invariant, not a nicety.
3. **Protect the existing green suite at near-zero cost.** 90 unit + 12 e2e tests encode github.com. If a github.com special-case is cheap, keeping it is free insurance against regressions during a one-week change.
4. **Correctness over rate-limit micro-optimization at this scale.** Under 20 small repos. A wrong raw URL = silent empty scan (the worst failure mode here — looks green, returns nothing). Uniformity and "one host" beat shaving a handful of API calls.
5. **Simplicity / DRY** (project convention) and a clean hand-off the Lead can implement without me in the room.

---

## Decisions

### Decision 1 — Host config shape: a `host` field per repo entry in `repos.json`, with no top-level host

**The config schema (`src/scan/repos.json`):**

```jsonc
[
  { "host": "github.<COMPANY>.com", "owner": "team-a", "repo": "skills" },
  { "host": "github.<COMPANY>.com", "owner": "team-b", "repo": "tooling" }
]
```

- `host` is a **bare hostname** (no scheme, no `/api/v3`, no trailing slash) — e.g. `github.<COMPANY>.com` or `github.com`. The scanner derives `https://`, `/api/v3`, `/raw`, and `repoUrl` from it (Decision 2). Putting only the hostname here keeps one source of truth and avoids the "is the slash included?" class of bug.
- `host` is **required per entry.** For the enterprise-only deployment, every entry carries the same GHES host. (See the rejected alternatives below for why I did not make it a single top-level field or an env var.)

`RepoConfig` becomes:

```ts
interface RepoConfig {
  host: string;   // bare hostname, e.g. "github.<COMPANY>.com" or "github.com"
  owner: string;
  repo: string;
}
```

**Why per-entry `host` and not a top-level `{ host, repos: [...] }` object:**
- A top-level object is *cleaner on paper* for one host, but it changes `repos.json` from an array to an object — which breaks `loadReposConfig()`'s `Array.isArray(configs)` guard and the "empty array" contract in ADR-001/ADR-002 invariants, and ripples into `writer.test.ts`/`index.ts` shape assumptions. Per-entry `host` keeps the file an **array** (everything downstream that iterates it is unchanged) and adds one field.
- Per-entry `host` is also the only shape that leaves the door open to a future mixed catalog without another schema break — though mixing is **explicitly out of scope now** and this ADR does not design for it (token routing for mixing is handled structurally by Decision 4, but multi-host scanning behavior is not in scope).

**Why not an env var for the host:** an env var (e.g. `GHES_HOST`) splits the source of truth — the repo list is in a file, the host is in CI config — which violates GHE-5's "one place" and makes local runs and tests awkward (you'd have to set an env var to scan). The host belongs with the repos it qualifies.

**Effort:** Small. One field on a 3-line array; `loadReposConfig` validates it is a non-empty string.

> PM lever: if you want the absolute minimum diff and accept the array→object break, a top-level `{ host, repos }` is viable for a strict single-host world. I recommend per-entry `host` because it costs one field and breaks nothing downstream.

---

### Decision 2 — Endpoint derivation: all four URLs are a pure function of `host`, with a github.com special-case

A single helper (the Lead's structure; I specify the contract) maps `host` → the four URL builders. The github.com hostname is special-cased because github.com splits API/raw across `api.` and `raw.` subdomains, whereas GHES serves everything off the one host.

| What | github.com (`host === "github.com"`) | GHES (any other host) |
|------|--------------------------------------|------------------------|
| **API base** | `https://api.github.com` | `https://<host>/api/v3` |
| **Repo info call** | `<apiBase>/repos/{o}/{r}` | `<apiBase>/repos/{o}/{r}` |
| **Git Trees call** | `<apiBase>/repos/{o}/{r}/git/trees/{branch}?recursive=1` | same shape on `<apiBase>` |
| **Raw content** | Contents API: `<apiBase>/repos/{o}/{r}/contents/{path}?ref={branch}` | Contents API: `<apiBase>/repos/{o}/{r}/contents/{path}?ref={branch}` |
| **`repoUrl`** | `https://github.com/{o}/{r}` | `https://<host>/{o}/{r}` |

The API path *shapes* (`/repos/...`, `/git/trees/...`) are **identical** across hosts — only the **base** differs. That is the whole point: ADR-001's discovery algorithm is untouched; only the base URL is parameterized. GHE-1 and the Trees call (acceptance #1, #2) fall out directly.

`repoUrl` is built as `https://<host>/{o}/{r}` with **no trailing slash** (ADR-002 invariant preserved), giving GHE-3 / acceptance #4–#6 for free (the frontend already reads `repoUrl`).

---

### Decision 3 — Raw content (resolves OQ-GHE-3): use the **Contents API**, uniformly, on both hosts

This is the load-bearing decision in this ADR, so I am stating the reasoning in full.

The scanner currently fetches raw bytes from `https://raw.githubusercontent.com/{o}/{r}/{branch}/{path}` (`src/scan/index.ts` `fetchRawContent`). On GHES there is **no** `raw.githubusercontent.com`. The two options:

- **(A) GHES raw path** — `https://<host>/raw/{o}/{r}/{branch}/{path}`.
- **(B) Contents API** — `GET <apiBase>/repos/{o}/{r}/contents/{path}?ref={branch}` (same api/v3 base as every other call).

**Decision: (B) Contents API, used uniformly on github.com and GHES.**

**Why:**
- **No second host to configure, validate, or get wrong.** Option A introduces a *separate* URL template whose exact form (`/raw/` vs `/raw/blob/`, path-style variations) **varies by GHES version and configuration** (per OQ-GHE-3). A wrong raw URL doesn't error loudly — it 404s, the scanner emits a `null`-fields entry (its existing fail-soft path), and the scan looks successful while returning empty content. That is the single most dangerous failure mode for this feature. The Contents API is on the same `/api/v3` base we already validate for the repo-info and trees calls — **if the API base is right, raw content is right.** One host, one thing to get correct.
- **Uniformity across hosts** collapses the github.com-vs-GHES special-casing for raw content to *nothing* — both use `<apiBase>/repos/.../contents/...`. The only host special-case left is the API base itself (Decision 2). Less branching, less to test.
- **Rate-limit cost is negligible at this scale.** The trade-off accepted: Contents API calls **count against the core REST rate limit**, whereas `raw.githubusercontent.com` did not. For under 20 repos with a handful of skills each, that is tens of extra calls against a 5,000/hr authenticated budget — ADR-001's own math already sits "orders of magnitude under the limit." We are nowhere near it. (If the catalog ever grows into the hundreds of skills *and* rate limits start biting, revisit — see Watch.)
- **Auth comes for free and correct.** Contents API uses the same `Authorization` header path as the other calls, so the per-host token routing (Decision 4) covers it with zero extra work. The GHES raw path would need its own auth handling and its own "which token" decision.

**Response handling note for the Lead** (contract, not implementation):
- The Contents API returns JSON with **base64-encoded** `content` by default. Two equivalent ways to get the raw text:
  - **Preferred:** send `Accept: application/vnd.github.raw` (or `application/vnd.github.raw+json`) so the body is the **raw file bytes** — no base64 decode, and the existing `response.text()` + size-limit logic in `fetchRawContent` keeps working almost unchanged. This header is supported on both github.com and GHES (api/v3).
  - **Fallback (if a target GHES version ignores the raw media type):** accept the default JSON and `Buffer.from(json.content, "base64").toString("utf8")`.
- **Size guard (`src/scan/limits.ts`) is preserved.** With `Accept: ...raw`, `Content-Length` reflects the file and the pre-read `exceedsSizeLimit` check still works; the post-read `Buffer.byteLength` check is the belt-and-suspenders as today. If the base64-JSON fallback is ever used, the post-read byte-length check still bounds memory after decode (the declared `Content-Length` would describe the JSON envelope, so rely on the post-read check in that branch). SEC-003/TD-008 intent is maintained either way.
- The comment in `index.ts` that says "does not count against core API rate limit" must be corrected — with the Contents API it **does**. The existing rate-limit logging in `client.ts` already covers it; route the content fetch through the same `githubFetch` so rate-limit headers are read for content calls too.

**The road not taken (raw path):** Option A avoids the rate-limit cost and is a marginally smaller payload. We rejected it because the cost it avoids is negligible at this scale and the risk it adds (version-dependent URL, silent empty scans, a second host + second auth path) is exactly the kind of "looks fine, returns nothing" failure that is hardest to catch in CI. We'd reconsider only if rate limits become a real constraint at much larger scale.

---

### Decision 4 — github.com backward compatibility: **KEEP the github.com special-case.**

**Verdict: implement the host abstraction so that `host === "github.com"` produces today's exact URLs (`api.github.com`, `https://github.com/...`) and any other host produces the GHES forms.** This makes GHE-N1 essentially free as a side effect of doing Decision 2 correctly, and — more importantly — it **keeps the existing 90 unit + 12 e2e tests green** because the default github.com output is byte-identical to today.

**Why keep it (the PM marked it "provisionally out — cut if it complicates PAT routing"):**
- It does **not** complicate PAT routing. Token selection (Decision 4-PAT below) keys off the target host regardless of whether we special-case github.com — the routing logic is the same code either way. So the PM's stated cut-condition does not trigger.
- The cost is one `if (host === "github.com")` branch in the URL helper. In exchange, every existing test, fixture, and the live github.com deployment keep working unchanged. A naive host-substitution *without* the special-case would generate `https://github.com/api/v3` (wrong — github.com has no `/api/v3`) and `https://github.com/raw/...`, breaking the current production scan and every github.com test. The special-case is what *prevents* a regression, not a gold-plating of a future feature.
- It is the cheapest way to satisfy the delta's own stated preference that "all existing behavior is preserved unchanged" (acceptance #10) while adding GHES.

This is a deliberate, scoped exception to "design only what's needed now": the github.com path isn't speculative future-proofing — it is **the path the existing test suite and the live site already exercise.** Dropping it would be net *more* work (rewriting fixtures and assertions) for a worse outcome.

> PM lever (explicit): if you still want github.com support gone, the cut is "scanner only ever emits GHES forms; rewrite the github.com test fixtures/assertions to GHES forms; retire the github.com deployment." That is *more* effort than keeping the branch, and it abandons the live github.com catalog. I recommend against it. Your call.

---

### Decision 4-PAT — PAT routing (resolves OQ-GHE-4): per-host token, selected at request time, never cross-sent

**The env-var / secret model:**

| Purpose | Env var (scanner process) | Actions secret | Scope |
|---------|---------------------------|----------------|-------|
| Read the **GHES** API (repo info, trees, contents) | `GHES_TOKEN` | `GHES_SCAN_PAT` | Read-only on the **GHES** instance |
| Push `data/skills.json` to **this github.com repo** (unchanged from ADR-004) | `SCAN_PAT` (used by the git push step, not the scanner reads) | `SCAN_PAT` (existing) | Contents read/write on **this github.com repo** |
| (Backward-compat) Read the **github.com** API when `host === "github.com"` | `GITHUB_TOKEN` (existing) | n/a in the GHES workflow | Public-repo read on github.com |

**How the client picks the token (the security invariant, GHE-4 / acceptance #8):**

The token is selected **by the target host of the request**, at request time — not once at process start. This is a change from today's `client.ts`, which reads `process.env.GITHUB_TOKEN` once and freezes `REQUEST_HEADERS` at module load. The Lead must make the client **host-aware**: `githubFetch` (or its caller) resolves the token from the request's host:

- Request to a **GHES** host → `process.env.GHES_TOKEN` (and **never** `GITHUB_TOKEN`/`SCAN_PAT`).
- Request to **github.com** → `process.env.GITHUB_TOKEN` (and **never** `GHES_TOKEN`).
- Match the existing fail-soft auth behavior: if the host's token is **absent**, log the same "proceeding without auth — lower rate limit" warning and continue unauthenticated (GHE-4 acceptance: no new hard-failure mode). The warning message should name *which* host's token is missing.

Because the Contents API (Decision 3) goes through the same api-base/host as every other call, this single host→token rule covers content fetches too — there is no separate raw host that could accidentally receive a token. That is a concrete security benefit of choosing the Contents API over the GHES raw path.

**Implementation contract for the Lead:** the module-load-time `REQUEST_HEADERS` constant in `client.ts` must become a per-request `buildHeaders(host)` (or equivalent) so the right token is attached per request. Headers other than `Authorization` are unchanged.

**Does the scanner's GHES read PAT also push the data commit? No — two secrets, two scopes (confirmed).** The likely-answer in OQ-GHE-4 is correct:
- `GHES_SCAN_PAT` = read-only on the **GHES** instance. It authenticates the scanner's API reads. It has **no** rights on the github.com repo and is never used for git push.
- `SCAN_PAT` = the **existing** github.com PAT with Contents read/write on *this* repo. It still does the `git push` of `data/skills.json` that triggers the deploy (ADR-004's PAT-push-triggers-deploy mechanism is **unchanged** — the deploy chain still depends on pushing with `SCAN_PAT`, not `GITHUB_TOKEN`).

So `scan.yml` will inject **both**: `GHES_SCAN_PAT` → `GHES_TOKEN` for the scanner process, and `SCAN_PAT` for the checkout/push step. The git push target is github.com (this repo), entirely independent of the GHES read target. **The GHES PAT is never used to push, and `SCAN_PAT` is never sent to the GHES API.**

(The detailed `scan.yml` wiring is ADR-004 / runbook territory and is **deferred** — see Decision 6. This ADR fixes the *names and routing contract*; DevOps wires it once the deploy decision lands.)

---

### Decision 5 — Schema impact (ADR-002): **no schema change. `repoUrl` already carries the host. No `host` field added.**

**Verdict: additive-nothing. ADR-002 / `src/types/skills.ts` are unchanged. `schemaVersion` stays `1`.**

- `SkillEntry.repoUrl` and `ScannedRepo.repoUrl` are already full URL strings. Pointing them at `https://<host>/...` is a **value change, not a type or shape change** (the BA delta's own assumption, confirmed). The frontend install command and card links are already driven by `repoUrl` — they need **zero** logic change; they just render whatever host is in the data.
- I considered adding a `host` field to `metadata` and/or `SkillEntry`. **Rejected for this increment.** The justification for a `host` field would be disambiguating `repo` (`"owner/repo"`) across hosts — `repo` *could* collide across hosts (`team-a/skills` could exist on both github.com and a GHES host). But this deployment is **single-host by stakeholder decision**, so within any one `skills.json` every entry shares one host and there is no collision to disambiguate. `repoUrl` already encodes the host uniquely and fully. Adding `host` now would be designing for a multi-host future that is explicitly out of scope — exactly the over-engineering I'm supposed to resist.
- **Watch / escape hatch:** if a future increment ever does mix hosts in one catalog, the right move is a **new ADR** (superseding/amending ADR-002) that adds `metadata.host` or `SkillEntry.host` as an *additive* field — the existing additive-field rule in ADR-002 ("additive optional fields do not bump `schemaVersion`") already governs how to do that cleanly. Not now.

So GHE-3 / acceptance #4–#6 are satisfied entirely by Decision 2 setting the right value into the existing `repoUrl` field. No contract churn.

---

### Decision 6 — Deferred deployment risks recorded as constraints (OQ-GHE-1, OQ-GHE-2)

These are **not designed here** by stakeholder instruction; they are recorded as explicit assumptions/constraints so the next person knows they are open and blocking before this ships to a real GHES target.

**ASSUMPTION / OPEN — OQ-GHE-1 (public data exposure).** This ADR assumes the deploy target / access model is decided **elsewhere**. The current pipeline (ADR-003/ADR-004) publishes `data/skills.json` to a **public** GitHub Pages site. If pointed at an internal GHES instance, that would publish internal repo names, skill names/descriptions, and the GHES host domain publicly — **potentially unacceptable** under enterprise policy. **This is a stakeholder/security decision and a deploy-target concern, not a scanner-code concern.** The scanner changes in this ADR are correct regardless of where the data is *served*; but **this feature must not be pointed at a real internal GHES host in production until OQ-GHE-1 is resolved.** If the answer forces a non-public deploy target, **ADR-003, ADR-004, and the deployment-runbook will need updating** — out of scope here.

**ASSUMPTION / OPEN — OQ-GHE-2 (CI network reachability + self-hosted runner).** This ADR assumes nothing about whether github.com-hosted Actions runners (on Azure) can reach `https://<host>/api/v3`. If the GHES host is behind a VPN/firewall (the BA's stated likely case), a **github.com-hosted runner cannot reach it** and every scan will silently return empty — a **self-hosted runner inside the corporate network** would be required. That is **infrastructure (DevOps), not scanner code**, and is explicitly out of scope. **Consequence to record:** the scanner code in this ADR is necessary but **not sufficient** for a working GHES scan — CI reachability is a hard prerequisite. When OQ-GHE-2 is answered, **ADR-004 and the runbook need a runner section** (self-hosted runner setup, secrets on that runner, security posture). Not designed here.

**Net:** Decisions 1–5 are buildable and testable **now** (against fixtures/mocks). Decisions tied to OQ-GHE-1/2 are **blocking for real-world rollout** and belong to a later deploy-focused increment.

---

## Feasibility flags (per acceptance criterion)

Scanner-code acceptance criteria — all **GREEN** (buildable this increment, testable with mocks/fixtures):

| Criterion | Flag | Note |
|-----------|------|------|
| GHE-1 / AC#1 (API base `https://<host>/api/v3`) | GREEN | Decision 2; pure host derivation. |
| AC#2 (Trees call on GHES base) | GREEN | Decision 2; same path shape, parameterized base. |
| GHE-2 / AC#3 (raw content off GHES) | GREEN | Decision 3 — Contents API on the api/v3 base; resolves OQ-GHE-3. |
| GHE-3 / AC#4–#6 (`repoUrl`, install cmd, card links) | GREEN | Decision 2 sets value; frontend already reads `repoUrl` (no FE change). |
| GHE-4 / AC#8, #9 (per-host PAT, no cross-send, separate secret) | GREEN | Decision 4-PAT — `GHES_TOKEN`/`GHES_SCAN_PAT`, host-keyed selection. |
| GHE-4 (absent-token fail-soft warning) | GREEN | Preserves existing `client.ts` unauthenticated-fallback behavior. |
| GHE-5 / AC#7 (host single source of truth; no `api.github.com` on GHES run) | GREEN | Decision 1 (`host` in `repos.json`) + Decision 2. |
| AC#10 (error-handling unchanged) | GREEN | No change to fail-soft / exit-policy / rate-limit logging. |
| GHE-N1 (github.com backward compat) | GREEN | Decision 4 — kept via special-case; existing 90+12 tests stay green. |

Deployment / infrastructure acceptance — **YELLOW / blocked (out of scope, by instruction):**

| Concern | Flag | Note |
|---------|------|------|
| OQ-GHE-1 public exposure | YELLOW (blocking for rollout) | Stakeholder/security decision; may force ADR-003/004/runbook changes. |
| OQ-GHE-2 reachability / self-hosted runner | YELLOW (blocking for rollout) | DevOps/infra; scanner code is necessary-but-not-sufficient. |

There are **no RED** scanner-code items. The two YELLOWs are not scanner buildability problems — they are deploy/infra prerequisites that gate real-world use.

---

## Consequences

### Positive
- One `host` field drives **all four URLs and the token** (GHE-5). No duplicated host anywhere.
- Contents API gives a **uniform** raw-content path across github.com and GHES — one fewer host, one fewer thing to get wrong, and it eliminates the silent-empty-scan risk of a version-dependent raw URL.
- github.com special-case keeps the **existing 90 unit + 12 e2e tests green** and the live github.com catalog working — GHES support is purely additive.
- Per-host token selection makes "GHES PAT never touches github.com (and vice versa)" a **structural** property, not a discipline you have to remember.
- **Zero data-contract churn:** ADR-002 and `src/types/skills.ts` untouched; the frontend needs no logic change.

### Negative
- `client.ts` must move from a frozen module-load `REQUEST_HEADERS` to **per-request, host-aware** header building. Small but real refactor; without it, per-host tokens are impossible.
- Contents API content fetches now **count against the core REST rate limit** (raw.githubusercontent.com did not). Accepted: negligible at under-20-repo scale; logged via existing rate-limit instrumentation.
- The "does not count against rate limit" comment in `index.ts` is now wrong and must be corrected — a small but important doc-accuracy fix so the next maintainer isn't misled.

### Neutral / Watch
- **Scale:** if the catalog grows to hundreds of skills, the Contents-API rate-limit cost grows linearly. Revisit raw-fetch strategy (or bounded concurrency, per ADR-001's note) before it bites. Not a v1 concern.
- **GHES media-type support:** confirm the target GHES version honors `Accept: application/vnd.github.raw`; if not, fall back to base64-decode (Decision 3). Either path satisfies the contract.
- **Multi-host future:** if mixing hosts in one catalog ever becomes in scope, that's a new ADR adding an additive `host` field to the schema (ADR-002's additive rule applies) and designing multi-host scan behavior. Out of scope now.
- **Deploy/infra (OQ-GHE-1/2):** unresolved and blocking for real rollout; ADR-003/004 + runbook will need updates when decided.

---

## The Road Not Taken

- **Top-level `{ host, repos }` config object** was the runner-up for Decision 1 — visually cleanest for one host. Rejected because it turns `repos.json` from an array into an object, breaking `loadReposConfig`'s array guard and downstream iteration/tests for no real benefit at one extra field. Reconsider only if a config grows many global settings that genuinely don't belong per-entry.
- **GHES raw path (`https://<host>/raw/...`)** was the alternative for Decision 3. Rejected: version-dependent URL form, a second host to auth and validate, and a silent-empty-scan failure mode — to save a rate-limit cost that is negligible here. Reconsider only at much larger scale where API rate limits become the binding constraint.
- **Dropping github.com support** (the PM's "provisionally out") was considered for Decision 4. Rejected because keeping it is *cheaper* than cutting it (one `if` branch vs. rewriting fixtures + assertions and retiring the live catalog), and the stated cut-condition ("if it complicates PAT routing") does not hold — routing is host-keyed either way.
- **Adding a `host` field to the schema** was considered for Decision 5. Rejected as designing for an out-of-scope multi-host future; `repoUrl` already carries the host, and single-host means no collision to disambiguate.

---

## Implementation Notes (for the Lead — direction, not code)

- **Config:** add required `host` (bare hostname) to each `repos.json` entry; `loadReposConfig` validates non-empty string. Update the `RepoConfig` interface in `src/scan/index.ts`.
- **URL helper:** one function `host → { apiBase, repoInfoUrl, treeUrl, contentsUrl, repoUrl }` with the `host === "github.com"` special-case (api.github.com + `https://github.com/...`) vs `https://<host>/api/v3` + `https://<host>/...`. This is the single place hosts branch.
- **`client.ts`:** make headers per-request and host-aware — `buildHeaders(host)` selects `GHES_TOKEN` vs `GITHUB_TOKEN` by host; preserve the existing absent-token warning (name the host in it). Route the Contents-API content fetch through `githubFetch` so rate-limit headers are logged for content too.
- **`index.ts` `fetchRawContent`:** switch to the Contents API (`/repos/{o}/{r}/contents/{path}?ref={branch}`) with `Accept: application/vnd.github.raw`; keep the `limits.ts` size guards (pre-read header check + post-read byte-length check); correct the stale "does not count against rate limit" comment; build `repoUrl` from the host helper instead of the hard-coded github.com string.
- **Tests:** existing github.com tests/fixtures should stay green unchanged (that's the point of Decision 4). Add scanner tests that, given a GHES `host`, assert API base = `https://<host>/api/v3`, content via `/contents/...?ref=...`, `repoUrl = https://<host>/{o}/{r}`, and that **no** request to a GHES host carries `GITHUB_TOKEN`/`SCAN_PAT` and **no** request to github.com carries `GHES_TOKEN`. Calibrate the per-request-header refactor effort with me if it looks larger than "small."
- **Secrets:** GHES read = `GHES_SCAN_PAT` → `GHES_TOKEN`; github.com push = existing `SCAN_PAT` (unchanged). DevOps wires `scan.yml` to inject both **after** the deploy decision (OQ-GHE-1/2) lands — not in this increment.

---

## Links

- `requirements-github-enterprise.md` — GHE-1..5, GHE-N1, AC#1–#10, OQ-GHE-1/2/3/4
- ADR-001 (discovery — Trees API + layout rules; unchanged, only API base parameterized)
- ADR-002 (data schema — unchanged; `repoUrl` carries the host; no `schemaVersion` bump)
- ADR-004 (CI/CD — PAT-push-triggers-deploy unchanged; needs a GHES secret + runner section once OQ-GHE-1/2 resolve)
- `deployment-runbook.md` (needs `GHES_SCAN_PAT` setup + self-hosted-runner section once OQ-GHE-2 resolves)
- `src/scan/client.ts`, `src/scan/index.ts`, `src/scan/repos.json`, `src/scan/limits.ts`, `src/types/skills.ts`
