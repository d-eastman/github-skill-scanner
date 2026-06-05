# Phase Plan
**Project:** GitHub Skill Scanner  
**Phase:** Phase 1 — v1 Complete (scanner + pipeline + frontend + launch)  
**Author:** Sasha Kowalski (Product Manager)  
**Date:** 2026-06-04  
**Target duration:** 5 days — 2026-06-04 (Thu) to 2026-06-10 (Wed)

---

## Phase Goal

A scheduled GitHub Action scans configured repos, writes a valid `data/skills.json` with real
skills, and a deployed GitHub Pages frontend lets a developer search the catalog and copy an
`npx install` command to their clipboard — all without manual intervention.

---

## Non-Negotiables (The Hills)

- **PM (Sasha):** Ships by end of day 2026-06-10. The runway is this week. Scope gets cut before the date moves.
- **Lead Developer:** No merge without green `typecheck` and `test` — TypeScript errors and failing unit tests don't land on `main`.
- **QA:** The deployed frontend must be manually verified against the live Pages URL (not localhost) before go/no-go. The "works in dev, 404s in prod" risk is explicit in ADR-003 and failure here is not acceptable.
- **PM:** The launch content gate (E5-S1) is a ship gate. We do not declare v1 shipped if `skillCount = 0` on the first real scan.
- **DevOps:** The scanner data commit must push with the PAT, not the default `GITHUB_TOKEN`. This is a hard correctness requirement from ADR-004 — if this is wrong, data changes silently never trigger a redeploy.

---

## Critical Path

The data contract (ADR-002 shared types) is the single critical-path blocker. Neither the scanner
nor the frontend can build against it until it is committed.

```
E1-S1 (scaffold) → E1-S2 (shared types)
                          │
              ┌───────────┴────────────┐
              ▼                        ▼
    SCANNER TRACK                FRONTEND TRACK
    E2-S1 repos config           E4-S1 App + fetch
    E2-S2 API client             E4-S2 SearchBar
    E2-S3 tree enumeration       E4-S3 SkillList + SkillCard
    E2-S4 frontmatter parse      E4-S4 CopyButton
    E2-S5 JSON writer            E4-S5 Frontend tests
    E2-S6 entry point
    E2-S7 Scanner tests
              │                        │
              └───────────┬────────────┘
                          ▼
              E3-S1 scan.yml  +  E3-S2 deploy.yml
              E3-S3 PAT configured
              E3-S4 typecheck in CI
                          │
                          ▼
              E5-S1 launch content gate
                          │
                          ▼
              E6-S1 scanner QA + E6-S2 Pages QA
                          │
                          ▼
                      GO / NO-GO
```

The two tracks (scanner, frontend) can run **in parallel** once E1-S2 is committed — this is the
primary parallelization opportunity in a five-day build.

---

## Build Sequence (Day by Day)

### Day 1 (Thu 2026-06-04) — Contract first
**Owner: Lead Developer**

1. E1-S1 — Repository scaffold, Vite config (`base: '/github-skill-scanner/'`), tsconfig, Prettier, package.json commands.
2. E1-S2 — Shared `SkillEntry` / `SkillsCatalog` TypeScript interfaces committed to `src/types/skills.ts`.
3. E1-S3 — `data/README.md` schema documentation.
4. E2-S1 — `src/scan/repos.json` with at least one confirmed real repo.
5. E3-S3 — PAT secret configured in GitHub repo settings (non-code gate; unblock E3-S1 early).

Exit condition for Day 1: `src/types/skills.ts` is committed; both tracks can start independently on Day 2.

---

### Day 2 (Fri 2026-06-05) — Parallel build begins

**Scanner track (Lead Developer or Junior):**
- E2-S2 — API client module (authenticated fetch wrapper).
- E2-S3 — Git Trees API enumeration with L1–L3 layout matching.

**Frontend track (Lead Developer or Junior):**
- E4-S1 — `App` component with fetch lifecycle and three status states.
- E4-S2 — `SearchBar` (controlled, autofocus).

Exit condition for Day 2: Both tracks are independently running and rendering something (even against stubbed/empty data).

---

### Day 3 (Mon 2026-06-09) — Core features complete

