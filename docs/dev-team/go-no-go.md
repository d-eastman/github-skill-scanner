# Go / No-Go Assessment — GitHub Skill Scanner v1
**Author:** Sasha Kowalski (Product Manager)
**Date:** 2026-06-04
**Artifact type:** PM Go/No-Go recommendation — final ship authorization is the stakeholder's decision.

---

## 🚀 LAUNCHED — 2026-06-05

**The conditional GO is satisfied. v1 is live.** The stakeholder (David Eastman) completed the full
launch checklist (git push, `SCAN_PAT` secret, Pages = GitHub Actions, first scan + auto-deploy) and
**verified step 6 in a live browser: the deployed app renders skill cards.** The "works in dev, 404s
in prod" base-path gate — the one risk that could not be closed pre-deploy — is now **closed by live
confirmation.** No Critical/High defects open; SEC-001 fixed pre-launch. Remaining work is the
documented fast-follow backlog below (TD-003 e2e, TD-007 aria-busy, TD-008 fetch size cap, TD-009
vitest upgrade, fetch-failure error-state test).

---

## Decision

**GO — conditional.** *(Condition met 2026-06-05 — see launch banner above.)*

The team has hit every non-negotiable from the phase plan. The codebase is clean, the data contract is live, 61 tests pass, the critical RCE was fixed and regression-tested before this call, and a real scan against the live `anthropics/skills` repo produced 18 valid skills — clearing the launch content gate (skillCount >= 1) with margin. There are no open Critical or High severity defects. The residual risks are documented, bounded, and carry a fast-follow plan.

The condition: the stakeholder must complete the operator checklist below and then verify the live Pages URL before declaring v1 publicly shipped. The "works in dev, 404s in prod" base-path risk has not been closed — it cannot be closed until the site is deployed. That verification is the last gate and it is the stakeholder's to run.

The PM recommendation is GO. The stakeholder makes the final ship call.

---

## What Ships in v1

Everything on the must-do list shipped. Nothing on the must-do list was cut.

### In v1

| Item | Status |
|------|--------|
| Repository scaffold, Vite config, TypeScript config (E1-S1) | Shipped |
| Shared `SkillEntry` / `SkillsCatalog` types — data contract (E1-S2) | Shipped |
| `data/README.md` schema documentation (E1-S3) | Shipped |
| `repos.json` static config — `anthropics/skills` (E2-S1) | Shipped |
| Authenticated GitHub API client (E2-S2) | Shipped |
| Git Trees API enumeration — L1/L2/L3 layouts (E2-S3) | Shipped |
| SKILL.md frontmatter extraction, null-tolerant (E2-S4) | Shipped |
| JSON envelope writer with metadata fields (E2-S5) | Shipped |
| Scanner entry point — `npm run scan` (E2-S6) | Shipped |
| Scanner unit tests (E2-S7) | Shipped |
| App component + fetch lifecycle + all 5 states (E4-S1) | Shipped |
| SearchBar — controlled, autofocus (E4-S2) | Shipped |
| SkillList + SkillCard — filtered list, empty/no-results (E4-S3) | Shipped |
| CopyButton — clipboard API, "Copied!" feedback, console.log placeholder (E4-S4) | Shipped |
| Frontend unit tests (E4-S5) | Shipped |
| scan.yml — cron + PAT commit trigger (E3-S1) | Shipped |
| deploy.yml — push trigger, Vite build, Pages deploy (E3-S2) | Shipped |
| Typecheck in CI (E3-S4) | Shipped |
| Launch content gate — 18 skills confirmed from live scan (E5-S1) | Cleared |
| SEC-001 RCE fix (gray-matter js engine disabled) + 3 regression tests | Shipped |
| SEC-002 runbook PAT scope overage — corrected (doc fix) | Shipped |

### Explicitly Deferred

These are cut or deferred per prior scope decisions (see scope-decision-log.md). No change from the original cut line — nothing was cut under pressure; everything below was pre-agreed.

| Item | Status | Target |
|------|--------|--------|
| Playwright e2e tests (E6-S3) | Cut — manual QA satisfies ship gate | Fast-follow (TD-003) |
| Last-scanned timestamp footer (N1) | Cut — data is in envelope; one component | Phase 2 |
| Scan-on-push trigger (N2) | Cut — daily cron is sufficient for v1 | Phase 2 |
| Usage analytics / Tier B metrics | Out of v1 (console.log placeholder is in) | Fast-follow |
| Skill detail view / expanded card | Out of v1 | Phase 2 |
| Filter by tag / category | Out of v1 | Phase 2 |
| Per-repo JSON debug files | Out of v1 | Phase 2 |
| Router / state library | Not planned for v1 | Phase 2 conditional |
| Dynamic repo discovery | Not planned | Not planned |
| `aria-busy` on loading container (BUG-001) | Known gap, Low severity, TD-007 | A11y fast-follow |
| fetch failure → error-state automated test | Not written; manual/code-verified only | Fast-follow |
| SEC-003 fetch size limit | TD-008 | Fast-follow (first sprint) |
| SEC-005 vitest v4 upgrade | TD-009 / TD-001 | Fast-follow (first sprint) |

