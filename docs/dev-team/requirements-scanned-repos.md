# Requirements Delta: Scanned Repos Indicator
**Feature:** Indicate which repos are being scanned in the UI
**Author:** Priya Nair (Business Analyst)
**Date:** 2026-06-05
**Status:** Acceptance criteria agreed (2026-06-05). **OQ-SR-1 → Interpretation B** (scanner emits the configured repo list into metadata). **OQ-SR-2 → (a) summary line + expand** disclosure. OQ-SR-3 (additive-schema confirmation) → Architect.
**Extends:** `requirements.md` must-have #6 (catalog display), nice-to-have #3 (last-scanned footer)

---

## What Changed and Why

The shipped UI shows the skill catalog and a "Last scanned: {date}" line in the header. It does not
currently indicate which repositories are included in the scan. A developer browsing the catalog has
no way to know whether a skill is missing because it doesn't exist or because its repo was never
configured for scanning. Surfacing the scan scope — without dominating the page — closes that gap.

---

## The Crux: What Does "Which Repos Are Being Scanned" Mean?

This is not a simple display change. It depends on a data availability question that must be
resolved before work starts. There are two distinct interpretations:

### Interpretation A — repos that produced skills (no data-contract change)

Display the distinct set of `repo` values found in `skills[].repo`. Every repo shown has at least
one skill. A repo that was configured and scanned but yielded zero skills is invisible.

- **Data needed:** already in `skills.json` — derive with `[...new Set(skills.map(s => s.repo))]`
- **Scanner change:** none
- **Schema change:** none (ADR-002 unaffected)
- **What it shows the user:** "these repos have skills in the catalog"
- **What it hides:** repos that are configured but currently yield no skills

### Interpretation B — the true configured scan list (small data-contract change)

The scanner emits the full list of configured repos from `src/scan/repos.json` into
`skills.json` metadata, so the UI shows the real scan scope regardless of whether any
skills were found.

- **Data needed:** a new `metadata.repos` field — an array of `{repo: "owner/repo", repoUrl: string, skillCount: number, status: "succeeded" | "failed"}` objects
- **Scanner change:** populate `metadata.repos` from the config list at scan time
- **Schema change:** additive field on `metadata` — ADR-002 allows additive fields without bumping `schemaVersion`, but the Architect must confirm this treatment and update ADR-002 accordingly
- **What it shows the user:** the complete scan scope, including zero-skill repos and failed repos
- **What it hides:** nothing in the configured set

### My recommendation

**Interpretation B, implemented minimally.** The stated intent is "which repos are being scanned,"
not "which repos currently have skills." A zero-skill repo is exactly the case where a developer
most needs to know the repo is configured — otherwise the absence of skills is silently ambiguous.
The data change is small (one additive array on metadata, one extra write in the scanner), it fits
within ADR-002's "additive fields don't bump schemaVersion" rule, and it answers the question the
user actually asked. If the stakeholder disagrees or wants to ship faster, Interpretation A is a
valid fallback that requires zero backend work.

This is **OQ-SR-1** — it must be resolved before implementation begins.

---

## Scope

### In scope
- A small, non-intrusive indicator in the existing header area showing which repos are included in
  the scan
- The indicator collapses or summarizes by default; the full list is accessible on demand (e.g.
  expandable) so it does not dominate the page on large repo lists
- Under Interpretation B only: a new `metadata.repos` array field written by the scanner

### Out of scope
- Per-repo filtering of the skill list (searching is already provided; this is display only)
- Live scan status or progress indicators (the scan runs in CI, not in the browser)
- Any UI for adding, removing, or editing the repos config — the catalog maintainer edits
  `src/scan/repos.json` directly (established in requirements.md, User Roles)
- Linking to individual repos as a primary navigation — repo links may appear incidentally but
  this feature is about surfacing the scan scope, not building a repo browser
- Showing scan history or per-repo changelogs — out of scope for v1 (requirements.md next-phase)
- Per-repo skill filtering or grouping in the catalog grid

### Next phase (not now)
- Per-repo health badges (last succeeded, last failed) if the catalog grows and repo reliability
  becomes a concern
- Dynamic repo addition via a submission form (requirements.md next-phase item)

---

## Must-Haves

1. **Scanned repos visible in header area** — The UI must display the set of repos included in the
   scan somewhere near the existing "Last scanned" line in the header, without adding significant
   visual weight to the page.

   *Acceptance criteria (both interpretations):*
   - The repos indicator appears in the header section of the page, adjacent to or below the
     existing "Last scanned" line
   - The indicator is visible without scrolling on a standard desktop viewport (1280px wide)
   - When the catalog is in the loading or error state, the repos indicator is either hidden or
     shows a neutral placeholder — it does not show stale or undefined data
   - The indicator does not introduce a horizontal scrollbar on viewports >= 320px wide

2. **Repo list is accessible without dominating the layout** — Because the repo list can grow, it
   must not render as a wall of text by default. The default state must be compact; the full list
   must be accessible on demand.

   *Acceptance criteria (both interpretations):*
   - The default (collapsed) state shows at most a count or a brief summary line
     (e.g. "12 repos scanned" or the first 3 repo names with "+ N more")
   - The full list is accessible on demand — either via an expand/collapse toggle or a disclosure
     pattern — without a page navigation or modal dialog
   - The expand/collapse control is keyboard-accessible (focusable, activatable with Enter/Space)
   - Screen readers can reach the full repo list (it is not hidden with `display:none` or
     `aria-hidden` in its expanded state)
   - [Route to UX Designer for non-intrusiveness review before implementation]

