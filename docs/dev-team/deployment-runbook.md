# Deployment Runbook
**Project:** GitHub Skill Scanner
**Author:** Fia Magnusson (DevOps)
**Date:** 2026-06-04
**Status:** Active

---

## Overview

Two GitHub Actions workflows run this project:

| Workflow | File | Trigger | Job |
|----------|------|---------|-----|
| Scan | `.github/workflows/scan.yml` | Daily cron (06:00 UTC) + manual | Runs the scanner; commits `data/skills.json` if changed; pushes with PAT |
| Deploy | `.github/workflows/deploy.yml` | Push to `main` on relevant paths + manual | Builds Vite app; deploys to GitHub Pages |

The scan's PAT-authenticated push to `main` triggers the deploy automatically. See the "Trigger chain" section below.

---

## One-Time Setup (Stakeholder Actions)

These steps cannot be automated. A human with admin rights on the repository must complete them before the first successful deploy.

### Step 1 — Create the Personal Access Token (PAT)

The scanner needs a PAT for two purposes:
1. Authenticating GitHub API requests (reading SKILL.md files from public repos)
2. Pushing the `data/skills.json` commit to `main` in a way that triggers the deploy workflow

**Recommended: Fine-grained PAT** (least privilege)

Navigate to GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token.

Settings:
- **Token name:** `github-skill-scanner-scan`
- **Expiration:** 1 year (set a calendar reminder to rotate before it expires)
- **Resource owner:** your GitHub account (or org if the repo is in an org)
- **Repository access:** Only select repositories > select `github-skill-scanner`
- **Repository permissions:**
  - Contents: **Read and write** (needed to push the data commit)
  - Metadata: **Read-only** (automatically included)

Why this is sufficient: the scanner reads public repository trees and file contents without authentication (or with the PAT for higher rate limits). The PAT only needs write on this repo for the git push.