**Scanner track:**
- E2-S4 — SKILL.md raw fetch and frontmatter extraction.
- E2-S5 — JSON envelope writer (with metadata fields).
- E2-S6 — Scanner entry point wired; `npm run scan` runs end-to-end.

**Frontend track:**
- E4-S3 — `SkillList` + `SkillCard` (with filtered list, empty/no-results states).
- E4-S4 — `CopyButton` (Clipboard API, "Copied!" feedback, `console.log` placeholder).

Exit condition for Day 3: `npm run scan` produces a valid `data/skills.json`; frontend renders cards from a local copy of it; copy button works.

---

### Day 4 (Tue 2026-06-09) — Tests, CI/CD, and integration

- E2-S7 — Scanner unit tests (layout matching, frontmatter parse, error paths).
- E4-S5 — Frontend unit tests (search filter, command string, null handling).
- E3-S1 — `scan.yml` workflow (cron + PAT commit).
- E3-S2 — `deploy.yml` workflow (push trigger, Vite build, Pages deploy).
- E3-S4 — Typecheck in CI.

Exit condition for Day 4: Both workflows pass in GitHub Actions. `deploy.yml` deploys to Pages. `scan.yml` runs manually via `workflow_dispatch` and commits `data/`.

---

### Day 5 (Wed 2026-06-10) — QA, launch content gate, go/no-go

- E5-S1 — Confirm `repos.json` repos have real SKILL.md files; run `npm run scan` locally to verify `skillCount >= 1`.
- E6-S1 — Scanner end-to-end QA (valid JSON, schema correct, under 60 seconds, at least 1 skill).
- E6-S2 — Live Pages URL QA (fetch path correct, cards render, search works, copy writes correct command, no console errors in Chrome + Firefox).
- N1 — Last-scanned footer (if there's any time left — it's one component, ~30 minutes).
- **Go/no-go call** at end of Day 5.

---

## Must-Do Work (Priority Order)

Items ordered by criticality. If time runs out, cut from the bottom up.

1. **E1-S1** — Scaffold — Owner: Lead Developer — Depends on: Nothing
2. **E1-S2** — Shared types (data contract) — Owner: Lead Developer — Depends on: E1-S1
3. **E2-S3** — Git Trees enumeration — Owner: Lead/Junior — Depends on: E1-S2, E2-S2
4. **E2-S4** — Frontmatter extraction — Owner: Lead/Junior — Depends on: E2-S3
5. **E2-S5** — JSON writer + metadata envelope — Owner: Lead/Junior — Depends on: E2-S4
6. **E4-S1** — App component + data fetch — Owner: Lead/Junior — Depends on: E1-S2
7. **E4-S3** — SkillList + SkillCard — Owner: Lead/Junior — Depends on: E4-S1
8. **E4-S4** — CopyButton — Owner: Lead/Junior — Depends on: E4-S3
9. **E3-S1** — scan.yml — Owner: DevOps — Depends on: E2-S6, E3-S3
10. **E3-S2** — deploy.yml — Owner: DevOps — Depends on: E4-S4 (frontend builds), E1-S1
11. **E5-S1** — Launch content gate (confirm repos have SKILL.md) — Owner: PM + Lead
12. **E6-S1** — Scanner QA — Owner: QA — Depends on: E2-S6, E3-S1
13. **E6-S2** — Live Pages QA — Owner: QA — Depends on: E3-S2 deployed
14. **E2-S7** — Scanner unit tests — Owner: Lead/Junior — Depends on: E2-S3, E2-S4
15. **E4-S5** — Frontend unit tests — Owner: Lead/Junior — Depends on: E4-S1–E4-S4

---

## Nice-to-Have Work

These are included only if Day 5 has slack. They will not delay the go/no-go call.

- **N1 — Last-scanned footer** (~30 min): render `metadata.lastScanned` in the UI footer. Data is already in the envelope; this is one component. Include if any time remains before go/no-go.
- **E6-S3 — Playwright e2e tests** (~3 hours): copy-install, search, empty/error state flows. High value for regression coverage. If not shipped in v1, add as a fast-follow immediately post-launch.
- **N2 — Scan-on-push trigger**: add `push` to `main` as a trigger for `scan.yml`. Useful during development; DevOps adds if no other items are blocking.

