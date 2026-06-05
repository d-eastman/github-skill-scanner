# Requirements Document
**Project:** GitHub Skill Scanner  
**Author:** Priya Nair (Business Analyst)  
**Date:** 2026-06-04  
**Status:** Approved at requirements gate (2026-06-04) — OQ-1 through OQ-4 resolved by stakeholder (see Resolved Decisions); OQ-5 deferred to the Architect

---

## Problem Statement

Developers who rely on agent skills published across multiple GitHub repositories have no efficient way to discover what skills are available, what each skill does, or how to install one. Discovery today means manually browsing repositories, reading README files, and constructing install commands by hand. This friction slows adoption of available skills and makes it easy to miss newly published ones.

The GitHub Skill Scanner solves this by automatically scanning a curated set of repositories for `SKILL.md` files, extracting structured metadata, and presenting the results in a searchable web interface with one-click install command copy. Developers get a continuously fresh, low-friction catalog of available skills.

If this is not built, the catalog remains invisible and install friction stays high — reducing the effective utility of the skill ecosystem.

---

## Background

This is a greenfield project. There is no existing scanner, no existing frontend, and no existing data pipeline.

Key prior decisions (treated as fixed inputs, not up for re-litigitation):

- **Full build is approved** — all components will be implemented this week.
- **Repo selection is static config.** A hand-maintained config file (tentatively `repos.json` or similar in the repository root or `src/scan/`) lists the GitHub repos to scan. There is no dynamic repo discovery in v1. The GitHub API will be used to read file contents within those repos, not to search for repos.
- **Stack:** JavaScript, React, Vite, Node 20. JSON files as the datastore. Deploy target is GitHub Pages. Package manager is npm.
- **Directory layout:** `src/fe` (frontend), `src/scan` (scanner), `data/` (scanner output / frontend input), `tests/`.

---

## Scope

### In scope
- A hand-maintained config file that enumerates the GitHub repos to scan
- A scanner (`src/scan`) that reads that config, fetches `SKILL.md` files from each repo via the GitHub API, extracts metadata, and writes structured JSON output to `data/`
- A scheduled GitHub Actions workflow that runs the scanner on a recurring schedule and commits the updated `data/` output to the repository
- A React/Vite frontend (`src/fe`) published to GitHub Pages that reads the JSON data and displays a browsable, searchable skill catalog
- A "copy install command" interaction that puts an `npx skills add <repo-url> --skill <skill-name>` command on the user's clipboard

### Out of scope (v1)
- Dynamic repo discovery — no searching GitHub for repos; the list is static and hand-maintained
- Authentication or user accounts on the frontend — anonymous, read-only browsing only
- Skill installation itself — the scanner and frontend do not execute installs; they only surface the command
- Editing or submitting new skills via the UI
- Versioning or historical tracking of skill metadata across scans
- Any backend server or database — everything is static JSON on GitHub Pages

### Next phase (not now, but documented)
- Dynamic repo discovery via GitHub Search API or a submission form
- Skill versioning and changelogs
- User-facing filtering beyond text search (e.g., filter by language, author, tags)
- Notifications when new skills are published

---

## Must-Haves

1. **Static repo config file** — The system must read a hand-maintained configuration file that lists the GitHub repositories to scan. Adding or removing a repo from this file must be the only action required to include or exclude it from future scans.  
   *Acceptance criteria:*
   - A config file exists at a documented path (e.g., `src/scan/repos.json`) containing at minimum a list of `{owner, repo}` pairs.
   - Adding a valid entry and re-running the scanner causes that repo to appear in the output JSON.
   - Removing an entry and re-running causes it to be absent from the output JSON.

2. **Discover ALL SKILL.md files per repo** — A single repo may contain *multiple* skills, each in its own directory (e.g. `frontend-design/SKILL.md`). The scanner must discover every `SKILL.md` in each configured repo using a set of conventional organization schemes (e.g. `<skill>/SKILL.md`, `skills/<skill>/SKILL.md`, and a root-level `SKILL.md`), not assume a single file per repo. The skill name is derived from the directory containing the `SKILL.md`. Repos without any `SKILL.md` must be gracefully skipped without failing the scan.  
   *Acceptance criteria:*
   - For each configured repo, the scanner enumerates the repo tree (e.g. via the Git Trees API) and finds all paths matching the conventional `SKILL.md` layouts.
   - A repo containing N skills yields N skill entries in the output, each with its own name (from its containing directory) and metadata.
   - If a repo has no `SKILL.md`, the scanner logs a warning and continues without erroring.
   - If the API call fails (network error, rate limit, 403/404), the scanner logs the failure, skips that repo, and continues scanning remaining repos. The process exits with a non-zero code only if all repos fail.

