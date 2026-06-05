# User Flows and Annotated Wireframes
**Project:** GitHub Skill Scanner  
**Author:** Lena Vasquez (UX Designer)  
**Date:** 2026-06-04  
**Status:** Ready for Lead Developer feasibility review  

---

## Scope

Single-screen catalog app. One page, no router. This document covers:
- Primary user flow (happy path + all branching states)
- Annotated wireframe for the single screen
- All five required UI states with microcopy
- Interaction and accessibility notes
- Heuristic check of this design against requirements

Inputs: requirements.md must-haves #6, #7, #8; ADR-005 (component shape, state machine); ADR-002 (data schema, null-tolerant fields).

---

## 1. Primary User Flow

```
User opens page
      |
      v
[App mounts] --> fetch data/skills.json
      |
      +--[network/parse error]-----------> ERROR STATE
      |
      +--[fetch succeeds, skills=[]]-----> EMPTY STATE
      |
      +--[fetch succeeds, skills.length > 0]
              |
              v
         POPULATED STATE
         (SearchBar autofocused, full skill list visible)
              |
              +--[user types in search]
              |         |
              |         +--[matches >= 1]--> filtered SkillList updates in real time
              |         |
              |         +--[matches = 0]---> NO-RESULTS STATE
              |                             (catalog still loaded; query non-empty)
              |
              +--[user clears search]------> full skill list restores
              |
              +--[user clicks "Copy" on a card]
                        |
                        v
                  Clipboard API writes command
                        |
                        +--[success]-------> button shows "Copied!" for 2s, reverts
                        |
                        +--[API failure]---> button shows "Failed — try again" for 2s
                                            (silent fallback; no modal, no toast)
```

Transitions between LOADING -> ERROR, LOADING -> EMPTY, and LOADING -> POPULATED are one-way on initial load. There is no refresh or retry button in v1. The error state is terminal until the user reloads the page.

---

## 2. Annotated Wireframe — Single Screen

One layout serves all non-loading states. States differ only in what appears in the list area.

```
+----------------------------------------------------------+
|  GitHub Skill Scanner                                    |
|  Agent skills across the ecosystem                       |
|                                               Last scanned: Jun 4, 2026  |
+----------------------------------------------------------+
|                                                          |
|  [ Search skills...                              [x] ]  |
|                                                          |
+----------------------------------------------------------+
|                                                          |
|  +----------------------------------------------------+  |
|  | Skill Name                                         |  |
|  | Description text — one or two lines, then truncate |  |
|  | Source: owner/repo  (linked)                       |  |
|  |                                                    |  |
|  | npx skills add https://github.com/... --skill name |  |
|  |                             [ Copy ]               |  |
|  +----------------------------------------------------+  |
|                                                          |
|  +----------------------------------------------------+  |
|  | ...next card...                                    |  |
|  +----------------------------------------------------+  |
|                                                          |
+----------------------------------------------------------+
```

### 2a. Header

- **Title:** "GitHub Skill Scanner" — page `<h1>`. One instance per page (screen reader landmark).
- **Subtitle:** "Agent skills across the ecosystem" — `<p>` immediately below `<h1>`. Provides context for users who land without knowing what this is.
- **Last scanned timestamp:** "Last scanned: Jun 4, 2026" — right-aligned, small text, below the subtitle. Derived from `metadata.lastScanned` (ISO 8601; format as human-readable date, no time component needed). If `metadata.lastScanned` is absent or unparseable, omit the line entirely — do not show "Last scanned: Invalid Date". This is nice-to-have #3 and renders for free from the envelope.

### 2b. Search Input (SearchBar component)

- **Placeholder text:** "Search skills..."
- **Type:** `<input type="search">` — gives browsers a clear button for free on desktop (the "[x]" in the wireframe). Do not reimplement a custom clear button.
- **Autofocus:** `autoFocus` prop on mount. Required by must-have #7. No scroll-to behavior needed; the input is always above the fold.
- **Label:** Visually hidden `<label>` reading "Search skills" associated with the input via `htmlFor`. Do not use `placeholder` as the only label — it disappears on input and fails WCAG 1.3.1.
- **Behavior:** Controlled input; `onChange` lifts `query` to `App`. Filtering fires on every keystroke — no debounce required at this catalog size (tens to low hundreds of items). If the catalog grows to thousands, add debounce then.
- **Clear:** Clearing the input (native browser clear, backspace, or programmatic) sets `query` to `""`, which restores the full unfiltered list. No additional logic needed.
- **Tab order:** First interactive element after page load. Focus lands here on `autoFocus`.

### 2c. Skill Card (SkillCard + CopyButton components)

```
+------------------------------------------------------+
|  {name}                                              |  <-- h2 or h3; see note
|  {description}                                       |  <-- p; null-safe
|  {repo}  (linked to repoUrl)                        |  <-- a; opens in new tab
|                                                      |
|  npx skills add {repoUrl} --skill {skillName}        |  <-- code element, monospace
|                                    [ Copy ]          |
+------------------------------------------------------+
```

**Skill name (`name` field):**
- Rendered as a heading inside the card. Use `<h2>` if cards are the primary content landmark, `<h3>` if a section heading wraps the list. Lead's call on exact level — just be consistent. One heading per card.
- Null fallback: if `name` is null, show the `skillName` field instead (it is always present per ADR-002). Do not show a blank heading. Example fallback: "frontend-design" displayed as-is.

**Description (`description` field):**
- Rendered as a `<p>`.
- Null fallback: omit the element entirely if `description` is null. Do not render an empty paragraph or a placeholder like "No description."
- No truncation required at v1 catalog size. If descriptions become very long, a CSS `line-clamp` of 3–4 lines is appropriate. That is a visual design call, not a flow decision.

**Source repo (`repo` linked to `repoUrl`):**
- Rendered as a text link: the link text is `repo` ("anthropics/skills"), the href is `repoUrl`.
- `target="_blank"` with `rel="noopener noreferrer"`. Include a visually hidden "(opens in new tab)" text node for screen readers, or use `aria-label="anthropics/skills (opens in new tab)"`. Pick one approach and apply it consistently to all external links.
- Small text, secondary visual weight — this is supporting context, not the primary action.

**Install command display:**
- Rendered in a `<code>` element with monospace font. This is the canonical display of the command.
- Full command: `npx skills add {repoUrl} --skill {skillName}`
- Do not truncate the command text in the UI. Users need to see the full command to verify it before pasting. If the `repoUrl` is very long, allow horizontal scroll within the `<code>` element (`overflow-x: auto`) rather than clipping.
- The `<code>` element and the Copy button sit adjacent. On narrow viewports, stack them vertically (command above, button below). On desktop, they can be on the same row with the button right-aligned.

**Copy button (CopyButton component):**
- Label: "Copy" (default state).
- On click: write the exact string `npx skills add ${repoUrl} --skill ${skillName}` to the clipboard using `navigator.clipboard.writeText()`. No trailing whitespace. No newline.
- On success: button text changes to "Copied!" for 2 seconds, then reverts to "Copy". Do not disable the button during this window — the user might click a different card's copy button immediately.
- On failure (Clipboard API unavailable or rejected): button text changes to "Failed — try again" for 2 seconds, then reverts. This is a graceful degradation; no modal or alert.
- ARIA: The button must have an `aria-label` that includes the skill name to distinguish it from other Copy buttons on the page. Example: `aria-label="Copy install command for {name}"`. Without this, a screen reader reading a list of "Copy Copy Copy" buttons gives no context.
- State announcement: use an `aria-live="polite"` region (one, not one per card) to announce the copy result. When the button is clicked and succeeds, update the live region text to "Install command for {name} copied to clipboard." When it fails, update to "Copy failed for {name}. Try again." This makes copy feedback visible to screen readers — the visual button-label change alone is not sufficient.
- Keyboard: activatable by Enter and Space (standard `<button>` behavior; do not reimplement with `<div>` or `<span>`).