**Alternative: Classic PAT** (if fine-grained tokens don't support your account type)

Generate at GitHub Settings > Developer settings > Personal access tokens > Tokens (classic).
- Scope: `public_repo` — sufficient for both GitHub API reads of public repositories and pushing to this public repo. Do NOT use `repo` scope.
- `repo` grants full read/write access to ALL of the owner's private repositories and must never be used here. It provides far more privilege than the scanner requires.
- If this repository is ever made private, do not expand to `repo` scope. Instead, migrate to a fine-grained PAT (see the recommended option above) scoped to only this repository with Contents read/write.

### Step 2 — Add the PAT as a repository secret

1. Go to the repository on GitHub.
2. Settings > Secrets and variables > Actions > New repository secret.
3. Name: `SCAN_PAT` (exact — the workflows reference this name).
4. Value: paste the PAT you created in Step 1.
5. Save.

### Step 3 — Enable GitHub Pages (source = GitHub Actions)

1. Go to the repository on GitHub.
2. Settings > Pages.
3. Under "Build and deployment", set Source to **GitHub Actions**.
4. Do not select a branch — the Actions source is what the deploy workflow uses.
5. Save.

### Step 4 — Verify the base path matches the repository name

The Vite config (`vite.config.ts`) has `base: '/github-skill-scanner/'`. This must match the repository name exactly (case-sensitive). The Pages URL will be `https://<your-username>.github.io/github-skill-scanner/`.

If the repository is renamed, update `base` in `vite.config.ts` to match, then trigger a manual deploy.

If you add a custom domain (CNAME), the base path becomes `/` and `vite.config.ts` must be updated to `base: '/'`.

### Pre-Launch Gate

Before considering the site live, verify:
- `skillCount` in the deployed `https://<username>.github.io/github-skill-scanner/data/skills.json` is >= 1
- The Skills page loads and shows at least one card
- Clicking "Copy" on a card produces the correct `npx skills add ...` command

---

## Normal Operations

### Triggering a Manual Scan

1. Go to the repository on GitHub > Actions tab.
2. Select the "Scan" workflow in the left sidebar.
3. Click "Run workflow" > Run workflow (on `main`).
4. Watch the run. Expected duration: under 60 seconds for the scan step; the subsequent data commit and push add ~10 seconds.

After the scan completes and pushes (if data changed), the "Deploy" workflow fires automatically within a few seconds.

### Triggering a Manual Deploy

Use this when you want to redeploy the site without running the scanner (e.g. after a frontend code change merged to `main`):

1. Go to Actions > "Deploy" workflow.
2. Click "Run workflow" > Run workflow.

Alternatively, merging any PR that touches `src/fe/**`, `data/**`, `package.json`, `vite.config.ts`, or `tsconfig.vite.json` into `main` triggers deploy automatically.

### Checking Run Status

- Actions tab shows all workflow runs with status, duration, and logs.
- Green check = success. Red X = failure. Yellow dot = in progress.
- Expected durations:
  - Scan (with changes): 30-60 seconds for the scanner + ~15 seconds for checkout/setup/push. Total under 2 minutes.
  - Scan (no changes): ~45 seconds (setup + scanner + skip commit message).
  - Deploy: ~2-3 minutes (checkout + install + build + artifact upload + Pages propagation).

---

## How the Scan-to-Deploy Trigger Chain Works

```
schedule / workflow_dispatch
        |
        v
   scan.yml runs
        |
        v
   npm run scan  (writes data/skills.json)
        |
   git status --porcelain data/
        |
   [no changes] -------> exit 0  (no commit, deploy.yml not triggered)
        |
   [changes found]
        |
        v
   git pull --rebase --autostash origin main
        |
        v
   git commit data/skills.json
        |
        v
   git push origin main   <--- authenticated with SCAN_PAT
        |
        v
   GitHub sees a push to main from a PAT (not GITHUB_TOKEN)
        |
        v
   deploy.yml fires (path filter: data/** matches)
        |
        v
   npm run build  (copy-data + vite build -> dist/)
        |
        v
   upload dist/ as Pages artifact -> deploy to Pages
```

**The GITHUB_TOKEN trap:** GitHub blocks workflows triggered by the default `GITHUB_TOKEN` from firing other workflows. This prevents infinite loops (a deploy that commits triggering another deploy). It also means that if the scanner were to push using `GITHUB_TOKEN`, `deploy.yml` would never see the data commit. The scanner must always push with `SCAN_PAT`. This is documented in `adr-004-cicd-pipeline-shape.md` and is a known, stable GitHub behavior — but it must be set up correctly and must not be "simplified away" during future maintenance.

---

## Incident Runbook

### Scan fails — general failure

**Symptoms:** The "Scan" workflow run shows a red X.

**Diagnosis:**
1. Open the failed run > click the `scan` job > expand the failing step.
2. If the `Run scanner` step failed: check the log for `reposFailed` count and per-repo error messages. The scanner exits non-zero only when ALL repos failed (must-have #2 acceptance).
3. If the `Commit and push data changes` step failed: likely a push rejection (see race condition below).

**Resolution:**
- If the scanner errored on all repos: check that `SCAN_PAT` is set and has not expired (Settings > Secrets and variables > Actions — the secret exists but GitHub doesn't show the value; check the expiry date you set).
- If one or more repos errored but not all: the scan still succeeds (exit 0). The errored repos appear in the log. Investigate per-repo errors separately.
- Re-run the workflow from the Actions tab after fixing the underlying issue.

### Scan fails — GitHub API rate limited

**Symptoms:** Scanner log contains HTTP 403 or `x-ratelimit-remaining: 0`.

**Diagnosis:** The PAT's rate limit is exhausted. Authenticated requests have a limit of 5,000/hour for classic PATs.

**Resolution:**
- Wait for the rate limit to reset (the `x-ratelimit-reset` response header gives the Unix timestamp).
- Trigger a manual scan after the reset window.
- If this happens regularly, the repo list has grown large enough to require concurrent scanning — flag to the Lead Developer (tech-spec.md Section 12 technical debt item).

### Deploy not firing after a data commit

**Symptoms:** scan.yml completes with a successful commit, but deploy.yml does not start.

**Root cause (most likely):** The data commit was pushed using the default `GITHUB_TOKEN` instead of `SCAN_PAT`. This is the most common misconfiguration.

**Diagnosis:**
1. In the scan.yml run, expand the "Checkout repository" step. If `token: ${{ secrets.SCAN_PAT }}` is absent, the checkout used `GITHUB_TOKEN`.
2. Check that the `SCAN_PAT` secret exists (Settings > Secrets and variables > Actions).
3. Check that the PAT has not expired.

**Resolution:**
- Ensure `SCAN_PAT` is present and valid. Re-add it if needed (Step 2 of one-time setup).
- Trigger a manual deploy to recover the current state: Actions > Deploy > Run workflow.
- After the manual deploy, the next scan will use the PAT correctly and trigger deploy automatically.

**Other causes:**
- The push touched a path not in deploy.yml's path filter (`src/fe/**`, `data/**`, `package.json`, `vite.config.ts`, `tsconfig.vite.json`). If data was written somewhere other than `data/`, update the path filter.
- Someone added `[skip ci]` to the scanner's commit message. On GitHub Actions, `[skip ci]` suppresses ALL workflow triggers for that push — including `deploy.yml`. The current `scan.yml` intentionally does NOT include `[skip ci]` (loop prevention is structural: `scan.yml` doesn't listen to `push`). If you see `[skip ci]` in the data commit, remove it from `scan.yml`.

### Empty catalog (skillCount = 0)

**Symptoms:** The deployed site shows the empty state ("No skills found yet.") and the metadata in `data/skills.json` has `skillCount: 0`.

**Diagnosis:**
1. Check `src/scan/repos.json` — does it list at least one repo?
2. Run a manual scan and read the scan log. Did the API return results? Were any SKILL.md files found?
3. Check that the repos in `repos.json` contain SKILL.md files at paths matching the supported layouts (L1: `SKILL.md`, L2: `<skill>/SKILL.md`, L3: `skills/<skill>/SKILL.md`).

**Resolution:**
- If `repos.json` is misconfigured: add the correct repos, commit, and trigger a manual scan.
- If the target repos genuinely have no SKILL.md files in supported layouts: the catalog is correctly empty. Add repos that have SKILL.md files.

### Pages 404 / base-path mismatch

**Symptoms:** The site loads but all resources (JS, CSS) or the data fetch (`data/skills.json`) return 404. URL shows `https://<username>.github.io/github-skill-scanner/...`.

**Diagnosis:**
1. Open the browser network tab and check which URLs are 404ing.
2. If JS/CSS 404: `vite.config.ts` `base` is wrong. It must be `/github-skill-scanner/` (matching the repository name exactly).
3. If `data/skills.json` 404s: either the base is wrong or `dist/data/skills.json` was not present in the deployed artifact.
4. Check the most recent deploy.yml run: the "Verify dist/data/skills.json is present" step will have failed if the file was missing.

**Resolution:**
- Wrong base: update `base` in `vite.config.ts` to match the repo name (case-sensitive). Trigger a manual deploy.
- Missing data file: check that `data/skills.json` exists at the repo root and that `npm run copy-data` succeeds locally. Trigger a manual scan then a manual deploy.

### Rollback — bad data commit

**Symptoms:** A scan committed bad or corrupt `data/skills.json` (e.g. `skillCount: 0` regression, malformed JSON).

**Resolution:**
1. Identify the bad commit SHA in the git log (Actions tab > scan run > commit link, or `git log data/`).
2. Create a revert commit: `git revert <sha> --no-edit` and push to `main`.
3. The push triggers deploy.yml, which redeploys using the reverted (good) data.
4. Investigate the scanner run that produced bad output before re-enabling the schedule.

### Rollback — bad code deploy

**Symptoms:** A frontend code change broke the deployed site.

**Resolution:**
1. Revert the offending commit on `main` (via GitHub UI: PR > revert, or `git revert <sha>`).
2. Merge/push the revert to `main` — deploy.yml fires automatically and redeploys the previous working version.
3. Alternatively: trigger a manual deploy on a known-good SHA is not directly supported by deploy.yml (it deploys HEAD of main). The revert approach is the cleanest path.

---

## Observability

### What to watch

| Signal | Where to find it | Threshold / action |
|--------|-----------------|-------------------|
| Scan workflow health | Actions tab > Scan > latest run | Any red X = investigate within 24 hours |
| Deploy workflow health | Actions tab > Deploy > latest run | Any red X = site may be stale; investigate immediately |
| `skillCount` in deployed JSON | `https://<user>.github.io/github-skill-scanner/data/skills.json` | 0 after a scan = empty catalog incident |
| `lastScanned` timestamp | Same JSON, `metadata.lastScanned` | More than 25 hours old = scan may have failed or been skipped |
| Rate limit remaining | Scan workflow log, scanner output | Nearing 0 = risk of next scan failure |

### No alerting infrastructure

This project deploys to GitHub Pages with no server-side monitoring. All observability is manual review of Actions logs and the deployed JSON metadata. A fast-follow improvement would be a GitHub Actions notification to a Slack channel or email on workflow failure. This is out of scope for v1.

---

## Links

- `docs/dev-team/adr-004-cicd-pipeline-shape.md` — two-workflow design rationale and trigger model
- `docs/dev-team/adr-003-data-serving-on-github-pages.md` — why data must be in dist/ and how the base path works
- `docs/dev-team/tech-spec.md` — scanner design, GITHUB_TOKEN env var, npm scripts
- `.github/workflows/scan.yml` — scanner workflow
- `.github/workflows/deploy.yml` — Pages deploy workflow
