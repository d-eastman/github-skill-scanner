# Prioritized Backlog
**Project:** GitHub Skill Scanner  
**Author:** Sasha Kowalski (Product Manager)  
**Date:** 2026-06-04  
**Status:** Active — one-week build (2026-06-04 to 2026-06-10)

MoSCoW key: **Must** = v1 ships without it; **Should** = high value, include if time allows; **Could** = low risk to cut; **Won't (v1)** = explicitly deferred.

---

## Epic 1: Data Contract and Project Scaffolding

The contract between the scanner and the frontend (ADR-002) must be locked and committed before either
half builds against it in parallel. Scaffolding gives both tracks a working repo to push to.

### E1-S1 — Repository scaffolding and TypeScript setup
**Priority:** Must | **Size:** S | **Maps to:** ADR-005 (amended), team/project-context.md  
Set up the monorepo structure (`src/fe`, `src/scan`, `data/`, `tests/`), Vite config with
`base: '/github-skill-scanner/'`, `tsconfig`, Prettier config, and the `package.json` commands
(`dev`, `build`, `typecheck`, `test`). Wire `npm run typecheck` and `npm run test` to pass on an
empty project.  
**Rationale:** Every other item depends on this existing. Nothing can be built or tested without it.  
**Dependencies:** None.

### E1-S2 — Shared TypeScript type for the ADR-002 schema
**Priority:** Must | **Size:** S | **Maps to:** Must-have #3, #4; ADR-002  
Define the `SkillEntry` and `SkillsCatalog` (envelope with `metadata` and `skills`) interfaces in a
shared module (e.g., `src/types/skills.ts`). Both the scanner (output) and the frontend (input) import
from here.  
**Rationale:** This is the contract. Locking it as a type before either side codes against it prevents
drift. Any field change is caught by the compiler.  
**Dependencies:** E1-S1.

### E1-S3 — `data/README.md` schema documentation
**Priority:** Must | **Size:** XS | **Maps to:** Must-have #4 (acceptance criterion: schema documented)  
Write a short `data/README.md` documenting the `skills.json` schema and pointing to ADR-002.  
**Rationale:** Must-have #4 requires documentation of the schema; this is the cheapest way to satisfy it.  
**Dependencies:** E1-S2.

---

## Epic 2: Scanner Core

The scanner runs as a Node 20 TypeScript script in GitHub Actions. Builds on the shared type.

### E2-S1 — Static repo config file (`src/scan/repos.json`)
**Priority:** Must | **Size:** XS | **Maps to:** Must-have #1  
Create `src/scan/repos.json` containing an array of `{ owner, repo }` objects. Seed with at least
one confirmed repo that contains real SKILL.md files (see launch content gate below).  
**Rationale:** The scanner reads this file; nothing runs without it.  
**Dependencies:** E1-S1.

### E2-S2 — GitHub API client module (authenticated fetch wrapper)
**Priority:** Must | **Size:** S | **Maps to:** Must-have #2; ADR-001  
TypeScript module wrapping Node 20's built-in `fetch` with the required headers (`Authorization`,
`Accept`, `X-GitHub-Api-Version`, `User-Agent`). Reads the PAT from `process.env.GITHUB_TOKEN`.
Includes a basic rate-limit remaining log after each response.  
**Rationale:** Every scanner API call goes through this; centralizing auth and headers reduces drift and
makes the scanner testable with a fake/stub.  
**Dependencies:** E1-S1.

### E2-S3 — Git Trees API repo enumeration (per-repo, layouts L1-L3)
**Priority:** Must | **Size:** M | **Maps to:** Must-have #2; ADR-001  
Implements the per-repo algorithm from ADR-001:
1. `GET /repos/{owner}/{repo}` to read `default_branch`. Fail soft on 404/403.
2. `GET /repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1`. Log warning if `truncated: true`.
3. Filter `tree[]` to `type === "blob"` with basename `SKILL.md`.
4. Apply layout rules L1 (`SKILL.md`), L2 (`<skill>/SKILL.md`), L3 (`skills/<skill>/SKILL.md`) to
   derive `skillName`. Dedupe by resolved path.