3. **Repo display content** — Each repo in the list must be legible and attributable.

   *Acceptance criteria — Interpretation A (skills-only set):*
   - Each repo in the list is identified by its `owner/repo` string
   - Each repo in the list links to its GitHub URL (derived from `repoUrl` of any skill belonging
     to that repo)
   - The count shown in the compact state equals the number of distinct `repo` values in
     `skills[]`; it matches `metadata.repoCount` if and only if all configured repos yielded at
     least one skill

   *Acceptance criteria — Interpretation B (configured set):*
   - Each repo in the list is identified by its `owner/repo` string and links to its GitHub URL
   - The count shown in the compact state equals `metadata.repos.length`, which equals the
     number of repos in `src/scan/repos.json` at the time of the scan
   - Repos with `status: "failed"` are visually distinguished (e.g. a subtle indicator) so the
     maintainer can see at a glance if a configured repo errored — without alarming a casual user
   - A repo with `skillCount: 0` and `status: "succeeded"` is shown without a warning (it was
     scanned successfully; it simply has no skills yet)
   - The full list is sorted consistently (alphabetical by `repo` is acceptable; match scanner
     sort order from ADR-002 for stability)

---

## Nice-to-Haves

1. **Repo skill counts in expanded list** — Each repo in the expanded list shows how many skills
   it contributes (e.g. "anthropics/skills — 5 skills"). Under Interpretation A this is derivable
   from `skills[]`; under Interpretation B it comes from `metadata.repos[].skillCount`. —
   *Priority: Low*

2. **"Scanned N repos" merged with "Last scanned" into a single footer line** — Instead of two
   separate lines, combine into one: "Last scanned: Jun 4, 2026 — 12 repos". Reduces header
   height. — *Priority: Low* [Route to UX Designer]

---

## Non-Functional Requirements

- **Performance:** Deriving the distinct repo set from `skills[]` (Interpretation A) is a
  client-side in-memory operation on a small array; no perceptible cost. Interpretation B adds
  one small array to the JSON payload already fetched; no additional network request.
- **Accessibility:** The expand/collapse control must be keyboard-accessible and use a semantic
  disclosure pattern (`<details>`/`<summary>` or `aria-expanded` button). Route to UX Designer
  for review before implementation. [Extends the accessibility note in requirements.md NFRs.]
- **Schema stability (Interpretation B only):** `metadata.repos` is an additive field. The
  frontend must read it defensively: if `metadata.repos` is absent (e.g. reading older
  `skills.json` from before this change), the repos indicator must degrade gracefully — either
  hiding or falling back to Interpretation A behavior.

---

## User Story

### Story SR-1: See which repos are in the scan
**As a** developer, **I want** to see which repositories are included in the skill scanner
**so that** I know whether a skill I'm looking for might exist in a repo that simply hasn't
been added to the scan, rather than not existing at all.

**Acceptance criteria:**
- [ ] The header area shows a compact summary of the scanned repo count when the catalog is loaded
- [ ] I can expand the summary to see the full list of repo names without leaving the page
- [ ] Each repo name links to its GitHub page
- [ ] The feature does not add more than one line of visible text to the header in its default
      (collapsed) state
- [ ] Under Interpretation B: repos that failed to scan are distinguishable from repos that
      succeeded (even if the distinction is subtle)

---

## Open Questions

| # | Question | Owner | Decision by | Notes |
|---|----------|-------|-------------|-------|
| OQ-SR-1 | **Interpretation A vs B** | Stakeholder | **RESOLVED 2026-06-05 → B.** Scanner emits the configured repo list (incl. zero-skill and failed repos) into `skills.json` metadata. Frontend still degrades gracefully (A-style) if the field is absent. |
| OQ-SR-2 | **Non-intrusiveness intent** | Stakeholder | **RESOLVED 2026-06-05 → (a)** a single quiet summary line ("Scanning N repositories") near "Last scanned", with a disclosure toggle revealing the full list on demand. UX designs the exact interaction. |
| OQ-SR-3 | **Interpretation B schema change**: Is adding `metadata.repos` treated as additive (no `schemaVersion` bump) under ADR-002, or does the Architect want a new ADR or an amendment? | Architect | Before scanner implementation (Interpretation B only) | ADR-002 states additive optional fields do not bump `schemaVersion`. This should qualify, but the Architect must confirm and update the contract documentation. |

---

## Assumptions

- The header area of `App.tsx` (the `<header>` element, currently containing h1, subtitle, and
  "Last scanned" line) is the natural home for this indicator. No new layout zones are needed.
- The repos list at launch is under 20 entries (confirmed in requirements.md OQ-4). The
  expand/collapse pattern handles growth gracefully but is not driven by a large-list concern today.
- Under Interpretation A, deriving distinct repos client-side from `skills[]` is acceptable; no
  pre-aggregation in the scanner is required.
- Under Interpretation B, `metadata.repos` carries the list as the scanner saw it at scan time —
  the frontend does not re-derive from `skills[]` when `metadata.repos` is present.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Interpretation A misleads maintainers — a configured repo that always fails looks absent from the UI, obscuring a recurring scanner error | Medium | Medium | Recommend Interpretation B; if A is chosen, document the limitation in the header tooltip or help text |
| Expand/collapse interaction adds unexpected complexity (keyboard, screen reader, animation) for what should be a one-line feature | Low | Low | Use `<details>`/`<summary>` — native HTML, no JavaScript required, keyboard and screen reader support built in; UX Designer to confirm |
| Adding `metadata.repos` (Interpretation B) under the "additive fields" rule of ADR-002 creates ambiguity if the Architect later needs to version the contract | Low | Low | Architect to amend ADR-002 or write a brief ADR-006 delta recording this extension explicitly |
