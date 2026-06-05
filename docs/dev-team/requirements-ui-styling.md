# Requirements Delta: Modern UI Styling — Dark Developer Theme
**Project:** GitHub Skill Scanner  
**Author:** Priya Nair (Business Analyst)  
**Date:** 2026-06-05  
**Status:** Draft — ready for UX Designer and Lead Developer review

---

## One-Line Scope

Restyle the shipped frontend with a dark-developer (dark slate, light text, monospace accents, cyan/green highlights) design-token system applied uniformly across all surfaces and all five states — no behavior, layout structure, DOM shape, or test contract changes.

---

## Minimalist-Dark Reconciliation

`team/project-context.md` specifies "minimalist UI styling" as a project convention. The stakeholder direction for this feature is a "dark developer" aesthetic. These are not in conflict, but the distinction matters for implementation:

The convention is about *restraint* — no decorative chrome, no busy gradients, no novelty for its own sake. It describes how much is on screen, not what color it is. A dark-developer theme executed with the same restraint (one background, one text color, one accent, one font stack, generous whitespace) is "minimalist" in the correct sense of the term. The current light theme is already minimal; this feature changes the palette and adds a design-token layer, not the density or complexity of the UI.

The deliverable is therefore: **minimalist dark** — modern, restrained, readable. Not: a developer IDE simulator with gradients, glow effects, animated cursors, or multiple accent palettes competing for attention. If a proposed visual element cannot be justified by "it makes content more readable or a state more distinguishable," it is out of scope.

---

## Background

The shipped application (`index.css`, `App.tsx`, `SkillCard.tsx`, `SkillList.tsx`, `SearchBar.tsx`, `CopyButton.tsx`, `ScannedReposIndicator.tsx`) has a working light theme using inline color values and no design-token system. Values like `#ddd`, `#fafafa`, `#666`, `#0066cc`, `#f0f0f0` are scattered through `index.css` with no systematic relationship between them.

The existing test suite contains 90 unit tests and 9 e2e tests. Those tests depend on specific DOM contracts — ARIA roles, accessible names, visible text strings, and CSS selectors — that must not change. The styling work touches only `index.css` (and potentially a new token file or CSS custom properties block). It does not touch component TSX files unless a class name needs to be added to an element that currently lacks one, and only then with explicit justification.

---

## Scope

### In scope