5. Skip repo (log, continue) on 404/403/network error. Exit non-zero only if all repos fail.  
**Rationale:** This is the scanner's core discovery step. Must complete before metadata extraction.  
**Dependencies:** E2-S1, E2-S2.

### E2-S4 — SKILL.md content fetch and YAML frontmatter extraction
**Priority:** Must | **Size:** M | **Maps to:** Must-have #3; ADR-001, ADR-002  
For each discovered SKILL.md path: fetch raw content from
`https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`. Parse YAML frontmatter to extract
`name` and `description`. Emit `null` for missing/malformed fields with a logged warning (no crash).
Build the full `SkillEntry` object including `skillName`, `repo`, `repoUrl`, `path`.  
**Rationale:** Without this, there is nothing to write to output.  
**Dependencies:** E2-S3, E1-S2.

### E2-S5 — JSON output writer (envelope with metadata, sorted)
**Priority:** Must | **Size:** S | **Maps to:** Must-have #4; ADR-002  
After scanning all repos: sort `skills` by `repo` then `skillName` (stable diff); compute metadata
fields (`lastScanned` ISO 8601 UTC, `repoCount`, `reposSucceeded`, `reposFailed`, `skillCount`);
write the full `SkillsCatalog` envelope to `data/skills.json`. Write an empty `skills: []` if zero
skills found (never an absent file).  
**Rationale:** This is the handoff to the frontend. Metadata envelope fields are also the Tier A health
metrics from success-metrics.md — they're free; they must be correct.  
**Dependencies:** E2-S4, E1-S2.

### E2-S6 — Scanner entry point and `npm run scan` command
**Priority:** Must | **Size:** S | **Maps to:** Must-have #5; ADR-001  
Wire the above modules into a runnable entry point (`src/scan/index.ts`). Add `"scan": "ts-node src/scan/index.ts"` (or equivalent) to `package.json`. Confirm end-to-end run from CLI completes and writes a valid `data/skills.json`.  
**Rationale:** The GitHub Actions workflow calls this command. It must work before the workflow is wired.  
**Dependencies:** E2-S1 through E2-S5.

### E2-S7 — Scanner unit tests (happy path + error paths)
**Priority:** Must | **Size:** M | **Maps to:** Must-have #2, #3; success-metrics.md guardrails  
Vitest unit tests covering: layout matching (L1/L2/L3 derivation), frontmatter parse (valid, missing,
malformed), graceful skip on API error, all-repos-fail exit code. Stub the fetch call to avoid real
API dependency.  
**Rationale:** Without test coverage on error paths, the scanner's graceful-degradation guarantees are
unverifiable. QA cannot sign off without them.  
**Dependencies:** E2-S3, E2-S4.

---

## Epic 3: CI/CD Pipeline

Two workflows per ADR-004. DevOps owns the YAML; Lead owns the build step wiring.

### E3-S1 — `scan.yml`: scheduled scanner workflow
**Priority:** Must | **Size:** M | **Maps to:** Must-have #5; ADR-004  
GitHub Actions workflow: `on: schedule` (daily cron) + `workflow_dispatch`. Steps: checkout,
`npm install`, `npm run scan`, conditional commit of `data/` (skip if no diff), push with PAT.
Exit non-zero if scan process exits non-zero. Configure `GITHUB_TOKEN` env var from the repo secret.  
**Critical detail:** The data commit must use the PAT (not the default `GITHUB_TOKEN`) so the push
triggers `deploy.yml` (ADR-004 — if this is wrong, data changes silently never redeploy).  
**Dependencies:** E2-S6, PAT secret configured in repo.

### E3-S2 — `deploy.yml`: Pages build and deploy workflow
**Priority:** Must | **Size:** M | **Maps to:** Must-have #9; ADR-003, ADR-004  
GitHub Actions workflow: `on: push` to `main` filtered to `src/fe/**`, `data/**`, and build config
files; plus `workflow_dispatch`. Steps: checkout, `npm install`, copy `data/skills.json` into
`src/fe/public/data/`, `npm run build`, deploy artifact to GitHub Pages (official
`actions/deploy-pages`). Requires `pages: write`, `id-token: write` permissions.  
**Dependencies:** E4-S4 (frontend builds without error), E1-S1 (Vite config with correct `base`).