3. **Metadata extraction from SKILL.md** — The scanner must parse YAML frontmatter from each `SKILL.md` and extract a defined set of fields: **`name`** and **`description`** (frontmatter), plus recorded **source** fields: repo (`owner/repo`), repo URL, file path, and the derived skill name (directory name). The directory-derived skill name is the identifier used in the install command (`--skill <skill-name>`); the frontmatter `name` is displayed.  
   *Acceptance criteria:*
   - For each discovered `SKILL.md`, the output JSON contains at minimum: `name` (frontmatter), `description` (frontmatter), `skillName` (directory-derived, used for install), `repo` (`owner/repo`), `repoUrl`, and `path`.
   - If `name` or `description` is absent from the frontmatter, that field appears as `null` in the output and the scanner logs a warning (it does not fail the scan).
   - Frontmatter parsing is tolerant: a `SKILL.md` with malformed or missing frontmatter still produces an entry (with null fields) rather than crashing the scan.
   - The output JSON is valid JSON (parseable without error).

4. **JSON output written to `data/`** — After a scan, the scanner must write its output to the `data/` directory in a documented, stable schema. The frontend depends on this contract.  
   *Acceptance criteria:*
   - A scan produces at minimum one JSON file at a documented path (e.g., `data/skills.json`).
   - The file contains an array of skill objects, one per successfully extracted skill.
   - The schema is documented (inline comment or README entry) so the frontend team can code against it without ambiguity.
   - A scan with zero skills found produces a valid empty array, not an absent file.

5. **Scheduled GitHub Actions workflow** — A GitHub Actions workflow must run the scanner on a recurring schedule (e.g., daily) and commit any changes to `data/` back to the repository, so the published frontend always reflects the latest scan.  
   *Acceptance criteria:*
   - A workflow file exists in `.github/workflows/`.
   - The workflow runs on a cron schedule (minimum: once per day).
   - The workflow runs `npm install` and then the scanner script.
   - If the scan produces changes to `data/`, the workflow commits and pushes them to `main`.
   - If there are no changes, the workflow exits cleanly without creating an empty commit.
   - The workflow completes (scan + commit) in under 60 seconds for the expected repo list size. [OPEN QUESTION OQ-4]

6. **Frontend: skill catalog display** — The frontend must display all skills present in `data/skills.json` as a browsable list or grid. Each skill entry must show at minimum its name, description, and source repo.  
   *Acceptance criteria:*
   - On load, the frontend fetches `data/skills.json` and renders one card/row per skill.
   - Each card displays skill name, description, and source repo (linked to the GitHub repo).
   - If `data/skills.json` contains zero skills, the UI shows an empty-state message rather than a blank page.
   - If the fetch fails, the UI shows an error state message rather than a blank page.

7. **Frontend: skill search** — The frontend must allow the user to filter the displayed skills by typing a search term. Search must operate client-side without a network round-trip.  
   *Acceptance criteria:*
   - A text input is present and focused on page load (or clearly discoverable).
   - Typing filters the displayed skill list in real time (no submit button required).
   - Search matches against at minimum skill name and description (case-insensitive).
   - Clearing the search input restores the full list.
   - A search that matches zero skills shows a "no results" message.

8. **Frontend: copy install command** — For each skill, the frontend must provide a one-click interaction that copies the `npx skills add <repoUrl> --skill <skillName>` command to the user's clipboard.  
   *Acceptance criteria:*
   - Each skill card has a copy button or click-to-copy element showing the install command.
   - Clicking it writes the full command string to the clipboard using the browser Clipboard API.
   - Visual feedback (e.g., button text changes to "Copied!") confirms the copy to the user.
   - The copied string, when pasted, is exactly `npx skills add <repoUrl> --skill <skillName>` (e.g. `npx skills add https://github.com/anthropics/skills --skill frontend-design`) with no trailing whitespace or newline artifacts.

9. **Frontend deployed to GitHub Pages** — The built frontend must be served from GitHub Pages on the project repository's GitHub Pages URL, with the scanner's `data/` output accessible to the frontend at runtime.  
   *Acceptance criteria:*
   - A GitHub Actions workflow (or the same workflow as the scanner) builds the frontend with `npm run build` and deploys to GitHub Pages.
   - The deployed app loads without console errors on Chrome and Firefox (latest stable).
   - The `data/skills.json` file is reachable by the deployed frontend (either co-deployed or accessible from the same origin).

---

## Nice-to-Haves

