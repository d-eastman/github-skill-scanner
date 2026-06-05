# Success Metrics & Instrumentation Requirements
**Project:** GitHub Skill Scanner  
**Author:** Ori Shapiro (Data Analyst)  
**Date:** 2026-06-04  
**Status:** Draft — for Lead Developer (instrumentation implementation) and PM (go/no-go criteria)

---

## 1. Success Definition

A successful v1 does one thing: **reduces the friction between "I want to find an agent skill" and "I am running the install command."** That is the core problem statement in `requirements.md`.

Measurably, v1 is successful if, after launch:

- The scanner runs reliably on schedule and the published catalog is fresh (automation is working)
- The catalog is non-trivially populated — real skills are visible (the product has content value)
- The copy-install interaction works cleanly (the core value action is functional)

These three conditions translate directly to the metric tiers below. Everything else is secondary.

---

## 2. Metrics

### Tier A: Scan / Pipeline Health Metrics

**These are free today.** The `metadata` envelope from ADR-002 plus GitHub Actions run history give us everything below with zero instrumentation cost. They should be the foundation of "is this working" monitoring from day one.

---

**A1 — Scan Success Rate** (North-Star health metric)

- **Definition:** `reposSucceeded / repoCount` per scan run, expressed as a percentage
- **Data source:** `data/skills.json` `metadata.reposSucceeded` and `metadata.repoCount` — committed to the repo by every scan run
- **How computed:** Read from the committed JSON file after each scan run. Can be grepped from git history or compared across commits.
- **Available today:** Yes — the schema is specified in ADR-002; the scanner writes it on every run
- **Target:** >= 90% (at most 2 repos fail per scan in a 20-repo config). Below 80% warrants investigation.
- **Guardrail:** If `reposFailed == repoCount` (all repos failed), the scanner exits non-zero (must-have #2) and the Actions run fails — this surfaces immediately in the Actions UI without any additional tooling.

---

**A2 — Catalog Population** (content health)

- **Definition:** `metadata.skillCount` — the number of successfully extracted skills in the current published catalog
- **Data source:** `data/skills.json` `metadata.skillCount`
- **How computed:** Direct read from the committed file
- **Available today:** Yes
- **Target:** >= 5 skills at launch (a non-empty, demonstrably useful catalog). skillCount = 0 after a successful scan is a red flag indicating no configured repos have SKILL.md files.
- **Guardrail:** `skillCount == 0` on a scan where `reposSucceeded > 0` means the repos are configured but contain no discoverable skills — this signals a content problem, not a technical one. The scanner logs a warning (must-have #2); confirm the configured repos actually contain SKILL.md files before launch.

---

**A3 — Scan Duration** (pipeline performance)

- **Definition:** Wall-clock time from job start to completion of the scanner step in `scan.yml`
- **Data source:** GitHub Actions workflow run history — visible in the UI and queryable via the GitHub API
- **How computed:** Inspect the Actions run log; step-level timing is provided automatically
- **Available today:** Yes — no instrumentation required
- **Target (NFR):** < 60 seconds for the scan step (must-have #5 acceptance criterion)
- **Guardrail:** If median scan duration trends above 45 seconds as repos are added, flag before the 60-second NFR becomes a failure. This is a leading indicator.

---

**A4 — Pipeline Freshness**

- **Definition:** Time elapsed since `metadata.lastScanned` — how stale is the live catalog?
- **Data source:** `data/skills.json` `metadata.lastScanned` (ISO 8601 UTC timestamp, per ADR-002)
- **How computed:** Subtract `lastScanned` from current time; the frontend can surface this directly (nice-to-have #3 in requirements is already in the schema)
- **Available today:** Yes
- **Target:** Catalog should never be more than 26 hours stale (daily cron schedule, with a tolerance buffer). If `lastScanned` is more than 48 hours old, the `scan.yml` cron has likely failed or been disabled.
- **Guardrail:** 48+ hours without a scan = pipeline is broken. Check Actions for failed runs.

---

### Tier B: Product / Usage Metrics

**These require instrumentation.** There is no backend, no server logs, and no analytics infrastructure today. These are the signals that answer the actual product question — "are developers using this to find and install skills?" — but they cost something to collect.

The three meaningful usage events are:

| Event | Why it matters | Current status |
|-------|---------------|----------------|
| Copy-install button clicked | The core value action — this is why the product exists | Requires instrumentation |
| Search query performed | Reveals how people browse; distinguishes passive catalog viewers from active seekers | Requires instrumentation |
| Skill catalog page loaded | Baseline visit count; denominator for copy-rate | Requires instrumentation |

Without these, we can confirm the pipeline is working but we cannot answer "is anyone actually using this?" or "how often does a visit result in an install command copy?"

**The metric that matters most if we collect usage data:**

**Copy-through rate** — the fraction of catalog page loads that result in at least one install command copy. This is the product's core value action rate. A high rate means the catalog is useful and actionable. A low rate means either the skills aren't compelling, the UI is unclear, or the copy mechanism is broken.

Formula: `copy events / page load events` (per session or per day — daily is simplest)

---

### Summary Table

| Metric | Tier | Source | Available now | v1 target |
|--------|------|--------|---------------|-----------|
| Scan success rate (A1) | Health | `metadata.reposSucceeded / repoCount` | Yes | >= 90% |
| Catalog population (A2) | Content | `metadata.skillCount` | Yes | >= 5 skills |
| Scan duration (A3) | Performance | Actions run logs | Yes | < 60s |
| Pipeline freshness (A4) | Health | `metadata.lastScanned` | Yes | < 26h lag |
| Copy-install clicks (B1) | Product usage | Analytics tool | Needs instrumentation | N/A at launch |
| Searches performed (B2) | Product usage | Analytics tool | Needs instrumentation | N/A at launch |
| Catalog page loads (B3) | Product usage | Analytics tool | Needs instrumentation | N/A at launch |

---

## 3. Instrumentation Requirements

### Tier A: No instrumentation required

The scanner must correctly write these fields on every run (per ADR-002 schema):

```
metadata.lastScanned    — ISO 8601 UTC string
metadata.repoCount      — integer: repos in config attempted
metadata.reposSucceeded — integer: repos that returned a tree
metadata.reposFailed    — integer: repos skipped due to error
metadata.skillCount     — integer: must equal skills.length
```

These are already in the ADR-002 contract. The Lead Developer's implementation of the scanner is the instrumentation. No additional tracking hooks are needed for Tier A.

The Actions workflow duration is captured automatically by GitHub — nothing to add.

### Tier B: Client-side event tracking (if usage analytics are in scope)

If the team decides to add usage analytics (see recommendation in section 5), the Lead Developer must add the following to the frontend:

**Event 1: Catalog page loaded**
- Where: `App` component, inside the `useEffect` that fires the `data/skills.json` fetch (ADR-005)
- When: Once, on successful render of the skill list (i.e., when `status` transitions to `ready`)
- What to capture: event name `catalog_viewed`, timestamp, `skillCount` (from metadata, so the event carries catalog size context)

**Event 2: Install command copied**
- Where: `CopyButton` component, inside the click handler that calls `navigator.clipboard.writeText()`
- When: On every successful clipboard write (not on failure)
- What to capture: event name `install_copied`, `skillName`, `repo` (from the skill object)
- Do not capture the full repoUrl or the full command string — these may contain values that change and are not needed for aggregate analysis

**Event 3: Search performed**
- Where: The search state in `App`, triggered when `query` changes (debounced — fire once after the user stops typing, not on every keystroke)
- When: When `query` has at least 2 characters and at least 500ms have elapsed since the last keystroke (to avoid event spam)
- What to capture: event name `search_performed`, `resultCount` (number of matching skills after filtering)
- Do not capture the search query text — this is a catalog of agent skills; the query text is not sensitive, but capturing raw search strings adds complexity and minimal analytical value at v1 scale

**No user identifiers should be captured.** No cookies, no fingerprinting, no session IDs. Event frequency alone is sufficient for v1 usage questions.

---

## 4. Targets and Guardrails

### At-launch health checks (confirm before declaring v1 shipped)

These are pass/fail gates, not aspirational targets:

1. **`reposFailed == repoCount` never occurs on the first scan** — if it does, the scanner is broken or the PAT is misconfigured
2. **`skillCount >= 1` on the first scan** — the catalog must have content; coordinate with skill authors to confirm SKILL.md files exist in configured repos before launch
3. **Scan duration < 60 seconds on the first end-to-end run** — must-have #5 NFR; confirm in Actions
4. **`data/skills.json` is reachable by the deployed frontend** — the "works in dev, 404s in prod" risk (ADR-003); verify against the live GitHub Pages URL, not localhost

### Ongoing guardrails (signals that something broke)

| Signal | Threshold | Meaning |
|--------|-----------|---------|
| `scan.yml` run fails | Any failure | Scanner error or PAT expiry — check Actions immediately |
| `reposFailed / repoCount` > 0.20 | > 20% repos failing | GitHub API issues or config problems |
| `skillCount` drops by > 50% scan-over-scan | Large drop | Repos removed, SKILL.md files deleted, or parse error |
| `lastScanned` age > 48 hours | No scan in 2 days | `scan.yml` cron disabled or failing silently |
| Scan duration > 50 seconds | Approaching NFR limit | Start planning parallelization before the limit is hit |

### What does NOT count as a success signal

- The Actions dashboard showing green — a green scan that produces `skillCount = 0` is not a success
- The frontend loading without errors — a loaded frontend showing an empty catalog is not useful
- The `deploy.yml` completing — a successful deploy of stale data is not a success

Label these for the team: green CI is a necessary condition, not a sufficient one. The actual success check is: scan ran, skills were found, data is fresh, frontend shows real content.

---

## 5. Usage Analytics: In v1 or Fast-Follow?

**Recommendation: fast-follow, not v1.**

The reasoning:

**The one-week runway is the binding constraint.** Adding client-side analytics to v1 means choosing a tool, configuring it, integrating the script, adding the three event hooks, testing that events fire correctly, and verifying that nothing in the integration conflicts with the static-site deployment or the GitHub Pages CSP headers. None of that is hard, but all of it takes time that competes with shipping the scanner, the frontend, and the CI/CD pipeline — the core deliverables.

**Tier A metrics are sufficient for the first question the team will actually ask after launch.** That question is "is this working?" not "how many people are using it?" In the first week post-launch, pipeline health is what matters. Usage analytics become meaningful only after the catalog is populated and the URL is shared — which happens after v1, not during it.

**There is no incremental measurement cost.** Because the `metadata` envelope is already in the schema, we lose nothing by deferring Tier B. The Tier A metrics give us a complete picture of pipeline health. If the first scan runs clean and the catalog is populated, v1 is working — we do not need copy counts to know that.

**What to do in the fast-follow (one sprint after launch):**

Pick one of these two approaches, in order of preference:

1. **Plausible Analytics (privacy-first, no cookie banner, $9/month)** — a script tag, no GDPR burden, gives page views and custom events. The Lead adds `<script defer data-domain="..." src="https://plausible.io/js/script.js"></script>` to `index.html` and the three event hooks described in section 3. Total implementation time: a few hours.

2. **Counter.dev or GoatCounter (open-source, free tier)** — similar privacy posture, slightly less polished, but free. Appropriate if cost is a constraint.

Do not use Google Analytics. It adds GDPR/cookie complexity that is disproportionate to the scale of this project and contradicts the "no user data collected" statement in the security NFR.

**What to tell the team now:** instrument the `CopyButton` click handler with a `console.log` for now. This costs nothing, confirms the event fires correctly in dev, and makes the Tier B fast-follow a drop-in: replace the `console.log` with the analytics call. This is the only ask in v1.

---

## Handoffs

**Lead Developer:**
- The ADR-002 scanner output fields (`reposSucceeded`, `reposFailed`, `repoCount`, `skillCount`, `lastScanned`) are the instrumentation for Tier A. Implement them correctly in the scanner — they are the backbone of post-launch health monitoring.
- In the `CopyButton` component, add a `console.log('install_copied', { skillName, repo })` on successful clipboard write. This is the placeholder for Tier B and costs nothing.
- No other instrumentation work is required in v1.

**PM:**
- The Tier A targets in section 4 are the go/no-go health checks for launch. Confirm `skillCount >= 1` before declaring v1 shipped — this requires that at least some configured repos contain real SKILL.md files.
- Usage analytics (Tier B) is a fast-follow recommendation, not a blocker. Add it to the post-launch backlog.