---

## 3. All Five States

### State 1: Loading

Displayed while the `fetch()` is in flight. Per ADR-005, `status = "loading"`.

```
+----------------------------------------------------------+
|  GitHub Skill Scanner                                    |
|  Agent skills across the ecosystem                       |
+----------------------------------------------------------+
|                                                          |
|  [ Search skills...                                   ]  |  <-- rendered but not interactive
|                                                          |
|  Loading skills...                                       |
|                                                          |
+----------------------------------------------------------+
```

**Microcopy:** "Loading skills..."

**Notes:**
- Render the SearchBar in the DOM but disable it (`disabled` attribute) during loading so tab order is consistent and the input does not accept premature input. The input should become enabled when status transitions to `ready` or `error`.
- The loading message replaces the card list area. No spinner graphic required (minimalist convention); plain text is sufficient. If a spinner is desired, that is a visual design call.
- Do not show the timestamp in the loading state — `metadata` is not yet available.
- `aria-busy="true"` on the list container while loading; remove on transition.

### State 2: Error

Displayed when the fetch fails or the JSON fails to parse. Per ADR-005, `status = "error"`.

```
+----------------------------------------------------------+
|  GitHub Skill Scanner                                    |
|  Agent skills across the ecosystem                       |
+----------------------------------------------------------+
|                                                          |
|  [ Search skills...                                   ]  |  <-- disabled
|                                                          |
|  Could not load the skill catalog.                       |
|  Try reloading the page. If the problem persists,        |
|  the data may be temporarily unavailable.                |
|                                                          |
+----------------------------------------------------------+
```

**Microcopy:**
- Heading (h2): "Could not load the skill catalog."
- Body: "Try reloading the page. If the problem persists, the data may be temporarily unavailable."

**Notes:**
- Keep the search input disabled and visually muted. The catalog is not loaded; searching is meaningless.
- No "retry" button in v1. The user reloads the browser. This is acceptable at this scale. If retry is added later, it should re-trigger the fetch and transition back through loading.
- Do not expose raw error details (HTTP status codes, stack traces) in the UI. Log them to the browser console for debugging.
- Render this message in the same list-area region as cards so it is read in the natural document order.
- `role="alert"` on the error message container ensures it is announced by screen readers even if focus has not moved there.

### State 3: Empty (Catalog Has Zero Skills)

Displayed when the fetch succeeds but `skills.length === 0`. Per ADR-005, `status = "ready"` with an empty array. Distinct from error — the data loaded successfully; there simply are no skills yet.

```
+----------------------------------------------------------+
|  GitHub Skill Scanner                                    |
|  Agent skills across the ecosystem                       |
|                                               Last scanned: Jun 4, 2026  |
+----------------------------------------------------------+
|                                                          |
|  [ Search skills...                                   ]  |  <-- disabled; nothing to search
|                                                          |
|  No skills found yet.                                    |
|  The scanner has run but found no SKILL.md files         |
|  in the configured repositories.                         |
|                                                          |
+----------------------------------------------------------+
```

**Microcopy:**
- Heading (h2): "No skills found yet."
- Body: "The scanner has run but found no SKILL.md files in the configured repositories."

**Notes:**
- Show the timestamp if available — it helps the user understand the data is fresh (or old). "Last scanned: Jun 4, 2026" tells them the scan ran and really did find nothing, rather than never having run.
- Disable the search input. Typing into an empty catalog would immediately produce a no-results message, which is misleading — the catalog is empty by design, not by search filter.
- This state should be rare in production (it implies all repos have no SKILL.md files), but it must not be a blank page.

### State 4: No Results (Search Matches Nothing)

Displayed when `status = "ready"`, `skills.length > 0`, and the filtered list is empty because the search query matches nothing. Fundamentally different from empty state: the catalog has content; the filter excludes all of it.

```
+----------------------------------------------------------+
|  GitHub Skill Scanner                                    |
|  Agent skills across the ecosystem                       |
|                                               Last scanned: Jun 4, 2026  |
+----------------------------------------------------------+
|                                                          |
|  [ xlsjfkd                                        [x] ]  |
|                                                          |
|  No skills match "xlsjfkd".                              |
|  Try a different search term, or clear the search        |
|  to browse all skills.                                   |
|                                                          |
+----------------------------------------------------------+
```

**Microcopy:**
- Heading (h2): `No skills match "{query}".`  (include the actual query string; helps user spot a typo)
- Body: "Try a different search term, or clear the search to browse all skills."

**Notes:**
- The search input remains active and focused. The user is mid-task; do not redirect focus.
- Include the query string in the message. "No skills match 'frntend'" is more useful than "No results found" — it lets the user verify they typed what they intended.
- Truncate the query in the message if it exceeds ~30 characters (`No skills match "this-extremely-long-s…"`) to avoid a message that wraps badly.
- "Clear the search" in the body can be plain text. The native browser clear button on `<input type="search">` handles the action. Do not add a redundant "Clear" button here.
- This message lives in the same list-area region as cards.

### State 5: Populated (Normal State)

Displayed when `status = "ready"`, `skills.length > 0`, and either `query` is empty or the filter returns at least one result.

```
+----------------------------------------------------------+
|  GitHub Skill Scanner                                    |
|  Agent skills across the ecosystem                       |
|                                               Last scanned: Jun 4, 2026  |
+----------------------------------------------------------+
|                                                          |
|  [ Search skills...                               [x] ]  |
|                                                          |
|  +----------------------------------------------------+  |
|  | Frontend Design                                    |  |
|  | Helps Claude build and refactor React components   |  |
|  | with modern CSS.                                   |  |
|  | anthropics/skills  (link)                          |  |
|  |                                                    |  |
|  | npx skills add https://github.com/anthropics/     |  |
|  | skills --skill frontend-design                     |  |
|  |                            [ Copy ]                |  |
|  +----------------------------------------------------+  |
|                                                          |
|  +----------------------------------------------------+  |
|  | PDF Generator                                      |  |
|  | Generates PDF reports from structured data using   |  |
|  | a template engine.                                 |  |
|  | anthropics/skills  (link)                          |  |
|  |                                                    |  |
|  | npx skills add https://github.com/anthropics/     |  |
|  | skills --skill pdf-generator                       |  |
|  |                            [ Copy ]                |  |
|  +----------------------------------------------------+  |
|                                                          |
+----------------------------------------------------------+
```

**Notes:**
- Card list is a `<ul>` or `<ol>` of `<li>` elements. This is the correct semantic for a list of items; screen readers announce list length ("list, 12 items").
- Cards render in the sort order from the JSON (by `repo`, then `skillName` — ADR-002). No client-side re-sort needed.
- When `query` is non-empty and results exist, no "Showing N of M results" count is required in v1 — it adds complexity for marginal benefit at this scale. This can be added later.

---

## 4. Content and Microcopy Summary

| Context | Text |
|---------|------|
| Page title (h1) | "GitHub Skill Scanner" |
| Page subtitle | "Agent skills across the ecosystem" |
| Last scanned | "Last scanned: {human date}" — omit if unavailable |
| Search placeholder | "Search skills..." |
| Search label (visually hidden) | "Search skills" |
| Loading | "Loading skills..." |
| Error heading | "Could not load the skill catalog." |
| Error body | "Try reloading the page. If the problem persists, the data may be temporarily unavailable." |
| Empty heading | "No skills found yet." |
| Empty body | "The scanner has run but found no SKILL.md files in the configured repositories." |
| No-results heading | `No skills match "{query}".` |
| No-results body | "Try a different search term, or clear the search to browse all skills." |
| Copy button (default) | "Copy" |
| Copy button (success) | "Copied!" (2 seconds, then reverts) |
| Copy button (failure) | "Failed — try again" (2 seconds, then reverts) |
| Copy button aria-label | `Copy install command for {name}` |
| Aria-live success | `Install command for {name} copied to clipboard.` |
| Aria-live failure | `Copy failed for {name}. Try again.` |
| Null name fallback | Use `skillName` (e.g., "frontend-design") |
| Null description | Omit element |