1. **Skill detail view or expanded card** — Clicking a skill shows additional metadata (e.g., full SKILL.md content, tags, author) in a modal or detail page. — *Priority: Medium*

2. **Filter by tag or category** — If SKILL.md includes tags or categories, the frontend exposes a tag filter alongside the text search. — *Priority: Medium* [Depends on OQ-1 resolution]

3. **Last-scanned timestamp display** — The frontend shows when the data was last updated (e.g., "Last scanned: 2026-06-04"). The scanner writes a timestamp field to the output JSON. — *Priority: Low*

4. **Scan run on push to `main`** — In addition to the scheduled run, the scanner workflow triggers on push to `main` (useful during development). — *Priority: Low*

5. **Individual per-repo JSON files** — In addition to the aggregated `data/skills.json`, the scanner writes per-repo output files for easier debugging. — *Priority: Low*

---

## Non-Functional Requirements

- **Performance:** The scanner must complete a full scan of all configured repos in under 60 seconds. The frontend must render the initial skill list in under 2 seconds on a standard broadband connection (skills JSON is expected to be small — tens to low hundreds of skills).
- **Availability:** The frontend is a static site on GitHub Pages; availability matches GitHub Pages SLA. No additional availability target.
- **Accessibility:** Basic keyboard navigability for search and copy interactions. WCAG 2.1 AA compliance is not a hard requirement for v1 but the UX Designer should review. [Route to UX Designer]
- **Security:** No user data is collected or transmitted. The GitHub API PAT used by the scanner must be stored as a GitHub Actions secret, never hardcoded or committed, and never exposed in the published frontend bundle (the frontend reads only static JSON and makes no authenticated calls).
- **Data retention:** Scanner output is committed to the repository; retention is indefinite via git history. No additional retention policy.
- **Browser support:** Latest stable Chrome and Firefox. No IE or legacy browser requirement.

---

## User Roles

| Role | Goal | Notes |
|------|------|-------|
| Developer (consumer) | Find available agent skills, understand what each does, and get the install command quickly | Primary user of the frontend; does not need an account |
| Skill author / repo maintainer | Have their skill discovered and surfaced in the catalog | Passive role — they publish a SKILL.md; the scanner does the rest |
| Catalog maintainer | Add or remove repos from the scan list | Edits the config file directly; no UI for this in v1 |

---

## User Stories

### Story 1: Browse the skill catalog
**As a** developer, **I want** to open the GitHub Skill Scanner site and see all available skills **so that** I can get an overview of what agent skills exist across the ecosystem.

**Acceptance criteria:**
- [ ] The page loads and displays skills without requiring login or configuration
- [ ] Each skill entry shows at minimum its name, description, and source repo
- [ ] The skill list is populated from the most recent scanner output

### Story 2: Search for a specific skill
**As a** developer, **I want** to type a keyword and see only matching skills **so that** I can find a specific skill quickly without scrolling through the full catalog.

**Acceptance criteria:**
- [ ] The search input is visible without scrolling on a standard desktop viewport
- [ ] Typing filters results in real time
- [ ] Matches are case-insensitive
- [ ] A search that produces no results shows a "no results" message, not a blank page

### Story 3: Copy the install command
**As a** developer, **I want** to click a button and have the `npx skills add <repoUrl> --skill <skillName>` command copied to my clipboard **so that** I can paste it directly into my terminal without constructing the command manually.

**Acceptance criteria:**
- [ ] Every skill card has a copy-to-clipboard interaction for its install command
- [ ] After clicking, visual confirmation of the copy is shown
- [ ] The copied text, when pasted, is the exact correct command string

### Story 4: Catalog stays current automatically
**As a** catalog maintainer, **I want** the scanner to run on a schedule and update the published skill data automatically **so that** the site reflects new and updated skills without manual intervention.

**Acceptance criteria:**
- [ ] The GitHub Actions workflow runs at least once per day without manual triggering
- [ ] New skills added to a configured repo appear in the frontend on the next scheduled scan
- [ ] The workflow does not require secrets or credentials to be rotated more than once (uses a long-lived Actions token or PAT stored as a secret)

### Story 5: Add a new repo to the scan list
**As a** catalog maintainer, **I want** to add a repo to the config file and have it picked up on the next scan **so that** I can expand the catalog without touching code.

**Acceptance criteria:**
- [ ] Adding a valid `{owner, repo}` entry to the config file is the only change required
- [ ] The next scan run includes that repo
- [ ] If the new repo has no `SKILL.md`, the scan completes without error

---

## Resolved Decisions (stakeholder, at requirements gate 2026-06-04)

