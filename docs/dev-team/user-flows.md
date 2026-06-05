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
| SearchBar | All states; disabled in loading, error, empty |
| SkillList | Ready states only |
| SkillCard + CopyButton | Populated state only (filtered list >= 1) |
| Loading message | Loading state only |
| Error message | Error state only |
| Empty message | Empty state only (skills = []) |
| No-results message | No-results state only (skills > 0, filtered = 0) |

The loading message, error message, empty message, and no-results message all render inside the same list-area region. SkillList receives the filtered array and is responsible for distinguishing empty-catalog from no-results based on whether the unfiltered skills array is also empty — or App passes both `skills` and `filteredSkills` so SkillList can differentiate. Lead's call on exact prop shape.

---

## Links

- `requirements.md` — must-haves #6, #7, #8; nice-to-have #3; NFR (render < 2s, basic keyboard navigability)
- `adr-005-frontend-architecture.md` — component shape, state machine (`loading | error | ready`), TypeScript
- `adr-002-data-schema-output-contract.md` — data fields available to display; null-tolerance rules
- Handoff to Lead Developer for feasibility review before implementation