---

## Cross-Team Dependencies

| From | To | What | By when |
|------|----|------|---------|
| Lead Developer | Lead/Junior (scanner track) | E1-S2 committed (`src/types/skills.ts`) | End of Day 1 |
| Lead Developer | Lead/Junior (frontend track) | E1-S2 committed (`src/types/skills.ts`) | End of Day 1 |
| Lead Developer | DevOps | Vite config with correct `base`, build command confirmed | End of Day 1 |
| PM / Owner | DevOps | PAT secret name confirmed; PAT created with correct scopes | End of Day 1 |
| Lead Developer | DevOps | E2-S6 (`npm run scan` entry point) ready for CI wiring | End of Day 3 |
| Lead Developer | DevOps | Frontend builds without error (`npm run build`) | End of Day 4 |
| DevOps | QA | Live Pages URL (for E6-S2 verification) | End of Day 4 |
| PM | QA | Go/no-go gate criteria confirmed | Before Day 5 |

---

## Phase Gates

### Gate 1 — End of Day 1 (Thu 2026-06-04): Contract Locked
**Condition to proceed:** `src/types/skills.ts` is committed with the ADR-002 schema interfaces (`SkillEntry`, `SkillsCatalog`). `npm run typecheck` passes on the scaffolded project. `repos.json` exists with at least one real repo seeded.  
**If condition is not met:** Scanner and frontend tracks cannot parallelize. Lead Developer shifts to unblock this before anything else. PM assesses what can be cut from Day 2 to recover.  
**Owner of go/no-go call:** PM (Sasha Kowalski)

---

### Gate 2 — End of Day 3 (Mon 2026-06-09): Both Tracks Functionally Complete
**Condition to proceed:** `npm run scan` runs locally and writes a valid `data/skills.json` with `skillCount >= 1`. Frontend (`npm run dev`) fetches and renders skill cards from a local copy of that file. CopyButton copies the correct command string.  
**If condition is not met:**  
- If scanner is behind: drop E4-S5 (frontend tests) to Day 4 and allocate more dev time to scanner.  
- If frontend is behind: drop N1 (last-scanned footer) permanently; compress E4-S5 into a focused happy-path test only.  
- If both are significantly behind: invoke the cut line (see below).  
**Owner of go/no-go call:** PM (Sasha Kowalski)

---

### Gate 3 — End of Day 4 (Tue 2026-06-09): CI/CD Passing and Deployed
**Condition to proceed:** Both `scan.yml` and `deploy.yml` have passed at least one run in GitHub Actions. The frontend is live at the Pages URL. `npm run typecheck` and `npm run test` pass in CI.  
**If condition is not met:**  
- Triage CI failures as P0. DevOps and Lead unblock before starting Day 5 QA.  
- If `deploy.yml` is not passing, E6-S2 (live Pages QA) is impossible — the launch date is at risk.  
**Owner of go/no-go call:** PM (Sasha Kowalski)

---

### Final Gate — End of Day 5 (Wed 2026-06-10): Ship / No-Ship
**Ship criteria:**
- [ ] All nine must-haves have passing acceptance criteria (manual verification or automated test)
- [ ] `data/skills.json` on `main` has `skillCount >= 1` (real skills, not test fixtures)
- [ ] Live Pages URL: skill cards visible, search works, copy writes correct command, no console errors on Chrome + Firefox
- [ ] `scan.yml` has completed at least one successful scheduled or manually-triggered run that committed `data/`
- [ ] `deploy.yml` has completed at least one successful run triggered by the scan data commit (confirming the PAT cross-trigger works)
- [ ] QA has signed off on E6-S1 and E6-S2
- [ ] `reposFailed < repoCount` on the first production scan (scanner is not failing all repos)

**If ship criteria are not met by end of Day 5:**  
Assess which criteria are failing. If it is a content problem only (skillCount = 0 because repos.json is misconfigured), fix the config and re-scan — this is not a code defect and can be resolved same-day. If it is a technical failure (deploy broken, copy command wrong), PM makes the call: 24-hour extension for a targeted fix, or declare as a known issue with a documented remediation date. We do not ship a broken core value action (copy command) under any circumstances.  
**Owner of go/no-go call:** PM (Sasha Kowalski)