- Establish a CSS custom-property design-token system (color, typography scale, spacing) in `index.css` (or a dedicated `tokens.css` imported by `index.css` — Lead's call on file split)
- Replace all inline hex/named color values in `index.css` with tokens
- Apply the dark-developer palette across every styled surface: `<main>`, `<header>`, `input[type="search"]`, `.skill-list`, `.skill-card`, `code`, `button`, `.state-message`, `.scanned-repos`, `.scanned-repos-list`, `.repo-scan-failed`, `.last-scanned`, `.sr-only`/`.visually-hidden`
- Style all interactive states: `:hover`, `:focus-visible`, `:active`, `:disabled`
- Style all five application states (loading, error, empty, no-results, populated) with the dark palette
- Style the `<details>`/`<summary>` disclosure in both collapsed and expanded states
- Ensure WCAG AA contrast ratios for all text, links, the "scan failed" tag, and focus indicators on the dark background
- Use a system-stack font for body text and a system-stack monospace font for `<code>` — no web font loading (see Open Questions)

### Out of scope

- Light mode, theme toggle, or `prefers-color-scheme` switching — single dark theme only
- Any change to component behavior: search, copy, disclosure open/close, state transitions, aria-live, aria-busy, focus management
- Any change to the DOM structure, element types, ARIA attributes, accessible names, or visible text strings listed in the DOM-contract registry below
- New components, new features, new layout structure, or new font loading infrastructure
- Animation or transition effects (not prohibited, but not required — defer to UX if desired; flag as a post-restyle concern)

---

## Must-Haves

### 1. Design token system established

The implementation must define all color, type-scale, and spacing values as CSS custom properties before use. Inline hex values may not remain in the stylesheet after the restyle.

*Acceptance criteria:*
- A `:root {}` block (or equivalent scope) defines at minimum: background color, surface/card color, body text color, muted/secondary text color, accent/link color, code background color, border color, focus-ring color, and disabled-state colors as named custom properties (e.g. `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-code-bg`, `--color-border`, `--color-focus`).
- All color references elsewhere in the stylesheet use these properties, not raw hex values.
- A code reviewer can identify the full palette by reading only the token block, without scanning the rest of the file.

### 2. Dark-developer palette applied to all surfaces

Every visible surface must use the dark palette. No element should retain a light background or dark-on-white text combination after the restyle.

*Acceptance criteria:*
- `<body>` or `<main>` background is a dark slate color (approximately `#0d1117` to `#1a1f2e` range — exact value is UX's call within this range).
- Card surfaces (`.skill-card`, `.state-message`) are a slightly lighter dark surface (e.g. `#161b22` to `#21262d` range) that creates visible separation from the background without high contrast.
- Body text is light (e.g. `#c9d1d9` to `#e6edf3` range) with sufficient contrast against both the background and card surface.
- Secondary/muted text (`.last-scanned`, `.scanned-repos summary`, description paragraphs) uses a dimmer variant of the text color that still meets WCAG AA contrast against its background.
- The page renders with no light-colored background patches visible in any of the five application states.

### 3. Cyan/green accent applied to interactive and code elements

Links, the `<code>` element, and Copy button use the accent color. This is the distinguishing "developer tool" visual signal.

*Acceptance criteria:*
- Repo links (`.skill-card a`, `.scanned-repos-list a`) render in a cyan or green accent color (e.g. cyan `#58a6ff` / `#79c0ff` or terminal green `#3fb950` — UX decision within this range).
- `<code>` element background and/or text uses the accent family to visually mark it as code (e.g. monospace text in a slightly brightened color, or a subtly tinted background).
- The Copy button's default state references the accent color (border, text, or background — UX's call on which).
- Accent color selections achieve WCAG AA contrast (4.5:1) against their respective backgrounds.

### 4. All interactive states styled for the dark palette

Every element that has a hover, focus, active, or disabled state must have that state explicitly defined against the dark background. States inherited from the browser default light stylesheet must be overridden.

*Acceptance criteria:*
- `input[type="search"]:focus-visible` and `button:focus-visible` show a visible focus ring using `--color-focus` that is distinguishable on a dark background. The ring must achieve 3:1 contrast against the adjacent surface (WCAG 2.4.11 / AA focus visible).
- `input[type="search"]:disabled` and `button:disabled` (if applicable) show a visually muted state that clearly communicates non-interactivity.
- `.skill-card a:hover` and `.scanned-repos-list a:hover` show a distinct hover state (e.g. underline, lighter shade, or brightness change).
- `.skill-card button:hover` and `.skill-card button:active` are distinguishable from each other and from the default state.
- No interactive state falls back to a browser-default light-background appearance.

### 5. All five application states covered

The dark theme must be complete — no state that reveals an unstyled or light-background region.

*Acceptance criteria:*
- Loading state: the "Loading skills..." text and the disabled search input display correctly on the dark background.
- Error state (`.state-message` with `role="alert"`): the error message container uses the dark card surface and light text; no white or near-white background.
- Empty state (`.state-message`): same as error state.
- No-results state (`.state-message`): same as error state.
- Populated state: skill cards (`.skill-card`) render with dark card surface, light heading text, accent-colored links, styled `<code>` block, and styled Copy button.
- In all five states, if the `<details>` disclosure is present, it renders consistently with the header's dark styling.

### 6. "Scan failed" tag meets contrast on dark palette

The `.repo-scan-failed` tag currently uses `color: #999` (muted gray), which worked on white. On a dark surface, that same gray may be insufficient.

*Acceptance criteria:*
- `.repo-scan-failed` text achieves WCAG AA contrast (4.5:1 for small text) against the card/disclosure background it appears on.
- The tag remains visually secondary — it should not appear as a warning or alert. It must not use the same accent color as links or a red/orange warning color.

### 7. Accessibility preserved or improved

The dark palette must not regress the accessibility characteristics established in `user-flows.md` and the existing test suite. No new ARIA attributes, roles, or DOM changes are required or permitted by this feature — the styling must work with what exists.

*Acceptance criteria:*
- `.sr-only` and `.visually-hidden` rules remain unchanged — these classes must continue to visually hide their content while keeping it in the accessibility tree. Do not alter their CSS.
- `aria-busy`, `role="alert"`, and `aria-live` attributes are in the DOM (owned by TSX files, not CSS) and are unaffected by this change. Verify that no CSS rule hides or visually suppresses the `role="alert"` container in a way that breaks its announcement.
- All body text achieves WCAG AA contrast (4.5:1) against the background or surface it sits on.
- All link text achieves WCAG AA contrast (4.5:1) against the card or page background.
- Focus rings on `input[type="search"]` and `button` achieve 3:1 contrast against the adjacent non-focus surface color.

---

## DOM-Contract Registry (must not change)

This table records the specific DOM hooks the existing 90 unit tests and 9 e2e tests depend on. The restyle must not rename, remove, or structurally alter any of these. New classes may be added; existing ones may not be removed.

| Hook type | Value | Where used | Test cases depending on it |
|-----------|-------|------------|---------------------------|
| CSS class | `ul.skill-list` | `SkillList.tsx` | e2e: card count assertions (`ul.skill-list > li`); unit: `container.querySelector("ul")` |
| CSS class | `span.repo-scan-failed` | `ScannedReposIndicator.tsx` | e2e TC-137: `span.repo-scan-failed` locator; unit TC-119, TC-122 |
| CSS class | `details.scanned-repos` | `ScannedReposIndicator.tsx` | n/a directly, but `details[aria-label='Scanned repositories']` is the e2e selector |
| CSS class | `scanned-repos-list` | `ScannedReposIndicator.tsx` | unit TC-118: `container.querySelector("details ul")` |
| CSS class | `skill-card` | `SkillCard.tsx` | unit: `container.querySelectorAll("p")` scoped to card |
| CSS class | `state-message` | `SkillList.tsx` | n/a directly, but `.state-message` is the visual container for all non-populated state content |
| CSS class | `last-scanned` | `App.tsx` | n/a in tests, but is a stable DOM hook |
| CSS class | `sr-only` | `App.tsx`, `SearchBar.tsx` | accessibility correctness — must not be altered |
| CSS class | `visually-hidden` | `SkillCard.tsx`, `ScannedReposIndicator.tsx` | accessibility correctness — must not be altered |
| ARIA attribute | `aria-label="Scanned repositories"` on `<details>` | `ScannedReposIndicator.tsx` | e2e TC-136, TC-137, TC-144; unit TC-114, TC-124 |
| ARIA attribute | `role="alert"` on error message container | `App.tsx` | user-flows.md a11y contract |
| ARIA attribute | `aria-live="polite"` on copy live region | `App.tsx` | user-flows.md a11y contract |
| ARIA attribute | `aria-busy` on `<section>` | `App.tsx` | BUG-001 (open) |
| Role | `role="searchbox"` (from `<input type="search">`) | `SearchBar.tsx` | e2e: `page.getByRole("searchbox")` |
| Element type | `<code>` for install command | `SkillCard.tsx` | unit: `codeElement.tagName === "CODE"` |
| Element type | `<h1>` for page title | `App.tsx` | e2e: `getByRole("heading", { level: 1, name: "GitHub Skill Scanner" })` |
| Element type | `<h2>` for card names and state headings | `SkillCard.tsx`, `SkillList.tsx` | e2e: `getByRole("heading", { level: 2 })` |
| Visible text | "Copy" (CopyButton default) | `CopyButton.tsx` | e2e: `toHaveText("Copy")` |
| Visible text | "Copied!" | `CopyButton.tsx` | e2e: `toHaveText("Copied!")` |
| Visible text | "Scanning N repositories" | `ScannedReposIndicator.tsx` | unit TC-115, TC-116; e2e TC-136 |
| Visible text | "scan failed" | `ScannedReposIndicator.tsx` | unit TC-119, TC-122; e2e TC-137 |
| Visible text | exact install command string including `-a github-copilot -y` | `SkillCard.tsx`, `CopyButton.tsx` | e2e: `toBeVisible()` on command text; TC-139 clipboard assertion |
| Visible text | "No skills found yet." | `SkillList.tsx` | e2e and unit |
| Visible text | /No skills match/ | `SkillList.tsx` | e2e and unit |
| Visible text | "GitHub Skill Scanner" (h1) | `App.tsx` | e2e |

---

## Non-Functional Requirements

- **Accessibility:** WCAG AA contrast for all text and interactive elements on the dark palette (see Must-Have 7). This upgrades the existing "basic keyboard navigability / AA not a hard requirement for v1" NFR — the dark restyle makes contrast a genuine risk, so AA contrast is a hard requirement for this feature.
- **Browser support:** Chrome and Firefox latest stable, matching the existing NFR. No change.
- **Performance:** No web-font loading. System font stacks only (see Open Questions). The restyle must not add network requests at page load time.
- **Responsive:** No horizontal scroll at 320px viewport width in any state (existing e2e TC-144 must stay green). The dark palette and any new box-shadow or border-radius additions must not introduce overflow at narrow widths.

---

## Open Questions

There is one genuinely blocking question. The direction is decided; this is an implementation parameter the UX Designer should confirm before the Lead begins work.

| # | Question | Owner | Decision by | Notes / Recommendation |
|---|----------|-------|-------------|------------------------|
| OQ-UI-1 | **System font stack vs. web font.** Should the restyle introduce a web font (e.g. Geist, Inter, JetBrains Mono) for body or monospace text, or use only system font stacks? | UX Designer | Before implementation begins | **Recommendation: system stacks only.** A system sans-serif stack (e.g. `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`) and a system monospace stack (e.g. `"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace`) deliver the developer-tool aesthetic without a network request, a Flash of Unstyled Text risk, or a new font-loading dependency. If the UX Designer wants a specific web font (e.g. JetBrains Mono for the `<code>` block), it can be scoped to that element alone and loaded with `font-display: swap` — but this must be an explicit decision, not a default. Unresolved, this blocks the Lead from writing the font-family declarations. |

No other open questions. Palette direction, theme count, and scope are fixed stakeholder decisions and are not re-litigated here.

---

## Assumptions

- The restyle is a CSS-only change. If any must-have requires adding a class name to a TSX element that currently lacks one (e.g. to target a specific element that has no class today), that is a one-line TSX change — low risk, but it must be coordinated with the Lead to confirm it does not break any test selectors.
- The existing `index.css` structure (one file, no pre-processor, plain CSS custom properties) is retained. If the Lead prefers splitting tokens into a separate `tokens.css`, that is an implementation detail and does not affect these requirements.
- Browser defaults for `<details>`/`<summary>` disclosure triangle styling are acceptable. A custom marker is not required and should be avoided unless the UX Designer explicitly calls for one.
- The `<body>` background color must be set (on `:root`, `body`, or both) so that the dark background fills the full viewport, not just the `<main>` container. The current stylesheet sets background only on `.skill-card` and similar surfaces — the page background itself is browser-default white. This must be corrected as part of the restyle.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Contrast ratios fail for muted secondary text on dark surface | High | High | Verify each text/background pairing with a contrast checker before merging. Muted text is the most common failure point in dark themes — `#999` on `#161b22` is approximately 4.0:1, which fails AA for small text. Tokens must be set to a value that passes, not eyeballed. |
| Focus rings invisible on dark backgrounds | Medium | High | Browser-default focus outlines (blue on white) often disappear on dark surfaces. `focus-visible` must use an explicit `outline` color from the token system, not the browser default. |
| Dark background not applied to full viewport (body stays white) | Medium | Medium | Set `background-color` on `body` or `:root`. Without this, the dark card surfaces appear to float on white at any viewport height shorter than the content. |
| CSS specificity conflicts between new token-based rules and existing inline color values | Low | Low | The migration to tokens should replace inline values, not layer on top of them. A post-restyle grep for raw hex values in `index.css` is a sufficient check. |
| Web font loading introduced without decision on OQ-UI-1 | Low | Low | No web font should appear in the stylesheet until OQ-UI-1 is resolved. The Lead should flag any font-face declarations or Google Fonts imports if they appear during implementation. |

---

## Stakeholder Sign-Off

| Name | Role | Status | Date |
|------|------|--------|------|
| David Eastman | Product Owner | Pending | — |