### What Was Pulled Up (Not Pre-Planned)

| Item | Reason |
|------|--------|
| SEC-001 fix + 3 regression tests | Critical RCE; non-negotiable; done before this call |
| SEC-002 runbook correction | Doc-only, low cost, correct before any stakeholder follows the runbook |

---

## Launch Checklist — Ordered Operator Steps

These are the steps a human with admin rights on the repository must complete. They cannot be automated or done by the team. Complete them in order.

**Step 1 — Initialize the git repository and push to GitHub**

The working directory is not a git repo. Before any of the CI/CD workflows can run, the code must be on GitHub.

```
git init
git add .
git commit -m "feat: initial GitHub Skill Scanner v1"
git branch -M main
git remote add origin https://github.com/<your-username>/github-skill-scanner.git
git push -u origin main
```

The repository name on GitHub must be `github-skill-scanner` (exact, case-sensitive) or the Vite base path will be wrong and the deployed site will 404.

**Step 2 — Create the fine-grained PAT**

GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token.

- Name: `github-skill-scanner-scan`
- Expiration: 1 year (set a calendar reminder)
- Resource owner: your GitHub account
- Repository access: Only `github-skill-scanner`
- Repository permissions: Contents = Read and write; Metadata = Read-only

If fine-grained tokens are not available, use a Classic PAT with scope `public_repo` only. Do not use `repo` scope. The runbook (deployment-runbook.md Step 1) has the full guidance.

**Step 3 — Add the PAT as a repository secret**

Repository > Settings > Secrets and variables > Actions > New repository secret.
- Name: `SCAN_PAT` (exact — the workflows reference this name)
- Value: the PAT from Step 2

**Step 4 — Enable GitHub Pages**

Repository > Settings > Pages > Build and deployment > Source: set to "GitHub Actions". Do not select a branch. Save.

**Step 5 — Trigger the first scan manually**

Actions tab > "Scan" workflow > Run workflow > Run workflow on `main`.

Watch the run to completion. Confirm:
- The scan step logs `Wrote 18 skills to ...data/skills.json (1/1 repos succeeded)` (or similar)
- The commit-and-push step completes without error
- The "Deploy" workflow fires automatically within ~30 seconds of the scan completing

Expected total time: scan ~60 seconds, deploy ~2-3 minutes.

**Step 6 — Post-deploy verification (the last gate)**

This step closes the one open risk the team cannot close: the live Pages URL fetch path.

Open a browser and go to:
```
https://<your-username>.github.io/github-skill-scanner/data/skills.json
```

Confirm: the JSON loads and `skillCount` is >= 1 (should be 18).

Then go to:
```
https://<your-username>.github.io/github-skill-scanner/
```

Confirm all of the following:
- Skill cards are visible (not the "No skills found yet." empty state)
- The search input receives focus automatically
- Typing a partial skill name filters the list in real time
- Clicking "Copy" on any card copies the command to the OS clipboard (paste into a terminal or text editor to verify the text)
- No errors appear in the browser console (Chrome DevTools: open console, reload, look for red errors)
- Repeat in Firefox

If `data/skills.json` returns 404: see the Pages 404 / base-path mismatch section in deployment-runbook.md. The most likely cause is a repository name that does not exactly match `github-skill-scanner`.

If the skill cards are absent (empty state) but the JSON URL works: the deploy completed before the first scan pushed data. Trigger a manual deploy (Actions > Deploy > Run workflow) to pick up the fresh data.

**Step 7 — Declare v1 shipped**

After Step 6 passes, v1 is live. Announce and share the URL.

---

## Accepted Residual Risks

These risks are accepted for v1. Each has a documented fast-follow.

### Risk 1 — Live Pages URL fetch unverified until deploy
**Severity:** Medium (production-only failure mode; no workaround if it fires)
**What it is:** The base-path fetch of `/github-skill-scanner/data/skills.json` is correct per ADR-003 and confirmed in the build artifact, but has never been exercised against the real Pages HTTPS endpoint. If the repository name on GitHub does not exactly match `github-skill-scanner`, or if the Vite base config is wrong, the deployed frontend will silently show the error state.
**Mitigation in v1:** Step 6 of the launch checklist. This is the purpose of that step.
**Fast-follow:** Playwright e2e tests (TD-003) will catch this regression automatically after launch.