### E3-S3 — Confirm PAT secret is configured in GitHub repo settings
**Priority:** Must | **Size:** XS | **Maps to:** Must-have #5; ADR-001 implementation notes  
Non-code task: verify the `GITHUB_TOKEN` PAT secret exists in the repo's Actions secrets with the
correct scopes (public repo read for API calls; repo write for the data commit push). Document the
secret name expected by `scan.yml`.  
**Dependencies:** Repo exists; owner has access.

### E3-S4 — `npm run typecheck` wired into CI
**Priority:** Must | **Size:** XS | **Maps to:** ADR-005 (TypeScript decision)  
Add a typecheck step to both workflows (or a separate `ci.yml`). TypeScript errors block merge.  
**Dependencies:** E1-S1 (tsconfig), E1-S2 (types).

---

## Epic 4: Frontend

React/Vite SPA per ADR-005. Builds against the ADR-002 types. Five small components.

### E4-S1 — App component: data fetch, status states (loading/error/ready)
**Priority:** Must | **Size:** M | **Maps to:** Must-have #6; ADR-003, ADR-005  
`App` component (`.tsx`): fetches `${import.meta.env.BASE_URL}data/skills.json` on mount. Manages
`status: 'loading' | 'error' | 'ready'`, `skills: SkillEntry[]`, `metadata`, and `query: string`.
Renders a loading state, an error state (with message), and the ready state. Defensively defaults
`null` `name`/`description` fields at render.  
**Dependencies:** E1-S1, E1-S2.

### E4-S2 — SearchBar component (controlled, autofocus)
**Priority:** Must | **Size:** S | **Maps to:** Must-have #7; ADR-005  
Controlled text input that lifts `query` via callback. Autofocuses on mount. Clears back to full list
when input is cleared.  
**Dependencies:** E4-S1.

### E4-S3 — SkillList + SkillCard components
**Priority:** Must | **Size:** M | **Maps to:** Must-have #6; ADR-005  
`SkillList` receives the filtered `SkillEntry[]` (filtered in `App` via `useMemo`, case-insensitive
match on `name` + `description`). Renders `SkillCard` per entry (keyed on `repo + '/' + path`),
or an empty-state message when `skills.length === 0` and query is empty, or a "no results" message
when query matches nothing.  
Each `SkillCard` displays: skill name, description, source repo (linked to `repoUrl`).  
**Dependencies:** E4-S1, E1-S2.

