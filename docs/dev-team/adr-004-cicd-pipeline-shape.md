# Architecture Decision Record (ADR)
**ADR Number:** ADR-004
**Title:** Two workflows — a scheduled scanner that commits `data/`, and a Pages deploy triggered by data/code changes
**Author:** Marcus Chen (Solution Architect)
**Date:** 2026-06-04
**Status:** Proposed

---

## Context

Two automated concerns share the `main` branch:

1. **The scanner** runs on a schedule, regenerates `data/skills.json`, and commits the result so the
   catalog stays fresh (must-have #5).
2. **The Pages build/deploy** turns `src/fe` + `data/` into the deployed static site (must-have #9).

These can step on each other. The classic failure modes are: a deploy loop (a workflow's own commit
re-triggers it forever), a race on `main` (scan push and a manual push collide), and the subtler one
from ADR-003 — **a data-only commit must trigger a redeploy**, or the live site silently lags the
data. This ADR sets the *shape* and *trigger model* for DevOps. It deliberately does **not** write the
YAML — that's DevOps' deliverable (deployment runbook / workflow files).

Constraints: PAT is an Actions secret (OQ-3); whole scan + commit must finish under 60s for sub-20
repos (must-have #5, NFR); GitHub Pages is the deploy target.

---

## Decision Drivers

1. **No deploy loops / no infinite re-triggering** — a workflow's own commit must not endlessly re-fire it.
2. **A data change must reach production** — closes the ADR-003 freshness gap.
3. **Separation of concerns** — scanning (Node + PAT, writes to git) and deploying (build + Pages
   permissions) are different jobs with different secrets and failure modes.
4. **Simple to operate and reason about** for a one-week build and a small team.

---

## Options Considered

### Option 1: Two workflows — `scan.yml` (cron, commits data) + `deploy.yml` (triggered by changes)

- **`scan.yml`** — `on: schedule` (daily cron) + `workflow_dispatch` (manual). Runs `npm install`,
  runs the scanner, and **commits `data/` only if it changed** (no-op otherwise, no empty commit).
- **`deploy.yml`** — `on: push to main` filtered to relevant paths (`src/fe/**`, `data/**`,
  build config), plus `workflow_dispatch`. Runs `npm run build` and deploys to Pages.

The scan's data commit lands on `main` and **triggers `deploy.yml`** via the push event, so fresh
data is published automatically.

**Pros:**
- **Clean separation**: the scanner needs the PAT and write access; the deployer needs Pages
  permissions and a build. Different concerns, different jobs, smaller blast radius each.
- **Data-driven redeploy falls out naturally** — scan commits to `main`, push triggers deploy. Closes
  the ADR-003 gap with zero extra wiring beyond the path filter.
- Each workflow is independently re-runnable and debuggable.

**Cons:**
- Cross-workflow triggering caveat: commits made with the default `GITHUB_TOKEN` **do not trigger
  other workflows** (GitHub's loop-prevention). The scanner must push its data commit with the **PAT**
  (which we already have as a secret) so the push event reaches `deploy.yml`. This is a known,
  documented mechanism — but it must be set up deliberately.
- Two files to maintain instead of one.

**Estimated effort:** Medium

---

### Option 2: One workflow — scan, then build+deploy in sequence

A single `pipeline.yml` on cron (and push): scan -> commit data -> build -> deploy, all in one run.

**Pros:**
- One file; the order is explicit and linear; no cross-workflow trigger subtlety.
- The just-scanned data is guaranteed to be what gets deployed in that run.

**Cons:**
- **Couples concerns**: a scanner change can break the deploy job and vice versa; both share one
  permission set (PAT *and* Pages).
- A **push to `main`** (e.g. a frontend tweak) would either re-run the scanner unnecessarily or need
  branching logic inside the job to decide what to do — more conditional complexity in one place.
- Still must guard against its **own** data commit re-triggering the workflow on push (loop risk),
  which means path/author filtering anyway — so it doesn't actually escape the trigger reasoning.

**Estimated effort:** Medium

---

### Option 3: Scan commits data; Pages deploys from a branch/`docs` automatically (no deploy workflow)

Use the "deploy from branch" Pages mode; the scan's commit to `main` causes Pages to rebuild.

**Pros:**
- No deploy workflow to maintain.

**Cons:**
- "Deploy from branch" serves files **as-is**; it does **not** run `npm run build`. A Vite app needs a
  build step, so this only works if we commit `dist/` — which pollutes git history and re-introduces
  loop/race concerns on a build artifact. Poor fit for a Vite SPA.

**Estimated effort:** Small (but wrong tool)

---

## Decision

**We will: Option 1 — two workflows.** A scheduled `scan.yml` that commits `data/` changes using the
PAT, and a `deploy.yml` triggered by pushes to `main` on relevant paths (plus `workflow_dispatch`)
that builds with Vite and deploys to Pages.

Two workflows keep the scanner's concerns (PAT, git write) and the deployer's concerns (build, Pages)
cleanly separated, each independently re-runnable. Crucially, because the scanner pushes its data
commit with the **PAT** (not the default `GITHUB_TOKEN`), that push **triggers the deploy** — which is
exactly the "a data change must reach production" driver, closing the ADR-003 freshness gap with no
extra glue. We accept the one subtlety (PAT-push to enable cross-workflow trigger) as a well-understood
GitHub behavior, documented here so the next maintainer isn't surprised.

### Trigger / behavior model
| Workflow | Triggers | Does | Loop guard |
|----------|----------|------|-----------|
| `scan.yml` | `schedule` (daily cron) + `workflow_dispatch` | `npm install`; run scanner; **commit `data/` only if changed**; push with **PAT** | It does not listen to `push`, so its own commit can't re-trigger it |
| `deploy.yml` | `push` to `main` filtered to `src/fe/**`, `data/**`, build config + `workflow_dispatch` | `npm install`; `npm run build` (copies `data/` into the artifact per ADR-003); deploy to Pages | Build/deploy makes **no commits to `main`**, so it can't re-trigger itself |

- **No empty commits:** the scanner checks `git status --porcelain` (or equivalent) and only commits
  when `data/` actually changed (must-have #5 acceptance). Stable sort in ADR-002 keeps diffs minimal.
- **Race on `main`:** at sub-20-repo cadence (daily) the window is tiny; the scan job should `git pull
  --rebase` (or fail-and-retry on push rejection) before pushing. No locking needed at v1 scale.
- **Nice-to-have #4 (scan on push to `main`):** can be added to `scan.yml`'s triggers later; left off
  by default to avoid scanning on every frontend commit.

---

## Consequences

### Positive
- Concerns, permissions, and failure domains are separated; each workflow is small and re-runnable.
- Fresh data auto-publishes: scan commit (via PAT) -> push event -> deploy. The ADR-003 gap is closed.
- No `dist/` in git history; build happens in CI where it belongs.

### Negative
- **Hard dependency on pushing the data commit with the PAT**, not `GITHUB_TOKEN`. If someone "fixes"
  the scanner to use the default token, deploys silently stop firing on data changes. Documented here
  and must be called out in the runbook.
- Two workflow files to keep coherent.

### Neutral / Watch
- If the daily scan and a human push ever collide on `main`, the rebase-before-push handles it; watch
  CI logs for push rejections. Revisit only if cadence increases dramatically.
- Pages deployment uses the official Pages deploy path (artifact upload + deploy), which needs the
  workflow's `pages: write` / `id-token: write` permissions — DevOps to wire.

---

## The Road Not Taken

**Single combined workflow (Option 2)** was the runner-up; it's conceptually linear and guarantees the
deployed data matches the just-run scan. We rejected it because it couples two different permission
sets and failure modes into one job and pushes branching logic inside it, without actually escaping the
trigger reasoning. We'd revisit a merge if maintaining two files proves error-prone. **Deploy-from-branch
(Option 3)** is the wrong tool for a build-step SPA.

---

## Implementation Notes (for DevOps — direction, not YAML)

- Scanner commit/push step **must authenticate with the PAT secret** so the push triggers `deploy.yml`.
- `scan.yml`: cron daily; `npm install`; run the scanner; conditional commit (skip if no `data/` diff);
  rebase-before-push. Exit non-zero only if all repos failed (ADR-001 / must-have #2).
- `deploy.yml`: trigger on `push` to `main` with path filter `['src/fe/**','data/**', build config]`,
  plus `workflow_dispatch`; `npm run build` (which lands `data/skills.json` in the artifact per ADR-003);
  upload + deploy to Pages with the required Pages permissions.
- The 60s NFR is for **scan + commit**, not the deploy. Confirm the scanner's own runtime with the Lead.
- PAT scope: a public-repo read PAT for the API calls; the commit/push uses repo write — confirm whether
  one PAT covers both or two secrets are cleaner (DevOps' call; flag in runbook).

---

## Links

- `requirements.md` must-have #5, #9; nice-to-have #4; "workflow race condition" risk row
- ADR-001 (what the scanner does), ADR-002 (what it commits), ADR-003 (why a data commit must redeploy)