### Risk 2 — No automated test for fetch-failure error state
**Severity:** Low (code path is verified by inspection; UI state renders correctly; "Loading skills..." text is present; role="alert" is on the error container)
**What it is:** TC-050 (fetch fails → error message rendered) is not covered by any automated test. The App component's fetch error path is code-correct but untested.
**Mitigation in v1:** Code inspection confirms `role="alert"` is on the error container; the error branch is structurally correct. Manual verification is possible post-deploy by temporarily pointing fetch at a bad URL.
**Fast-follow:** Add an App-level unit test that mocks fetch to reject. One test, ~30 minutes. First sprint post-launch.

### Risk 3 — SEC-003: No fetch size limit on SKILL.md content (TD-008)
**Severity:** Medium (scanner-side; exploitable only by a repo maintainer inserting a maliciously large SKILL.md)
**What it is:** The scanner fetches SKILL.md content with no byte limit. A very large file could cause memory pressure or OOM on the Actions runner.
**Accepted because:** The configured repo (`anthropics/skills`) is a trusted, Anthropic-owned repository. The attack surface is limited to maintainers of explicitly configured repos in `repos.json`. The scanner does not execute file content; it only parses frontmatter.
**Fast-follow (TD-008):** Add a 1 MB byte limit in `src/scan/fetcher.ts`; skip and warn on files that exceed it. First sprint post-launch.

### Risk 4 — SEC-005 / TD-001 / TD-009: vitest CVE (GHSA-5xrq-8626-4rwp)
**Severity:** Low (dev-only; `vitest --ui` is never invoked; production audit shows 0 vulnerabilities)
**What it is:** vitest < 4.1.0 has a CVE in the vitest UI server. The project uses vitest run, not vitest UI. The vulnerability is in the dev tool only and is not reachable in CI or in the deployed frontend.
**Accepted because:** Zero production exposure. `npm audit --omit=dev` is clean.
**Fast-follow (TD-009):** Upgrade vitest to v4 in first sprint post-launch after reviewing the v4 migration guide. Batched with any other dependency updates.

### Risk 5 — BUG-001 / TD-007: aria-busy missing during loading state
**Severity:** Low (screen reader UX polish gap; "Loading skills..." text is present and readable)
**What it is:** The list container does not carry `aria-busy="true"` while data is fetching. Screen readers navigating to the list container during load will not receive a busy-state signal. The loading text is still present in the DOM.
**Accepted because:** Low severity per QA. The workaround (visible loading text in the DOM) is present. This is a one-line fix.
**Fast-follow (TD-007):** Add `aria-busy={status === 'loading'}` to the `<section aria-label="Skill catalog">` element in App.tsx. First a11y fast-follow sprint.

### Risk 6 — PAT expiry (operational)
**Severity:** Medium (when it fires, scans stop and the catalog goes stale)
**What it is:** Fine-grained PATs expire. When `SCAN_PAT` expires, scan.yml will fail silently from the user's perspective (the catalog will show stale data; no error is surfaced on the frontend until the data is very stale).
**Mitigation in v1:** The runbook instructs a 1-year expiry and a calendar reminder.
**Fast-follow:** Add a GitHub Actions notification on scan workflow failure (Slack or email). Noted in deployment-runbook.md Observability section.

---

## Launch Readiness Statement

The GitHub Skill Scanner v1 build is ready to ship. The critical security vulnerability (SEC-001, RCE via gray-matter's js engine) was identified in the security review, fixed before this go/no-go call, and covered by three new regression tests — it is not leaving the codebase. The data pipeline worked end-to-end against a real repo in the real world and produced 18 valid skills conforming to the ADR-002 contract, clearing the content gate that the team committed to as a hard ship criterion. All 61 tests pass, typecheck is clean, and there are no open Critical or High severity defects. The six residual risks documented above are bounded, understood, and each carries a concrete fast-follow that fits in the first post-launch sprint. The one gate that cannot be cleared until after deploy — confirming the live Pages URL fetches the skills JSON correctly — is step 6 of the launch checklist and is the stakeholder's to run. Once that verification passes, v1 is live.

---

## Post-Launch Fast-Follow (First Sprint)

In priority order:

1. **Playwright e2e tests (TD-003)** — copy-install, search, empty/error state, base-path fetch. This is the most valuable test gap.
2. **Fetch-failure error-state unit test** — mock fetch to reject in App test; close the TC-050 gap.
3. **SEC-003 fetch size limit (TD-008)** — 1 MB cap in `src/scan/fetcher.ts`. Medium severity, low effort.
4. **aria-busy on loading container (TD-007 / BUG-001)** — one-line fix in App.tsx.
5. **vitest v4 upgrade (TD-009 / TD-001)** — CVE remediation; review migration guide first.
6. **Tier B analytics (console.log → real tool)** — Plausible or equivalent, per success-metrics.md recommendation.
7. **Last-scanned footer (N1)** — surface `metadata.lastScanned` in the UI footer; data is already in the envelope.