---

## Cut Line

Pre-agreed order of cuts. These decisions are made now so they are not made under deadline pressure.

**If time runs out, we cut in this order:**

1. **Playwright e2e tests (E6-S3)** — Manual QA (E6-S1, E6-S2) satisfies the ship gate; Playwright becomes a fast-follow. Low risk to cut.
2. **Last-scanned footer (N1)** — Nice-to-have. The data is in the envelope and will be surfaced in Phase 2. Cut without impact to any must-have.
3. **Scan-on-push trigger (N2)** — Convenience trigger; daily cron is sufficient for v1. Cut if DevOps has no spare time.
4. **Frontend unit tests (E4-S5) — scope to happy-path only** — If time is critically short, reduce frontend tests to the command-string correctness test and null-field rendering test. Do not drop scanner tests (E2-S7) — the error-path behavior of the scanner must be verified.
5. **Per-repo debug logging and rate-limit guard details** — The scanner logs a warning; the guard is a log, not a backoff. Fine to ship minimal at v1.

**We will NOT cut:**
- The scanner core (E2-S1 through E2-S6) — without this, there is no product
- The frontend must-haves (E4-S1 through E4-S4) — without these, there is no user value
- The data contract (E1-S2) — without this, both tracks are building against air
- The launch content gate (E5-S1) — a technically-passing empty catalog is not a shipped product
- The PAT-authenticated data commit in `scan.yml` — if this is wrong, data updates silently stop deploying
- Live Pages verification (E6-S2) — the base-path fetch failure is a documented production-only risk

---

## Fractional Engagements

| Persona | Engagement | When |
|---------|-----------|------|
| DevOps | PAT secret setup, `scan.yml` and `deploy.yml` authoring, Pages permissions wiring | Day 1 (secret setup) + Day 4 (CI/CD) |
| QA | Test plan, E6-S1 scanner verification, E6-S2 live Pages verification, Playwright e2e (if time) | Day 4–5 |
| UX Designer | Light review of minimalist card layout and search/copy UX before Day 3 complete | Day 2–3 (can be async) |
| Data Analyst (Ori) | Confirm Tier A metadata fields are correctly written in E2-S5; verify `console.log` placeholder in E4-S4 | Day 3 (review) |

---

## Tensions to Resolve

| Tension | Owner | Resolve by | Notes |
|---------|-------|------------|-------|
| TypeScript scanner: `ts-node` vs `tsx` vs compiled output for the Actions runner | Lead Developer | Day 1 | Both are fine; Lead picks what makes the CI step simplest. PM does not have a preference. |
| Single PAT for both API reads and git push vs. two separate secrets | DevOps | Day 1 | ADR-004 notes this as DevOps' call; resolve in the runbook before `scan.yml` is authored. |
| `data/skills.json` copy to `public/` in build: prebuild script vs. Vite plugin vs. npm lifecycle hook | Lead Developer / DevOps | Day 3 | ADR-003 specifies the outcome (file in `dist/`); the mechanism is DevOps/Lead's call. |
| Repos in `repos.json` at launch: how many, which ones, confirmed to have SKILL.md? | PM + catalog maintainer | Day 1 | This is the launch content risk. Resolve by seeding at least one confirmed repo (e.g., `anthropics/skills`) on Day 1 and expanding the list before Day 5. |

---

## Success Criteria

How we know Phase 1 achieved its goal (drawn from success-metrics.md Tier A):

- `metadata.skillCount >= 5` on the first production scan (catalog has real content)
- `metadata.reposSucceeded / metadata.repoCount >= 0.90` (scan success rate >= 90%)
- Scan step in `scan.yml` completes in under 60 seconds (NFR met)
- `metadata.lastScanned` is within 26 hours of the current time on Day 5 (pipeline is live)
- Developer can open the Pages URL, search for a skill, and paste the copied install command into a terminal — no manual steps required

---

## Post-Phase Retrospective

*To be filled in at end of phase (2026-06-10).*

**What went well:**

**What didn't go well:**

**What we'd do differently:**

**What carries into the next phase:**