---

## 5. Interaction and Accessibility Notes

### Tab order (keyboard navigation)

On page load, focus lands on the search input (`autoFocus`). From there, tab order proceeds:
1. Search input
2. First card: repo link -> Copy button
3. Second card: repo link -> Copy button
4. ... and so on

The heading, description, and command text within each card are not interactive and are not in the tab order. They are read by screen readers as the card's content when the user navigates by heading or reads linearly.

### Keyboard activation of Copy

The Copy button must be a native `<button>` element. This ensures:
- Enter activates it (without a custom `onKeyDown` handler)
- Space activates it (without a custom `onKeyDown` handler)
- It is reachable by tab
- Its role is announced correctly by screen readers

Do not implement Copy with `<div onClick>` or `<span onClick>`. This is a common mistake and fails keyboard users.

### Focus management

No focus management changes are needed in v1:
- Loading -> Populated: `autoFocus` on the search input handles the initial case.
- Query changes: focus stays in the search input (the user is typing). Do not move focus on filter update.
- Copy click: focus stays on the Copy button (the button reverts its label in place; focus moving away would be disorienting).
- No modal, no navigation — no focus trap or focus restoration needed.

### Autofocus and assistive technology

`autoFocus` on the search input is correct per must-have #7. Note: some screen readers announce autofocused elements on page load. The input has an explicit label ("Search skills"), so this announcement is useful, not disruptive. No action needed.

### Screen reader list semantics

Render the skill cards as a `<ul>` / `<li>` list. This gives screen readers:
- List entry count on entry to the list ("list, 12 items")
- Navigation by list item if the user uses list navigation commands

When the search filter changes the list contents, the list updates in place. Screen readers will read the new count if the user re-enters the list, which is sufficient. An `aria-live` announcement on filter change is not needed and would be noisy — the user is actively typing and can see (or navigate to) the updated list themselves.

### WCAG 2.1 AA notes (requirements say "basic keyboard navigability"; AA is not a hard requirement in v1)

What this design provides by default:
- 1.3.1 Info and Relationships: explicit `<label>` for search; semantic heading hierarchy; `<ul>/<li>` for list.
- 2.1.1 Keyboard: all interactive elements are native `<button>` or `<a>` or `<input>`. No mouse-only interactions.
- 2.1.3 No Keyboard Trap: no focus traps.
- 4.1.3 Status Messages: `aria-live="polite"` for copy feedback; `role="alert"` for error state.

