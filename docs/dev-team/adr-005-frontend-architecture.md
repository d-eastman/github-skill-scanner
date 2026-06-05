# Architecture Decision Record (ADR)
**ADR Number:** ADR-005
**Title:** Single-page React app in TypeScript, local component state, no router
**Author:** Marcus Chen (Solution Architect)
**Date:** 2026-06-04
**Status:** Accepted (2026-06-04) — **amended:** stakeholder chose TypeScript (Option 2) over the originally-recommended plain JS. See "Decision" below.

---

## Context

The frontend (`src/fe`) is a single screen: fetch `data/skills.json`, render a searchable list of
skill cards, each with a copy-install button (must-haves #6–#8). The catalog is small (tens to
low-hundreds of skills; NFR). Project conventions say **minimalist UI**, "simple over clever," and
plain JavaScript — yet `team/project-context.md` lists a `npm run typecheck` command, implying
TypeScript. That contradiction needs an explicit decision so the Lead isn't guessing.

This ADR settles: component shape, where search/filter state lives, how data loading +
empty/loading/error states are structured, whether a router is needed, and the TS-vs-JS question.

---

## Decision Drivers

1. **Minimalism** — match the documented convention; don't add structure the single screen doesn't need.
2. **Maintainable by a small team this week** — no specialist patterns, no state library, no build complexity.
3. **Robust to the three real states** — loading, empty (zero skills / no results), and fetch error
   are all explicit requirements (must-haves #6, #7).
4. **Resolve the JS/TS contradiction definitively** so tooling and CI are coherent (ties to ADR-004).

---

## Options Considered

### Option 1: Single-page, plain-JS React; local state via hooks; no router

One screen composed of a few function components. Data fetched once on mount; search state held in
the top component with `useState`; filtering is a derived computation (`useMemo`) over the loaded
array. No routing, no global store. Plain `.jsx`, no TypeScript; **remove** `npm run typecheck`.

**Component shape (illustrative, Lead owns final names):**
- `App` — owns data-load lifecycle (`status: loading|error|ready`, `skills`, `metadata`) and the
  `query` search string. Renders state branches.
- `SearchBar` — controlled text input; lifts `query` up via callback (autofocus on mount, must-have #7).
- `SkillList` — receives the filtered array; renders `SkillCard`s or the empty/no-results message.
- `SkillCard` — name, description, repo link, and the copy-install button.
- `CopyButton` — Clipboard API write + "Copied!" feedback (must-have #8).

**Pros:**
- Smallest thing that satisfies every must-have; nothing to learn or maintain beyond React basics.
- Matches the "plain JavaScript" stack definition and resolves the contradiction by dropping `typecheck`.
- All three UI states are explicit branches off one `status` value — easy to test and reason about.

**Cons:**
- No compile-time type safety on the data contract (mitigated: small surface, one shared shape from ADR-002).
- State lives in `App`; if the app grew, prop-drilling could get awkward (not a concern at one screen).

**Estimated effort:** Small

---

### Option 2: Same app, but in TypeScript (keep `typecheck`)

Identical architecture, typed. Type the ADR-002 schema as an interface; keep `npm run typecheck` in CI.

**Pros:**
- Compile-time guarantee the frontend reads the schema correctly; the contract becomes a shared type.
- `typecheck` command in project context becomes meaningful rather than dead.

**Cons:**
- **Contradicts the stated stack** ("JavaScript, not TypeScript") and the BA's assumption; would be a
  scope/convention change the PM must own, not the Architect.
- Adds tsconfig, type deps, and `.tsx` to a one-week minimalist build for a tiny app.

**Estimated effort:** Small–Medium (setup overhead)

---

### Option 3: Add a router / state library (Redux, Zustand, React Router)

Introduce routing (for a future detail page) and/or a store now.

**Pros:**
- "Future-proof" for nice-to-have #1 (detail view) and richer filtering.

**Cons:**
- **Over-engineering** for a single screen with one piece of search state — exactly the trap to avoid.
- More deps, more concepts, more to maintain, for zero v1 user benefit.

**Estimated effort:** Medium

---

## Decision

**We will: Option 2 — a single-page React app in TypeScript, local hook state, no router.** The
single-screen architecture, component shape, and state ownership described in Option 1 stand exactly
as written; only the language changes from plain JS to TypeScript.

> **Amendment (2026-06-04):** The originally-recommended Option 1 (plain JS, drop `typecheck`) was
> overridden by the stakeholder, who chose **TypeScript**. Rationale accepted: the ADR-002 data
> contract is exactly the kind of boundary types protect well, and flipping now — before any code
> exists — is the cheap moment (per "The Road Not Taken" below). Therefore:
> - The codebase (frontend **and** scanner) is **TypeScript**.
> - **Keep** `npm run typecheck` in `team/project-context.md` and wire it into CI.
> - Components are `.tsx`; the ADR-002 schema is expressed as a shared `interface`/`type` consumed by
>   both the scanner output typing and the frontend reader.

This remains the smallest design that meets every frontend must-have and honors "minimalist." A router
and a state library are still structure the single screen doesn't earn (Option 3 rejected).

### State, data, and the three states
- **Data load:** `App` fetches `${import.meta.env.BASE_URL}data/skills.json` once on mount (ADR-003),
  tracking a single `status` of `loading | error | ready`.
  - `loading` -> spinner/skeleton.
  - `error` (fetch/parse failed) -> error-state message (must-have #6).
  - `ready` with `skills.length === 0` -> empty-state message (must-have #6).
- **Search:** `query` lives in `App` via `useState`; the filtered list is `useMemo`'d over `skills`,
  case-insensitive match on `name` + `description` (defaulting `null` fields to ''), recomputed as the
  user types — no submit, no network (must-have #7).
  - `ready` + non-empty catalog + `query` matches nothing -> "no results" message (distinct from empty).
- **List keys:** key each card on `repo + '/' + path` (not `skillName`), since `skillName` isn't
  globally unique (ADR-002).
- **Install command:** built by string concatenation: `npx skills add ${repoUrl} --skill ${skillName}`,
  copied with the Clipboard API, with "Copied!" feedback, no trailing whitespace (must-have #8).
- **Last-scanned (nice-to-have #3):** render `metadata.lastScanned` in a footer — free, since the
  envelope already carries it (ADR-002).

---

## Consequences

### Positive
- Minimal surface: ~5 small components, one fetch, one piece of search state. Fast to build and test.
- The three required UI states are explicit and individually testable (good for QA's Playwright e2e).
- Tooling becomes coherent: plain JS, Prettier, Vitest, Playwright — no TypeScript half-measure.

### Negative
- No compile-time check that the frontend matches the ADR-002 contract; relies on a small, shared,
  documented shape and tests. Acceptable at this size.
- Dropping `typecheck` means `team/project-context.md` and any CI referencing it must be updated
  (see flag).

### Neutral / Watch
- If nice-to-have #1 (detail view) lands, prefer a modal over adding a router; only introduce
  React Router if real multi-route navigation appears.
- If the catalog ever grows to thousands of skills, revisit client-side filtering (virtualize the list
  or add an index) — well beyond the stated NFR.

---

## The Road Not Taken

**TypeScript (Option 2)** was the runner-up and is genuinely tempting because the ADR-002 contract is
the kind of thing types protect well. We declined it to honor the stated stack and keep the one-week
build lean — but this is the most defensible decision to revisit, and the cleanest moment to flip it is
*now*, before code exists. If the PM/Lead want type safety on the contract, switching is cheap today
and expensive later. **Router/store (Option 3)** stays parked until there's a second screen or real
shared state.

---

## Implementation Notes

- Lead owns component names, file layout under `src/fe`, and styling (minimalist per convention) — this
  ADR sets shape and state ownership, not code style.
- Guard against `null` `name`/`description` at render and in search (the contract permits null — ADR-002).
- The fetch must use `import.meta.env.BASE_URL` (ADR-003), never a hardcoded path.
- Autofocus the search input on load (must-have #7 acceptance).

---

## Flag for PM / Lead (TS-vs-JS + tooling) — RESOLVED
- **Decision taken (stakeholder, 2026-06-04):** **TypeScript** across the codebase. **Keep
  `npm run typecheck`** in `team/project-context.md` and wire it into CI. Lead sets up `tsconfig`,
  `@types/node`, and the shared schema type from ADR-002. The earlier plain-JS flag is closed.

---

## Links

- `requirements.md` must-haves #6, #7, #8; nice-to-have #1, #3; NFR (render < 2s)
- `team/project-context.md` (stack = plain JS; stray `typecheck` command)
- ADR-002 (the data shape rendered), ADR-003 (the base-path-aware fetch)