### E4-S4 — CopyButton component (Clipboard API + "Copied!" feedback)
**Priority:** Must | **Size:** S | **Maps to:** Must-have #8; success-metrics.md (console.log placeholder)  
`CopyButton` writes `npx skills add ${repoUrl} --skill ${skillName}` to the clipboard via
`navigator.clipboard.writeText()`. On success: shows "Copied!" feedback (timeout reset). On
success: fires `console.log('install_copied', { skillName, repo })` — the Tier B analytics
placeholder (Ori's recommendation; drop-in replacement in the fast-follow).  
**Dependencies:** E4-S3, E1-S2.

### E4-S5 — Frontend unit tests (search filter, copy command string, null field handling)
**Priority:** Must | **Size:** S | **Maps to:** Must-have #7, #8; success-metrics.md  
Vitest tests: search filter reduces results correctly, command string is exactly right, null
name/description renders without crash.  
**Dependencies:** E4-S1 through E4-S4.

---

## Epic 5: Launch Content Gate

This is not code. It is the highest-impact risk in the project (flagged by BA, Data Analyst, and
requirements risk table). A technically-perfect scan against repos with no SKILL.md files produces
`skillCount = 0` and a deployed empty catalog — a passing CI run that is not a success.

### E5-S1 — Confirm configured repos contain SKILL.md files before launch
**Priority:** Must | **Size:** XS (ops) | **Maps to:** Must-have #2 (acceptance: graceful skip); success-metrics.md A2 target (>= 5 skills)  
Before the first production scan: manually verify that the repos in `src/scan/repos.json` contain
SKILL.md files discoverable by the L1–L3 layout rules. Coordinate with skill authors if needed.
The launch gate (success-metrics.md section 4) requires `skillCount >= 1` — confirm this is
achievable with the seeded repo list before go/no-go.  
**Dependencies:** E2-S1 (repos.json exists), E2-S6 (scanner can be run locally to verify).

---

## Epic 6: QA Sign-Off

### E6-S1 — End-to-end QA: scanner run produces valid output
**Priority:** Must | **Size:** S | **Maps to:** Must-have #2, #3, #4; success-metrics.md at-launch checks  
Run scanner end-to-end against the configured repos. Verify: `data/skills.json` is valid JSON, schema
matches ADR-002, `skillCount >= 1`, `reposFailed < repoCount`, scan completes under 60 seconds.

### E6-S2 — End-to-end QA: deployed frontend against live Pages URL
**Priority:** Must | **Size:** S | **Maps to:** Must-have #6, #7, #8, #9; ADR-003 risk  
Verify against the live GitHub Pages URL (not localhost): `data/skills.json` is fetchable at the
correct base path, all skill cards render, search filters correctly, copy button writes the correct
command to clipboard, no console errors on Chrome and Firefox.

### E6-S3 — Playwright e2e: copy-install, search, empty/error states
**Priority:** Should | **Size:** M | **Maps to:** Must-have #6, #7, #8  
Playwright tests covering: copy-install happy path, search narrows results, empty state shows
message, error state (mocked fetch failure) shows message.  
**Rationale:** This provides regression coverage but can be started in parallel with scanner work and
completed before final gate. If time is critically short, E6-S1 and E6-S2 manual checks satisfy the
ship gate; Playwright becomes a fast-follow.

---

## Nice-to-Haves (v1 eligible if time allows)

### N1 — Last-scanned timestamp in footer
**Priority:** Should | **Size:** XS | **Maps to:** Nice-to-have #3; ADR-002, ADR-005  
Render `metadata.lastScanned` in the frontend footer. The data is already in the envelope (free);
this is a one-component addition.  
**Rationale:** Near-zero cost since the envelope already carries it. Include if any time remains after
must-haves. Flagged in ADR-005 as worth doing.

### N2 — Scan-on-push to `main` trigger for `scan.yml`
**Priority:** Could | **Size:** XS | **Maps to:** Nice-to-have #4; ADR-004  
Add `push` to `main` as an additional trigger on `scan.yml`. Useful during development. ADR-004
notes this as a future add; add it now if DevOps has a spare cycle.  
**Rationale:** Low-effort. Risk: scanning on every frontend commit is slightly wasteful but not harmful.

---

## Won't (v1) — Explicitly Deferred

| Item | Why deferred | Target phase |
|------|-------------|-------------|
| Skill detail view / expanded card (nice-to-have #1) | Requires modal or router; non-trivial UX + build time; no must-have dependency | Phase 2 |
| Filter by tag/category (nice-to-have #2) | Requires schema extension (tags field) and filter UI; no tags in v1 SKILL.md schema | Phase 2 |
| Per-repo JSON files (nice-to-have #5) | Debug convenience; no user-facing value; additive later without schema change (ADR-002) | Phase 2 |
| Usage analytics / Tier B metrics (success-metrics.md) | Fast-follow per Ori's recommendation; Tier A metrics sufficient for launch health; would require tool choice, integration, and CSP verification | Fast-follow (1 sprint post-launch) |
| Dynamic repo discovery | Out of scope per requirements | Not planned |
| Authentication / user accounts | Out of scope per requirements | Not planned |

---

## Backlog Summary

| Epic | Stories | Priority | Total size |
|------|---------|----------|-----------|
| E1: Data contract + scaffolding | E1-S1, E1-S2, E1-S3 | Must | S+S+XS |
| E2: Scanner core | E2-S1 through E2-S7 | Must | XS+S+M+M+S+S+M |
| E3: CI/CD pipeline | E3-S1 through E3-S4 | Must | M+M+XS+XS |
| E4: Frontend | E4-S1 through E4-S5 | Must | M+S+M+S+S |
| E5: Launch content gate | E5-S1 | Must | XS |
| E6: QA sign-off | E6-S1, E6-S2 (Must); E6-S3 (Should) | Must/Should | S+S+M |
| N: Nice-to-haves | N1, N2 | Should/Could | XS+XS |