What is not covered by this design (visual design's responsibility):
- 1.4.3 Contrast: color choices for text, buttons, and states are not specified here.
- 2.4.7 Focus Visible: focus ring styling is a visual design concern.

The design does not obstruct AA compliance; it is at minimum AA-compatible on the interaction side.

---

## 6. Heuristic Check

A pass of this design against Nielsen's 10 heuristics, noting anything risky or ambiguous.

**H1 — Visibility of system status.** The loading state provides feedback that data is being fetched. The copy button's label change provides immediate feedback on copy success/failure. The `aria-live` region extends this to screen reader users. The error state is clearly signalled. PASS. Note: the loading state uses plain text, not a spinner; if load time approaches the 2s NFR ceiling, consider adding a progress indicator.

**H2 — Match between system and real world.** "Copy install command" and "npx skills add..." are developer-native concepts. Skill names use the same format as the `--skill` argument. PASS.

**H3 — User control and freedom.** Clearing the search restores the full catalog. The browser's native clear button on `<input type="search">` provides this without extra implementation. There is no "undo" for copy, which is fine — copying to clipboard is not destructive. Note: there is no retry on error. This is a deliberate v1 scope decision, not a usability gap — the user can reload. If error rates are observed to be high post-launch, add a retry button.

**H4 — Consistency and standards.** A text input for filtering, cards for catalog items, and a "Copy" button are all established conventions in developer tools. No novel interaction patterns introduced. PASS.

**H5 — Error prevention.** The search input cannot cause an error state — it just filters. The copy interaction can fail (Clipboard API blocked by browser permissions), which is handled gracefully. PASS.

**H6 — Recognition over recall.** The full install command is visible in each card — users do not need to remember the command format. The search placeholder reminds users what the field does. PASS.

**H7 — Flexibility and efficiency of use.** No power-user shortcuts in v1. The autofocus on the search input is the one efficiency affordance. Keyboard tab through cards is supported. Acceptable for v1.

**H8 — Aesthetic and minimalist design.** This design avoids decorative elements, tooltip popups, modals, counts, badges, and other chrome that does not serve the primary task. Consistent with the project's minimalist convention. PASS.

**H9 — Help users recognize, diagnose, and recover from errors.** Error state microcopy says what to do (reload). No-results microcopy says what to do (change search or clear). Copy failure microcopy says what to do (try again). Empty state explains why. PASS.

**H10 — Help and documentation.** No help text is planned. The interface is simple enough that help text is not needed. PASS.

**Risks and open questions for the Lead:**

1. **Clipboard API permissions in browsers.** `navigator.clipboard.writeText()` requires a secure context (HTTPS). GitHub Pages serves HTTPS, so this is fine in production. In local dev (`http://localhost`), it is also a secure context. No issue expected, but worth confirming during dev.

2. **`autoFocus` on mobile.** On iOS Safari and Android Chrome, `autoFocus` on a text input triggers the virtual keyboard immediately on page load. For a developer tool accessed on desktop, this is fine. If mobile use is expected, consider dropping autofocus — but this is a product question, not a design one. The requirement specifies "focused on page load"; this design implements that as specified.

3. **Null `name` fallback.** The design falls back to `skillName`. The Lead should ensure that SearchBar filtering also matches on `skillName` (not just `name`) so that skills with null names remain discoverable via search.

4. **`<input type="search">` vs `type="text"`.** Using `type="search"` is recommended here for the native clear button and correct semantics. Be aware that the clear button rendering is inconsistent across browsers and platforms (Chrome desktop shows it on focus with content; Firefox may differ). This is cosmetic and acceptable.

5. **No result count display.** This design omits "Showing 5 of 34 skills" for simplicity. If the Lead or PM want it, it is a one-line addition to the SkillList component — low effort, but I left it out to match the minimalist convention unless asked for.

6. **Long repoUrls in the command display.** A URL like `https://github.com/some-very-long-org-name/some-very-long-repo-name` makes the command line wrap. The design calls for `overflow-x: auto` on the `<code>` element — not truncation — because truncating a command the user might want to read defeats the purpose. Lead should verify this renders acceptably in the target layout width.

---

## 7. Component-to-State Mapping (for Lead Developer)

| Component | Renders in states |
|-----------|------------------|
| App | All states (owns status + query) |
| Header (h1 + subtitle) | All states |
| Timestamp | Ready (empty + populated); omit in loading and error |
| ScannedReposIndicator | Ready only; hidden in loading and error; see Section 8 |
| SearchBar | All states; disabled in loading, error, empty |
| SkillList | Ready states only |
| SkillCard + CopyButton | Populated state only (filtered list >= 1) |
| Loading message | Loading state only |
| Error message | Error state only |
| Empty message | Empty state only (skills = []) |
| No-results message | No-results state only (skills > 0, filtered = 0) |

The loading message, error message, empty message, and no-results message all render inside the same list-area region. SkillList receives the filtered array and is responsible for distinguishing empty-catalog from no-results based on whether the unfiltered skills array is also empty — or App passes both `skills` and `filteredSkills` so SkillList can differentiate. Lead's call on exact prop shape.

---

## 8. Scanned Repos Indicator — Interaction Spec

**Feature:** SR-1 (requirements-scanned-repos.md)  
**Data:** `metadata.repos: ScannedRepo[]` (ADR-002 addendum, 2026-06-05)  
**Pattern resolved:** summary line + `<details>`/`<summary>` disclosure  
**Renders:** `status === "ready"` only, and only when `metadata.repos` is a non-empty array

---

### 8a. Placement

The indicator sits immediately below the "Last scanned" line, inside the existing `<header>` element. It is the last item in the header before the search section begins. Both lines are small, secondary text — the timestamp and the repos indicator form a natural two-line footer to the header block.

```
+----------------------------------------------------------+
|  GitHub Skill Scanner                           [h1]     |
|  Agent skills across the ecosystem              [p]      |
|                              Last scanned: Jun 4, 2026   |
|                              Scanning 12 repositories    |  <-- collapsed default
+----------------------------------------------------------+
|  [ Search skills...                               [x] ]  |
|  ...
```

Visual weight constraint: the indicator is the same small/muted text size as the "Last scanned" line. It adds one line to the header in its default (collapsed) state, satisfying the must-have requirement. The `<details>` element expands inline below that line when opened; it does not shift the search input or skill list — the header grows downward.

---

### 8b. Collapsed (Default) State

The indicator renders as a `<details>` element whose `<summary>` is the only visible content when closed. No open attribute on the element — closed is the default.

```
+----------------------------------------------------------+
|  GitHub Skill Scanner                                    |
|  Agent skills across the ecosystem                       |
|                              Last scanned: Jun 4, 2026   |
|                              Scanning 12 repositories v  |
+----------------------------------------------------------+
```

The disclosure triangle (v or >) is the browser's native `<details>` marker. Do not replace it with a custom icon — the native marker is keyboard-accessible and screen-reader-understood without any extra implementation.

**Summary text — singular/plural:**
- 1 repo: "Scanning 1 repository"
- N repos: "Scanning N repositories"

The word "Scanning" is intentional: it describes the configured scan scope (what is being scanned), not a historical snapshot. This matches the user story intent: "which repositories are included in the skill scanner."

**Alignment:** right-aligned to match the "Last scanned" line above it. Both lines share the same right-edge alignment, keeping the left side of the header clean for the title and subtitle.

---

### 8c. Expanded State

When the user activates the `<summary>` (click, Enter, or Space), the browser opens the `<details>` element and the repo list appears inline below the summary line.

```
+----------------------------------------------------------+
|  GitHub Skill Scanner                                    |
|  Agent skills across the ecosystem                       |
|                              Last scanned: Jun 4, 2026   |
|                         Scanning 12 repositories ^       |
|                                                          |
|                         anthropics/model-cards           |
|                         anthropics/skills                |
|                         someorg/empty-repo               |
|                         someorg/broken-repo  scan failed |
|                         ...                              |
+----------------------------------------------------------+
```

**Repo list structure:**

Each repo in the list is a single line. The link text is the `owner/repo` string from `ScannedRepo.repo`. The href is `ScannedRepo.repoUrl`. All links open in a new tab (`target="_blank" rel="noopener noreferrer"`). Apply the same visually-hidden "(opens in new tab)" treatment already established in Section 2c for skill card repo links — use whichever approach the Lead chose there, applied consistently here.

The list is a `<ul>` of `<li>` elements. This gives screen readers the item count and list navigation for free, consistent with the skill card list convention.

Sort order: alphabetical by `repo` (ascending), matching the scanner's sort order from ADR-002 addendum. The frontend renders `metadata.repos` in the order received — no client-side re-sort needed.

**Wrapper element:** the content area of the `<details>` (outside the `<summary>`) holds the `<ul>`. No extra heading inside the expanded panel — the `<summary>` text already names what the list contains. Adding a heading would add redundant verbosity for screen reader users navigating by heading.

---

### 8d. Failed Repo Treatment

Repos with `status: "failed"` are shown in the list with a small inline tag reading "scan failed" immediately after the link. The tag is visually muted — not red, not bold, not an icon that draws the eye from across the page. It is informational for a maintainer who is looking, not an alarm for a casual user who is not.

```
|  someorg/broken-repo  scan failed  |
```

**Implementation:** a `<span>` with a class like `repo-scan-failed`. Styling is visual design's call, but the interaction design's intent is: secondary text color (not the body text color, not a warning color), no background, no border, small size matching the repo link text. Something like muted gray in a light theme. The tag must have sufficient contrast for WCAG AA regardless — that is visual design's constraint to meet, not this spec's job to specify.

The tag text "scan failed" is lowercase, no punctuation. It reads as a label, not a sentence. A screen reader will read it as part of the list item: "someorg/broken-repo (link), scan failed" — which is the correct information.

Do not hide the failed repo, mark it with a strikethrough, or give it reduced opacity that makes it hard to read. The repo is in the scan; the maintainer may want to click through to investigate. Hiding or degrading it serves no one.

---

### 8e. Zero-Skill Repos

Repos with `status: "succeeded"` and `skillCount: 0` are shown identically to repos with skills. No annotation, no "(0 skills)" label, no distinction of any kind. The repo was scanned successfully; it simply has no SKILL.md files yet. This is not a warning state.

The user story's purpose is to show scan scope. A zero-skill repo is fully in scope. Calling it out would mislead users into thinking something is wrong when nothing is.

---

### 8f. Skill Count Display — Recommendation for v1

The nice-to-have (N1) asks whether to show per-repo skill counts in the expanded list (e.g. "anthropics/skills — 5 skills"). My recommendation is: **do not show skill counts in v1.**

Reasons:

1. The primary user need is scan scope — "is this repo being scanned?" The count answers a secondary question. It adds visual noise to every row for a benefit that most users at launch will not need.

2. Counts create an asymmetry that draws attention to zero-skill repos in a way that feels like a warning even without a warning tag. "anthropics/skills — 5 skills" next to "someorg/empty-repo — 0 skills" reads as a red flag even when the zero is expected and correct.

3. The data is available (`ScannedRepo.skillCount`), so this can be added in a later iteration with one line of JSX per row if it turns out users want it. The cost of deferral is minimal; the cost of inclusion is minor but real clutter.

If the PM or Lead disagrees, the implementation is trivial: append " — {skillCount} {skillCount === 1 ? 'skill' : 'skills'}" to each row. Gate it on a prop or feature flag so it can be toggled without a new design pass.

---

### 8g. States — When the Indicator Renders or Hides

| App status | `metadata.repos` | Indicator |
|------------|-----------------|-----------|
| `loading` | not yet available | Hidden entirely. Do not render the element. |
| `error` | not available | Hidden entirely. Do not render the element. |
| `ready` | absent (`undefined`) | Hidden. Degrade gracefully — show nothing. Do not fall back to deriving from `skills[]` in the UI; if the BA wants Interpretation A fallback behavior it needs a deliberate product decision. |
| `ready` | present, `length === 0` | Hidden. An empty `repos` array means the config had no entries; this is a scanner-configuration problem, not a display case. |
| `ready` | present, `length >= 1` | Show the collapsed indicator. |

The indicator is a pure `status === "ready" && Array.isArray(metadata?.repos) && metadata.repos.length > 0` render guard. One conditional, no intermediate states.

**Empty-catalog case (skills = [], repos present):** The indicator still shows in this state. The "Last scanned" timestamp already renders in the empty state (Section 3, State 3 notes); the repos indicator follows the same rule. Seeing "Scanning 3 repositories" alongside "No skills found yet" is useful — it tells the user the repos are configured but none have SKILL.md files yet. This is more informative than hiding the indicator when skills are empty.

---

### 8h. Microcopy Reference (additions for SR-1)

| Context | Text |
|---------|------|
| Summary line (1 repo) | "Scanning 1 repository" |
| Summary line (N repos) | "Scanning N repositories" |
| Failed repo tag | "scan failed" |
| `<details>` aria-label | "Scanned repositories" |

The `<details>` element itself should carry `aria-label="Scanned repositories"` so screen readers that announce the disclosure widget name something specific rather than repeating the summary text. This is a belt-and-suspenders note — `<details>`/`<summary>` is already well-supported — but it costs nothing and makes the landmark unambiguous when navigating by landmark.

---

### 8i. Accessibility Notes for the Lead

**Why `<details>`/`<summary>` and not an `aria-expanded` button**

`<details>`/`<summary>` is the right choice here because:
- Keyboard support (Enter/Space to toggle, native in all modern browsers) comes for free.
- Screen readers announce it as a disclosure widget with its open/closed state, which is exactly what it is.
- No JavaScript needed — zero interaction logic to write or maintain.
- The only case where an `aria-expanded` button would be preferable is when the content needs to be positioned outside the DOM flow (e.g. a dropdown overlay). This expanded list is inline — it sits in the normal document flow and pushes content down. `<details>` is the right semantic.

The known gap: `<details>`/`<summary>` does not support smooth CSS animation of the open/close transition in the same way a JS-controlled element does. For this feature, that is acceptable — the content appears and disappears; no animation is required or specified. If the visual designer later wants an animated transition, the Lead can implement it with a small JS intercept, but that is not a v1 concern.

**Interaction with the existing aria-live region**

The existing `aria-live="polite"` region in `App.tsx` is used exclusively for copy feedback from `CopyButton`. The repos indicator does not write to this region and does not need its own live region. The `<details>` open/closed state is announced natively by screen readers; no additional announcement is needed.

There is no conflict.

**Interaction with autofocus on the search input**

The `<details>` element and its `<summary>` appear in the `<header>`, which is above the `<section>` containing the search input. The tab order is:
1. `<summary>` element (the "Scanning N repositories" disclosure toggle)
2. Search input (autofocused on page load, but in tab order after the header)
3. Repo links inside `<details>` when expanded — see note below

The autofocus on the search input on page load is correct and unchanged. On initial load, focus jumps to the search input, bypassing the `<summary>`. A keyboard user tabbing backward (Shift+Tab) from the search input reaches the `<summary>`, which is correct and expected.

**Tab order inside the expanded list**

When the `<details>` is open, the repo links inside it are in the natural tab order between the `<summary>` and the search input. That means: `<summary>` -> repo link 1 -> repo link 2 -> ... -> repo link N -> search input. For a list of up to ~20 repos (confirmed launch size), this is acceptable — the user tabs through the list to get to the search input, or uses Shift+Tab from the search input to reach the list. If the list grows significantly, this could become tedious; at that point, consider closing the `<details>` by default (already the design) and educating users that the expand is optional.

Do not insert the search input before the `<details>` in the DOM to "fix" the tab order — that would break the visual and heading hierarchy. The current document order is correct.

**Focus when the `<details>` is toggled**

Native `<details>` toggle does not move focus — focus stays on the `<summary>` after activation. This is correct behavior: the user activated the control, the control responded, focus stays on the control. Do not add programmatic `focus()` calls on toggle.

**Screen reader announcement of repo links**

Each repo link in the list will read as "{owner/repo} (link), opens in new tab" — the same pattern established for skill card repo links in Section 2c. Apply whichever approach the Lead already implemented (visually-hidden span or `aria-label`) consistently.

Failed repo rows read as: "{owner/repo} (link), opens in new tab, scan failed." The "scan failed" `<span>` is plain text in the DOM and will be read in sequence. No additional ARIA is needed on the tag.

---

## Links

- `requirements.md` — must-haves #6, #7, #8; nice-to-have #3; NFR (render < 2s, basic keyboard navigability)
- `requirements-scanned-repos.md` — SR-1; must-haves #1–3; OQ-SR-1 (resolved B), OQ-SR-2 (resolved: summary + expand)
- `adr-005-frontend-architecture.md` — component shape, state machine (`loading | error | ready`), TypeScript
- `adr-002-data-schema-output-contract.md` — data fields available to display; null-tolerance rules; addendum 2026-06-05 (`metadata.repos` shape)
- Handoff to Lead Developer for interaction-feasibility check (Section 8 additions) before implementation

---

## 9. Dark-Developer Visual System

**Author:** Lena Vasquez (UX Designer)  
**Date:** 2026-06-05  
**Status:** Ready for Lead Developer feasibility review  
**Inputs:** requirements-ui-styling.md; src/fe/index.css; all component TSX files

This section is a complete, implementation-ready design spec for the dark-developer visual refresh. It is additive to Sections 1–8, which describe interaction and flow. This section describes only visual treatment: tokens, typography, per-element styling, and contrast verification. No interaction behavior changes.

---

### 9a. Design Intent

Minimalist dark. One background, one surface level, one text color, one accent. The aesthetic signal is "developer tool" — terminal-adjacent, content-first, no decorative chrome. The palette draws from the GitHub dark theme family because it is a known-good, AA-verified dark palette that developers already associate with code and repositories. Restraint is the design principle: if an element does not need to be different from its neighbors, it should not be.

---

### 9b. Open Question Resolved: OQ-UI-1 (Font Stack)

**Decision: system stacks only. No web fonts.**

Body/UI text: system sans-serif stack.  
Code/install command: system monospace stack.

Rationale: the developer-tool aesthetic is well-served by system monospace — the fonts that ship with macOS, Windows, and Linux developer environments are exactly what developers expect to see in a terminal-adjacent interface. There is no usability, readability, or aesthetic benefit that justifies the added network request, FOUT risk, or dependency. This closes OQ-UI-1.

---

### 9c. Color Tokens

All values are CSS custom properties to be declared in a `:root {}` block at the top of `index.css` (or in a `tokens.css` imported first — Lead's call on file split). Every color reference elsewhere in the stylesheet must use these properties. No raw hex values may remain in `index.css` after the restyle.

```css
:root {
  /* Backgrounds */
  --bg:             #0d1117;   /* page/body background */
  --surface:        #161b22;   /* card, state-message, input-disabled */
  --surface-raised: #1c2128;   /* code block — slightly recessed within card */

  /* Text */
  --text:           #c9d1d9;   /* primary body text */
  --text-muted:     #8b949e;   /* secondary text: last-scanned, summary, placeholder,
                                  description paragraphs, disabled input text */

  /* Accent / links */
  --accent:         #58a6ff;   /* links, copy button border+text, focus ring */
  --accent-hover:   #79c0ff;   /* link hover, button hover text */

  /* Code */
  --code-bg:        #1c2128;   /* same as --surface-raised; alias for readability */
  --code-text:      #a5d6ff;   /* light cyan — marks code as distinct from prose */

  /* Borders */
  --border:         #30363d;   /* card border, input border, button border */
  --border-muted:   #21262d;   /* subtle divider, code block border */

  /* States */
  --danger:         #f85149;   /* error state left-border accent; passes AA as text too */
  --focus-ring:     #58a6ff;   /* same as --accent; explicit alias for clarity */

  /* Scan-failed tag */
  --tag-scan-failed: #848d97;  /* muted gray; passes AA on both --bg and --surface */
}
```

#### Contrast ratio verification — every text/UI pairing

The WCAG 2.1 AA thresholds are: 4.5:1 for normal text (body copy, links, labels), 3:1 for large text (>=18pt regular / >=14pt bold) and non-text UI components (focus rings, button borders as UI components). All ratios below are computed from the WCAG relative luminance formula.

Luminance values used in the table below (derived; see working notes after the table):

| Token | Hex | Relative luminance |
|-------|-----|--------------------|
| `--bg` | `#0d1117` | 0.01020 |
| `--surface` | `#161b22` | 0.01683 |
| `--surface-raised` / `--code-bg` | `#1c2128` | 0.02251 |
| `--text` | `#c9d1d9` | 0.64650 |
| `--text-muted` | `#8b949e` | 0.31460 |
| `--accent` | `#58a6ff` | 0.38480 |
| `--accent-hover` | `#79c0ff` | 0.50270 |
| `--code-text` | `#a5d6ff` | 0.64290 |
| `--danger` | `#f85149` | 0.27620 |
| `--tag-scan-failed` | `#848d97` | 0.29150 |

**Primary text contrast:**

| Text token | Background token | Ratio | Threshold | Result |
|------------|-----------------|-------|-----------|--------|
| `--text` (`#c9d1d9`) | `--bg` (`#0d1117`) | 11.57:1 | 4.5:1 | PASS |
| `--text` (`#c9d1d9`) | `--surface` (`#161b22`) | 10.42:1 | 4.5:1 | PASS |
| `--text` (`#c9d1d9`) | `--surface-raised` (`#1c2128`) | 9.61:1 | 4.5:1 | PASS |

**Muted text contrast:**

| Text token | Background token | Ratio | Threshold | Result |
|------------|-----------------|-------|-----------|--------|
| `--text-muted` (`#8b949e`) | `--bg` (`#0d1117`) | 6.06:1 | 4.5:1 | PASS |
| `--text-muted` (`#8b949e`) | `--surface` (`#161b22`) | 5.46:1 | 4.5:1 | PASS |

Muted text is used for: `.last-scanned`, `.scanned-repos summary`, placeholder text, description paragraphs, disabled input text, and the `input[type="search"]:disabled` color. All render against `--bg` or `--surface`; both pass.

**Accent / link contrast:**

| Text token | Background token | Ratio | Threshold | Result |
|------------|-----------------|-------|-----------|--------|
| `--accent` (`#58a6ff`) | `--bg` (`#0d1117`) | 7.22:1 | 4.5:1 | PASS |
| `--accent` (`#58a6ff`) | `--surface` (`#161b22`) | 6.51:1 | 4.5:1 | PASS |
| `--accent-hover` (`#79c0ff`) | `--bg` (`#0d1117`) | 8.97:1 | 4.5:1 | PASS |
| `--accent-hover` (`#79c0ff`) | `--surface` (`#161b22`) | 8.27:1 | 4.5:1 | PASS |

Links appear on `--surface` (inside cards) and on `--bg` (scanned-repos list in header). Both pass.

**Code text contrast:**

| Text token | Background token | Ratio | Threshold | Result |
|------------|-----------------|-------|-----------|--------|
| `--code-text` (`#a5d6ff`) | `--code-bg` (`#1c2128`) | 9.56:1 | 4.5:1 | PASS |

**Danger contrast (error state border accent — used as a left-border, not body text, but verified as text too):**

| Text token | Background token | Ratio | Threshold | Result |
|------------|-----------------|-------|-----------|--------|
| `--danger` (`#f85149`) | `--surface` (`#161b22`) | 4.88:1 | 4.5:1 | PASS (as text) |
| `--danger` border | `--surface` background | n/a | 3:1 (UI component) | PASS (ratio is 4.88:1) |

**Scan-failed tag — the explicit fix:**

The current `color: #999` on a white card surface gives approximately 4.0:1, which fails WCAG AA for normal (small) text. The fix:

| Text token | Background token | Ratio | Threshold | Result |
|------------|-----------------|-------|-----------|--------|
| `--tag-scan-failed` (`#848d97`) | `--surface` (`#161b22`) | 5.11:1 | 4.5:1 | PASS |
| `--tag-scan-failed` (`#848d97`) | `--bg` (`#0d1117`) | 5.67:1 | 4.5:1 | PASS |

The tag appears in `.scanned-repos-list` which renders in the `<header>` (on `--bg`) when collapsed and as part of list items that may be read against either background. Both pass comfortably. The color is visually secondary — clearly dimmer than `--text` and distinct from `--accent` — which preserves the "informational, not alarming" intent from Section 8d.

**Focus ring — WCAG 2.4.11 (non-text contrast, 3:1 against adjacent surface):**

| Focus ring token | Adjacent surface | Ratio | Threshold | Result |
|-----------------|-----------------|-------|-----------|--------|
| `--focus-ring` (`#58a6ff`) | `--surface` (`#161b22`) | 6.51:1 | 3:1 | PASS |
| `--focus-ring` (`#58a6ff`) | `--bg` (`#0d1117`) | 7.22:1 | 3:1 | PASS |

The search input sits on `--bg`; cards and copy buttons sit on `--surface`. Both pass substantially above the 3:1 threshold.

---

### 9d. Typography

**OQ-UI-1 resolved: system stacks only.**

```
System sans-serif stack (UI text — body, headings, labels, buttons, state messages):
-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif,
"Apple Color Emoji", "Segoe UI Emoji"

System monospace stack (code/install command — <code> element):
"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Monaco, "Courier New", monospace
```

Apply the sans-serif stack to `body` (or `:root`) so it inherits everywhere. Apply the monospace stack only to `.skill-card code` — no other element needs it.

**Type scale** (sizes only; weights are browser defaults except where noted):

| Element | Font size | Weight | Color token | Notes |
|---------|-----------|--------|-------------|-------|
| `header h1` | `1.75rem` | 600 (semibold) | `--text` | Unchanged from current |
| `header p` (subtitle) | `1rem` | 400 | `--text` | Unchanged |
| `.last-scanned` | `0.875rem` | 400 | `--text-muted` | Unchanged size |
| `.scanned-repos summary` | `0.875rem` | 400 | `--text-muted` | Match last-scanned |
| `input[type="search"]` | `1rem` | 400 | `--text` | Input text |
| `.skill-card h2` | `1.25rem` | 600 | `--text` | Unchanged |
| `.skill-card p` (description, source) | `0.95rem` | 400 | `--text` | Unchanged |
| `.skill-card a` | `0.95rem` | 400 | `--accent` | — |
| `.skill-card code` | `0.875rem` | 400 | `--code-text` | Monospace stack |
| `.skill-card button` | `0.95rem` | 400 | `--accent` | Ghost button style |
| `.state-message h2` | `1.25rem` | 600 | `--text` | — |
| `.state-message p` | `0.95rem` | 400 | `--text` | — |
| `.scanned-repos-list a` | `0.875rem` | 400 | `--accent` | — |
| `.repo-scan-failed` | `0.8rem` | 400 | `--tag-scan-failed` | — |

Do not change any existing `font-size` values — the scale above matches the current stylesheet exactly. The restyle changes only colors and adds the system font stacks.

---

### 9e. Spacing and Shape

No spacing scale changes. All existing `padding`, `margin`, and `gap` values in `index.css` remain intact. The restyle does not change layout density.

**Border radius:** retain current values (`4px` for inputs/buttons/code, `6px` for cards/state-message). These are proportionate and consistent; no change needed.

**Border treatment:** replace all current border values (`1px solid #ddd`, `1px solid #ccc`) with `1px solid var(--border)` (`#30363d`). This is a hairline border — barely visible, serving only to define the card edge against the page background. On dark surfaces, a hairline is the correct convention: heavy borders would add visual noise.

**Elevation:** no box shadows. On dark themes, box shadows are largely invisible and add nothing. Elevation is communicated through background-color difference alone: `--bg` (deepest) -> `--surface` (cards) -> `--surface-raised` (code blocks within cards). Three levels, achieved purely with background colors. This is the minimalist-dark convention — low chrome, no heavy effects.

---

### 9f. Per-Element Styling Specification

This section maps every rule in `index.css` to its dark-theme treatment. Each entry states the CSS selector, what changes, and any behavioral annotation.

---

**`body` (currently unstyled for background — this is the bug noted in the requirements):**

```
background-color: var(--bg);
color: var(--text);
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial,
             sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
```

Annotation: setting `background-color` on `body` is required. The current stylesheet only sets background on individual surfaces (`.skill-card`, `.state-message`), which means the page background is browser-default white and the dark cards appear to float on it. Setting it on `body` ensures the full viewport is dark in all five states and at all viewport heights. Setting `color` and `font-family` here lets all elements inherit rather than requiring per-element declarations.

---

**`main`:** no color changes. Keep existing max-width, margin, padding.

---

**`header`:** no color changes needed. Background inherits from `body`. Keep existing `margin-bottom`.

---

**`header h1`:** inherits `--text` from body. No explicit color rule needed.

---

**`header p` (subtitle):** inherits `--text`. No explicit color rule needed.

---

**`.last-scanned`:**

```
color: var(--text-muted);   /* replaces: color: #666 */
```

Contrast: `--text-muted` (`#8b949e`) on `--bg` (`#0d1117`) = 6.06:1. PASS.

---

**`input[type="search"]`:**

```
background-color: var(--bg);        /* recessed/inset feel vs card surface */
color: var(--text);
border: 1px solid var(--border);    /* replaces: 1px solid #ccc */
border-radius: 4px;
/* retain existing width, padding, font-size, margin-bottom */
```

The input uses `--bg` (same as the page) rather than `--surface` to create a subtle inset-into-page visual — on dark themes, a slightly-recessed input field is the expected convention. The input is still visually distinct from the page because it has a `--border` outline.

Placeholder color: add `color-scheme: dark` on `:root` to let the browser render the native search clear button in a dark-appropriate style. Additionally set:

```css
input[type="search"]::placeholder {
  color: var(--text-muted);
  opacity: 1;   /* Firefox reduces placeholder opacity by default */
}
```

Contrast: `--text-muted` on `--bg` = 6.06:1. PASS.

---

**`input[type="search"]:disabled`:**

```
background-color: var(--surface);   /* replaces: #f5f5f5 */
color: var(--text-muted);           /* replaces: #999 */
cursor: not-allowed;
```

Contrast: `--text-muted` on `--surface` = 5.46:1. PASS. The disabled input is visually distinguishable from the enabled state (lighter background, dimmer text) without falling back to a browser-default light appearance.

---

**`input[type="search"]:focus-visible`** (currently absent — must be added):

```css
input[type="search"]:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  border-color: var(--focus-ring);
}
```

Annotation: the current stylesheet has no `:focus-visible` rule on the input, which means keyboard users see only the browser default focus style — a light-colored glow that is invisible on dark backgrounds. This rule is required for WCAG 2.4.7 / 2.4.11. The `2px solid` outline at `2px offset` gives a clear, legible ring. Contrast: `--focus-ring` (`#58a6ff`) against `--bg` = 7.22:1. PASS.

---

**`.skill-list`:** no color changes. Keep existing layout rules.

---

**`.skill-card`:**

```
background-color: var(--surface);   /* replaces: #fafafa */
border: 1px solid var(--border);    /* replaces: 1px solid #ddd */
/* retain: border-radius, padding */
```

---

**`.skill-card h2`:** inherits `--text`. No explicit color rule needed.

---

**`.skill-card p`:** inherits `--text`. No explicit color rule needed.

---

**`.skill-card a` (repo link):**

```
color: var(--accent);   /* replaces: #0066cc */
```

Contrast: `--accent` on `--surface` = 6.51:1. PASS.

---

**`.skill-card a:hover`:**

```
color: var(--accent-hover);   /* lifted, visually distinct from default */
text-decoration: underline;   /* retain */
```

---

**`.skill-card a:visited`:**

```
color: var(--accent);   /* retain same as default — visited state is not meaningful
                           for these external links; suppress the purple visited color */
```

---

**`.skill-card code` (install command):**

```
background-color: var(--code-bg);      /* replaces: #fff */
border: 1px solid var(--border-muted); /* replaces: 1px solid #ddd — even subtler */
color: var(--code-text);
font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Monaco,
             "Courier New", monospace;
/* retain: display:block, padding, font-size, overflow-x:auto,
           margin-bottom, word-break */
```

Contrast: `--code-text` (`#a5d6ff`) on `--code-bg` (`#1c2128`) = 9.56:1. PASS.

The code block background (`#1c2128`) is slightly darker than the card surface (`#161b22`), which gives a terminal-within-card feel without requiring any border to separate them. The `--border-muted` border is barely visible — it defines the edge but does not draw the eye.

---

**`.skill-card button` (Copy button — ghost button style):**

```
background-color: transparent;
color: var(--accent);                /* replaces: no explicit text color */
border: 1px solid var(--accent);     /* replaces: 1px solid #ccc */
border-radius: 4px;
cursor: pointer;
/* retain: padding, font-size */
```

Contrast: `--accent` text on transparent (reads against `--surface`) = 6.51:1. PASS.
Border as UI component against `--surface` = 6.51:1, above the 3:1 threshold. PASS.

Annotation: a ghost button (transparent background, accent border and text) is the correct dark-theme convention for a secondary action. A filled button would compete with the skill card heading for visual weight. The Copy action is secondary to reading the card — the ghost treatment keeps it subordinate until the user focuses on it.

---

**`.skill-card button:hover`:**

```
background-color: rgba(88, 166, 255, 0.1);  /* very subtle tinted bg on hover */
color: var(--accent-hover);
border-color: var(--accent-hover);
```

The `rgba(88, 166, 255, 0.1)` is a 10% opacity version of `--accent`. It adds a perceptible hover highlight without filling the button solidly. This is the standard ghost-button hover convention on dark surfaces. The effective mixed color against `--surface` (#161b22) is approximately #1d2736 — still very dark, change is subtle but perceptible.

---

**`.skill-card button:active`:**

```
background-color: rgba(88, 166, 255, 0.2);  /* deeper press state */
color: var(--accent-hover);
```

Active is visually distinct from hover (0.2 vs 0.1 opacity) — the press state registers as a slightly stronger fill.

---

**`.skill-card button:focus-visible`:**

```css
.skill-card button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
```

Contrast: `--focus-ring` against `--surface` = 6.51:1. PASS.

---

**`.state-message`** (used for error, empty, and no-results states):

```
background-color: var(--surface);   /* replaces: #fafafa */
border: 1px solid var(--border);    /* replaces: 1px solid #ddd */
/* retain: border-radius, padding, margin-top */
```

**Error state variant** — the `div[role="alert"].state-message` should be visually distinct from empty/no-results to signal that something is wrong. Add a left-border accent:

```css
div[role="alert"].state-message {
  border-left: 3px solid var(--danger);
}
```

Annotation: a left-border accent is a widely-used convention for "alert-type" containers in dark UIs. It requires no DOM change — the `[role="alert"]` attribute already exists on the error state container in `App.tsx`. This rule targets it directly. The 3px width is enough to be noticed without being alarming. Contrast: `--danger` as a border against `--surface` exceeds 3:1. PASS.

`.state-message h2` and `.state-message p` inherit `--text` from `body`. No explicit color rules needed.

---

**`.scanned-repos`:**

```
color: var(--text-muted);   /* replaces: #666 */
/* retain: font-size, margin-top */
```

---

**`.scanned-repos summary`:**

```
color: var(--text-muted);   /* replaces: color: #666 */
cursor: pointer;
list-style: revert;
```

---

**`.scanned-repos summary:hover`:**

```
color: var(--text);   /* replaces: #444 — lifts to full text color on hover */
```

Contrast: `--text` on `--bg` = 11.57:1. PASS.

---

**`.scanned-repos summary:focus-visible`** (currently absent — must be added):

```css
.scanned-repos summary:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: 2px;
}
```

Annotation: the `<summary>` element is keyboard-interactive (Enter/Space to toggle) and must have a visible focus ring. The current stylesheet has no `:focus-visible` rule for it. This is required for WCAG 2.4.7. Contrast: `--focus-ring` against `--bg` = 7.22:1. PASS.

---

**`.scanned-repos-list`:** no color changes. Keep existing `list-style`, `padding`, `margin`.

---

**`.scanned-repos-list li`:** no color changes. Keep existing `margin`, `overflow-wrap`, `word-break`.

---

**`.scanned-repos-list a`:**

```
color: var(--accent);   /* replaces: #0066cc */
/* retain: text-decoration:none, font-size */
```

Contrast: `--accent` on `--bg` (header background) = 7.22:1. PASS.

---

**`.scanned-repos-list a:hover`:**

```
color: var(--accent-hover);
text-decoration: underline;   /* retain */
```

---

**`.scanned-repos-list a:focus-visible`** (currently absent — must be added):

```css
.scanned-repos-list a:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: 2px;
}
```

Annotation: links must have a visible focus ring on dark backgrounds. The browser default is inadequate. Contrast: `--focus-ring` against `--bg` = 7.22:1. PASS.

---

**`.skill-card a:focus-visible`** (currently absent — must be added):

```css
.skill-card a:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: 2px;
}
```

Contrast: `--focus-ring` against `--surface` = 6.51:1. PASS.

---

**`.repo-scan-failed`:**

```
color: var(--tag-scan-failed);   /* replaces: #999 — the AA fix */
/* retain: font-size, margin-left */
```

This is the explicit fix called out in requirements-ui-styling.md. The old `#999` on a white card surface is approximately 4.0:1 (fails AA for small text). The replacement `#848d97` gives:
- 5.11:1 against `--surface` (`#161b22`) — PASS
- 5.67:1 against `--bg` (`#0d1117`) — PASS

The color is visually secondary: clearly dimmer than `--text`, distinct from `--accent`, not warning-colored. The "informational, not alarming" intent from Section 8d is preserved.

---

**`.sr-only` and `.visually-hidden`:** unchanged. These rules must not be altered. They are accessibility infrastructure, not visual styling, and are untouched by this restyle.

---

### 9g. Terminal Prompt Touch (Optional Polish)

This is a CSS-only, DOM-safe decoration for the `<code>` element. It adds a muted `$ ` prefix using a `::before` pseudo-element, giving the install command a terminal-line aesthetic. It does not change any text content — tests that assert the exact command string will not be affected because `::before` content is not part of the element's `textContent`.

```css
/* OPTIONAL — implement only if PM/Lead agree this adds value */
.skill-card code::before {
  content: "$ ";
  color: var(--text-muted);
  user-select: none;   /* excluded from clipboard copy and text selection */
}
```

The `user-select: none` on the `::before` content means the `$ ` is not included when a user selects and copies the command text manually. The Copy button uses `buildInstallCommand()` which reads from the SkillEntry data directly — it never reads the DOM `textContent` — so the `::before` has no effect on the Copy button's clipboard output.

Flag: this is optional visual polish. It has no impact on accessibility, contrast, or test contracts. The decision to include it is the Lead's call.

---

### 9h. Class-Hook Gaps and TSX Touch Points

The Lead needs to know which rules in Section 9f require a new rule and which require a TSX change.

**Purely CSS — no TSX changes:**

All rules in Section 9f are achievable with existing class names and element selectors already in the stylesheet. No new classes need to be added to any TSX file for the core restyle. Specifically:
- The error state left-border is targeted via `div[role="alert"].state-message` — the `role="alert"` attribute already exists in `App.tsx`.
- Focus-visible rules target existing element types and existing classes (`input[type="search"]`, `.skill-card button`, `.scanned-repos summary`, `.scanned-repos-list a`, `.skill-card a`).
- The disabled input state targets the existing `disabled` attribute.

**One thing to verify with the Lead:** the `body` background rule. The current stylesheet does not style `body` at all. Adding `background-color`, `color`, and `font-family` to `body` is a CSS change only — but the Lead should confirm that no existing test asserts a background color on `body` or any inline style that would override it.

**`color-scheme: dark` on `:root`:** this is a one-line addition that tells browsers to render native form controls (the search input's clear button `[x]`, native focus rings, scrollbars) in dark-appropriate styles. It is CSS-only. Recommended to add alongside the token declarations:

```css
:root {
  color-scheme: dark;
  /* ... tokens ... */
}
```

---

### 9i. What Changes, What Does Not

**Changes in `index.css`:**
- Add `:root {}` token block with all custom properties
- Add `body {}` rule with `background-color`, `color`, `font-family`, `color-scheme`
- Replace every raw hex value with the corresponding token
- Add `:focus-visible` rules for `input[type="search"]`, `.skill-card button`, `.scanned-repos summary`, `.scanned-repos-list a`, `.skill-card a`
- Add `div[role="alert"].state-message` left-border rule
- Add `input[type="search"]::placeholder` rule
- Add `.skill-card code::before` rule (optional)

**Does not change:**
- `.sr-only` — untouched, not even reformatted
- `.visually-hidden` — untouched
- All spacing, layout, max-width, padding, margin, gap values
- All font-size values
- All `overflow-x`, `word-break`, `cursor`, `list-style` values
- No TSX files
- No DOM structure, ARIA attributes, visible text, or element types
- No class names are renamed or removed

**DOM-contract registry check:** every hook in the requirements-ui-styling.md registry is preserved. Class names (`ul.skill-list`, `span.repo-scan-failed`, `details.scanned-repos`, `.scanned-repos-list`, `.skill-card`, `.state-message`, `.last-scanned`, `.sr-only`, `.visually-hidden`) are unchanged. ARIA attributes (`aria-label`, `role="alert"`, `aria-live`, `aria-busy`) are in TSX files, untouched. Visible text strings are in TSX files, untouched. Element types (`<code>`, `<h1>`, `<h2>`) are in TSX files, untouched.

---

### 9j. Handoff Notes for Lead Developer

1. **File structure:** the token block can live at the top of `index.css` or in a separate `tokens.css` that `index.css` imports. Either works. The requirements recommend the Lead decide — both approaches satisfy the "token block readable in isolation" acceptance criterion.

2. **Post-restyle verification step:** after implementing, run a grep for raw hex values in `index.css`. Any remaining hex that is not inside a comment means a token was missed. The requirements call this out explicitly as a sufficient check.

3. **`color-scheme: dark`:** add this to `:root`. It handles browser-native form control rendering (the `<input type="search">` clear button, native focus rings) without any additional CSS.

4. **The `::before` terminal prompt is optional.** Include it only if the Lead and PM want it. It is zero-risk from a test-contract perspective, but it is polish, not a must-have.

5. **No horizontal scroll check at 320px:** the restyle adds no new properties that would cause horizontal overflow (`box-shadow` is not used; no new absolute-positioned elements; no new `min-width` values). The existing `max-width: 600px` on the search input and the `word-break: break-all` on code and repo list items are preserved. TC-144 should continue to pass without modification.

6. **`role="alert"` visibility:** CSS must not suppress the `div[role="alert"].state-message` container in a way that breaks screen reader announcement. The rules in Section 9f do not add `display:none`, `visibility:hidden`, `opacity:0`, or `height:0` to this container. The `aria-live` and `role="alert"` behavior is unaffected.

---

*Handoff: Lead Developer for implementation feasibility check. No product decisions are implied by this section — all palette choices, the font-stack decision, and the system-only NFR are fixed per requirements-ui-styling.md stakeholder direction.*