| # | Question | Decision |
|---|----------|----------|
| OQ-1 | What does a SKILL.md look like / which fields to extract? | **YAML frontmatter** with `name` and `description`. Extract those two, plus record source: `repo` (`owner/repo`), `repoUrl`, `path`, and the directory-derived `skillName`. |
| OQ-2 | How is the install identifier derived? | Command form is **`npx skills add <repoUrl> --skill <skillName>`** (e.g. `npx skills add https://github.com/anthropics/skills --skill frontend-design`). A repo may host **multiple** skills; each lives in its own directory and the **directory name is the `--skill` value**. The scanner must discover all of them via conventional layouts. |
| OQ-3 | GitHub API authentication? | **Personal Access Token (PAT)** stored as a GitHub Actions repo secret. All target repos are public; PAT is used for the higher rate limit and reliability. |
| OQ-4 | How many repos at launch? | **Under 20.** Sequential per-repo scanning is acceptable to meet the 60-second target; no parallelism required in v1. |

## Open Questions (deferred to Architect)

| # | Question | Owner | Decision by | Notes / Best Guess |
|---|----------|-------|-------------|-------------------|
| OQ-5 | **Where does `data/skills.json` live relative to the deployed frontend?** Option A: the scanner commits `data/` to `main` and the Pages deployment includes it. Option B: `data/` is deployed separately. The frontend's fetch URL depends on this. | Architect | Before frontend implementation | Best guess: Option A — include `data/` in the Vite build output (e.g. copied to `public/` or fetched via a base-path-aware URL) so the frontend fetches it at a relative path. Needs Architect confirmation. |
| OQ-6 | **What are the exact conventional SKILL.md layouts to scan for?** | Architect | Before scanner implementation | Confirmed real-world example: `anthropics/skills` uses top-level `<skill-name>/SKILL.md`. Architect to enumerate the set (root `SKILL.md`, `<skill>/SKILL.md`, `skills/<skill>/SKILL.md`, possibly nested) and define matching rules. |

---

## Assumptions

The following are treated as true for this document. If any is wrong, requirements may need to change.

- SKILL.md files use YAML frontmatter containing at minimum `name` and `description` fields. (Confirmed — OQ-1.)
- The install command is `npx skills add <repoUrl> --skill <skillName>`, where `<skillName>` is the directory containing the SKILL.md and a repo may contain multiple skills. (Confirmed — OQ-2.)
- All scanned repositories are public. No private repo access is required in v1.
- Authentication uses a **PAT stored as a GitHub Actions secret** (not the default `GITHUB_TOKEN`). (Confirmed — OQ-3.)
- The repo list at launch is **under 20 repos**; the 60-second scan target is achievable with sequential per-repo scanning. No parallelism is required in v1. (Confirmed — OQ-4.)
- The frontend is deployed from the same repository to GitHub Pages. The `data/` directory is either included in the build or co-deployed such that the frontend can fetch it at a relative path.
- "Search" means client-side text filter only in v1. No search index, no fuzzy matching, no server-side search.
- The scanner runs as a Node.js script invoked by GitHub Actions. No container or other runtime is required.
- Prettier is the only formatter; no TypeScript — the project uses plain JavaScript throughout (per stack definition, which lists JavaScript, not TypeScript; `typecheck` command in project context suggests this may warrant clarification with Lead Developer).

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SKILL.md has no consistent schema across repos — format varies by author | High | High | Define a canonical SKILL.md schema as part of this project; document it; have the scanner be tolerant of missing optional fields and strict only on required ones |
| GitHub API rate limits hit during scan (especially if unauthenticated) | Medium | High | Use authenticated requests (Actions secret); confirm repo count before architecture |
| `data/skills.json` path/fetch URL is wrong in production — frontend loads but shows nothing | Medium | High | Pin the fetch URL to a known-good path early; test against deployed Pages environment, not just local dev |
| Scan takes over 60 seconds as repo list grows post-launch | Low (v1) / High (future) | Medium | Design scanner to be stateless and parallelizable; document the performance boundary clearly |
| SKILL.md files are absent from most configured repos at launch — catalog looks empty | Medium | Medium | Coordinate with skill authors before launch; include at least a handful of seeded repos with confirmed SKILL.md files |
| GitHub Pages deployment and scanner commit workflow step on each other (race condition on `main`) | Low | Medium | Sequence the two workflows or combine them; Architect should design the Actions pipeline carefully |

---

## Stakeholder Sign-Off

| Name | Role | Status | Date |
|------|------|--------|------|
| David Eastman | Product Owner | Approved (requirements gate) | 2026-06-04 |
