# Technical Specification
**Project:** GitHub Skill Scanner
**Author:** Theo Okafor (Lead Developer)
**Date:** 2026-06-04
**Status:** Active

---

## 1. Scope of This Spec

This spec covers everything the Lead Developer builds today (Day 1 critical path) plus the precise
task breakdown the Junior Developer needs to complete the frontend. It maps to the phase plan
(E1-S1 through E2-S7 owned by Lead; E4-S1 through E4-S5 handed to Junior).

ADRs 001–005 are fixed inputs — this spec does not revisit architectural decisions. If an
implementation detail here conflicts with an ADR, the ADR wins and this spec gets updated.

---

## 2. What Gets Built

### Lead builds (this session)

| Item | Path | Status |
|------|------|--------|
| Tech spec | `docs/dev-team/tech-spec.md` | This file |
| `package.json` | `package.json` | Required |
| `tsconfig.json` (root, node, vite splits) | `tsconfig*.json` | Required |
| Vite config | `vite.config.ts` | Required |
| Vitest config | `vitest.config.ts` | Required |
| Prettier config | `.prettierrc` | Required |
| `.gitignore` | `.gitignore` | Required |
| Shared types | `src/types/skills.ts` | Critical path |
| Scanner: API client | `src/scan/client.ts` | Required |
| Scanner: layout matching | `src/scan/layout.ts` | Required |
| Scanner: frontmatter parsing | `src/scan/parser.ts` | Required |
| Scanner: output writer | `src/scan/writer.ts` | Required |
| Scanner: entry point | `src/scan/index.ts` | Required |
| Scanner: repo config | `src/scan/repos.json` | Required |
| Scanner unit tests | `tests/scanner/` | Required |
| Frontend skeleton | `src/fe/index.html`, `src/fe/main.tsx`, `src/fe/App.tsx` | Minimal — Junior builds out |
| Initial data file | `data/skills.json` | Required (empty-valid envelope) |
| Data schema docs | `data/README.md` | Required |

### Junior builds (frontend — see section 9)

All frontend components per ADR-005 and user-flows.md. The Lead provides the skeleton and type
contract; the Junior implements the full component tree.

---

## 3. Project Scaffold

### Directory layout

```
github-skill-scanner/
  src/
    fe/                   # Frontend (Vite + React + TypeScript)
      public/
        data/             # Build-time copy of data/skills.json lands here (ADR-003)
      index.html
      main.tsx
      App.tsx
      components/         # Junior populates: SearchBar, SkillList, SkillCard, CopyButton
    scan/                 # Scanner (Node 20 TypeScript)
      repos.json
      index.ts
      client.ts
      layout.ts
      parser.ts
      writer.ts
    types/
      skills.ts           # Shared contract — both halves import from here
  data/
    skills.json           # Scanner output; not bundled into JS (ADR-003)
    README.md
  tests/
    scanner/
      layout.test.ts
      parser.test.ts
      writer.test.ts
  .github/
    workflows/            # DevOps authors scan.yml and deploy.yml
  docs/dev-team/
  team/
```

### npm scripts (must match project-context.md exactly)

```json
{
  "dev":        "vite --config vite.config.ts src/fe",
  "build":      "npm run copy-data && vite build --config vite.config.ts",
  "typecheck":  "tsc --noEmit",
  "test":       "vitest run",
  "scan":       "tsx src/scan/index.ts",
  "copy-data":  "node -e \"const fs=require('fs');fs.mkdirSync('src/fe/public/data',{recursive:true});fs.copyFileSync('data/skills.json','src/fe/public/data/skills.json');\""
}
```

The `copy-data` step satisfies ADR-003: `data/skills.json` is copied into `src/fe/public/data/`
before the Vite build runs so it lands in `dist/data/skills.json` under the configured base path.

### TypeScript config strategy

Three tsconfig files:
- `tsconfig.json` — root config used by `npm run typecheck`; includes both scanner and frontend paths
- `tsconfig.node.json` — scanner-specific: `module: NodeNext`, `moduleResolution: NodeNext`, targets Node 20
- `tsconfig.vite.json` — frontend-specific: `module: ESNext`, `moduleResolution: bundler`, JSX react-jsx

The root `tsconfig.json` uses `references` to both. This way `tsc --noEmit` typechecks the full
project in one pass (phase plan non-negotiable: typecheck must pass before merge).

---

## 4. Shared Types (`src/types/skills.ts`)

This is the ADR-002 contract expressed as TypeScript. Both the scanner (output) and frontend
(input) import from this module. Changing a field here is a type error in one or both halves —
that is the point.

```typescript
export interface SkillEntry {
  name: string | null;         // frontmatter `name`; null if missing/malformed
  description: string | null;  // frontmatter `description`; null if missing/malformed
  skillName: string;           // directory-derived; never null; the --skill value
  repo: string;                // "owner/repo"
  repoUrl: string;             // canonical, no trailing slash
  path: string;                // path within repo of the SKILL.md file
}

export interface SkillsMetadata {
  schemaVersion: number;       // 1; bump on breaking schema change
  lastScanned: string;         // ISO 8601 UTC
  repoCount: number;
  reposSucceeded: number;
  reposFailed: number;
  skillCount: number;          // must equal skills.length
}

export interface SkillsCatalog {
  metadata: SkillsMetadata;
  skills: SkillEntry[];
}
```

---

## 5. Scanner Module Design

### 5a. `src/scan/repos.json`

Array of `{ owner: string, repo: string }`. Seeded with `anthropics/skills` for v1.

### 5b. `src/scan/client.ts` — GitHub API client

A thin wrapper around Node 20's built-in `fetch`. Responsibilities:
- Attach required headers: `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`,
  `X-GitHub-Api-Version: 2022-11-28`, `User-Agent: github-skill-scanner/1.0`
- Read `GITHUB_TOKEN` from `process.env` — never hardcoded
- If token is absent, log a warning and proceed without auth (lower rate limit; acceptable for dev)
- After each response, log `x-ratelimit-remaining` at debug level
- Return raw `Response`; callers handle JSON parsing and error checking

Single exported function: `githubFetch(url: string): Promise<Response>`

### 5c. `src/scan/layout.ts` — SKILL.md path matching and skillName derivation

Pure functions — no I/O, fully testable. This is the implementation of ADR-001's layout rules.

```
matchSkillPath(path: string): { skillName: string } | null
```

Matches one of the three layouts:
- L1: `SKILL.md` (exact) → skillName = repo name (caller provides)
- L2: `<skill>/SKILL.md` (one segment + filename) → skillName = first segment
- L3: `skills/<skill>/SKILL.md` (two segments + filename) → skillName = second segment

Returns `null` for any path that does not match. The caller passes repo name for the L1 case.

```
deriveSkillName(path: string, repoName: string): string | null
```

Convenience wrapper that returns the skillName or null (not matched).

**Matching rules:**
- Case-sensitive on the filename `SKILL.md`
- Segments must be non-empty (no leading slash, no `//`)
- No wildcards — exact structural match only

### 5d. `src/scan/parser.ts` — SKILL.md frontmatter extraction

Dependency: `gray-matter` (justified below). This module:
- Accepts raw file content string
- Uses `gray-matter` to parse YAML frontmatter
- Extracts `name` and `description`; coerces to `string | null`
- Returns `{ name: string | null, description: string | null }`
- Never throws — malformed YAML → both fields null, warning logged

**Why `gray-matter`:** It handles the full range of YAML frontmatter edge cases (missing fence,
empty frontmatter, malformed YAML, non-string values) that would be tedious and bug-prone to
hand-roll. It is well-maintained (npm weekly downloads in the millions), small, and has no
transitive deps that conflict with Node 20. The alternative — a hand-rolled `---` fence split +
a YAML parser — would require choosing a YAML library anyway and adding custom error handling. The
ADR-002 implementation note explicitly names `gray-matter` as an appropriate choice.

### 5e. `src/scan/writer.ts` — JSON envelope assembly and file write

Pure (except the `fs.writeFileSync` call) — assembles the `SkillsCatalog` and writes it.
Responsibilities:
- Sort skills by `repo`, then `skillName` (ADR-002 stable sort)
- Compute metadata: `lastScanned` (current ISO UTC), counts
- Validate `skillCount === skills.length`
- Write `data/skills.json` with `JSON.stringify(..., null, 2)`
- Ensure `data/` directory exists before writing

### 5f. `src/scan/index.ts` — Entry point

Orchestrates the per-repo algorithm from ADR-001:
1. Read `repos.json`
2. Guard: if `GITHUB_TOKEN` is missing, log warning (not fatal — dev mode)
3. For each repo:
   a. `GET /repos/{owner}/{repo}` → read `default_branch` (fail soft on 403/404)
   b. `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1` → get tree
   c. Log warning if `truncated: true`
   d. Filter blobs whose basename is `SKILL.md`
   e. Apply layout matching; skip non-matching paths
   f. For each matched path: fetch raw content; parse frontmatter; build `SkillEntry`
   g. Track per-repo success/failure
4. After all repos: call writer
5. Exit code: 0 unless all repos failed (then exit 1)

Error handling:
- Per-repo errors: log with `console.error`, increment `reposFailed`, continue
- Per-file errors (raw fetch or parse): log warning, emit entry with null fields (not skip)
- All repos failed: `process.exit(1)`

---

## 6. Frontend Skeleton (Lead builds; Junior completes)

The Lead builds a minimal but compiling skeleton: `index.html`, `main.tsx`, and `App.tsx` with
the data fetch wired up and returning stub rendering. This satisfies Gate 1 (typecheck passes)
and gives the Junior a working base.

`App.tsx` includes:
- The `import.meta.env.BASE_URL` fetch (ADR-003)
- The `status: 'loading' | 'error' | 'ready'` state machine stub
- A `// TODO(Junior): implement per ADR-005 + user-flows.md` marker for each UI state branch
- Import of `SkillsCatalog` and `SkillEntry` from `src/types/skills.ts` — types wire up from day 1

The Junior must NOT change the fetch URL or status state machine structure — those are
architectural decisions locked in ADR-003 and ADR-005.

---

## 7. Test Strategy

### Scanner unit tests (Lead owns; in `tests/scanner/`)

All scanner tests use Vitest. No live network calls — fetch is mocked.

**`layout.test.ts`** — tests for `matchSkillPath` / `deriveSkillName`:
- L1 match: `SKILL.md` → skillName = repoName
- L2 match: `frontend-design/SKILL.md` → `frontend-design`
- L3 match: `skills/pdf/SKILL.md` → `pdf`
- Non-match: `docs/examples/SKILL.md` → null (too deep)
- Non-match: `skill.md` (wrong case) → null
- Non-match: `nested/deep/extra/SKILL.md` → null (four segments)
- Edge: path with leading slash normalized or rejected

**`parser.test.ts`** — tests for frontmatter extraction:
- Valid frontmatter with `name` and `description` → both present
- Missing `name` → name is null, no crash
- Missing `description` → description is null, no crash
- Empty frontmatter `---\n---` → both null, no crash
- Malformed YAML → both null, no crash
- No frontmatter at all → both null, no crash
- Non-string value (e.g. `name: 42`) → coerced or null, no crash

**`writer.test.ts`** — tests for envelope assembly:
- Sort: skills sorted by repo then skillName
- Counts: metadata.skillCount === skills.length
- lastScanned: valid ISO 8601 UTC string
- Empty skills array → valid envelope with skills: []

### Frontend unit tests (Junior owns; in `tests/fe/`)

The Junior writes these against the components they implement. Minimum coverage (phase plan
cut-line item):

1. Search filter: case-insensitive match on name and description
2. Search filter: null name/description fields don't crash (treated as empty string for matching)
3. Command string: `npx skills add ${repoUrl} --skill ${skillName}` exact format, no trailing whitespace
4. Null name renders skillName fallback without crash
5. Null description renders nothing (no empty paragraph)

---

## 8. Dependencies Added and Justification

| Package | Type | Justification |
|---------|------|---------------|
| `react` + `react-dom` | runtime | Frontend framework per ADR-005 |
| `typescript` | devDep | TypeScript throughout per ADR-005 amendment |
| `vite` | devDep | Build tool per stack definition |
| `@vitejs/plugin-react` | devDep | Vite React plugin for JSX/TSX |
| `vitest` | devDep | Unit test runner per project-context.md conventions |
| `@vitest/ui` | devDep | Optional test UI (vitest run works without it) |
| `tsx` | devDep | Run TypeScript scanner directly: `tsx src/scan/index.ts` (simpler than ts-node for ESM + Node 20; no separate compile step in CI) |
| `gray-matter` | runtime dep of scanner | YAML frontmatter parsing — see section 5d justification |
| `@types/react` + `@types/react-dom` | devDep | TypeScript types for React |
| `@types/node` | devDep | TypeScript types for Node built-ins in scanner |
| `@types/gray-matter` | devDep | TypeScript types (bundled with gray-matter; listed explicitly for clarity) |
| `prettier` | devDep | Formatter per project conventions |

**tsx over ts-node:** `tsx` handles ESM + CommonJS interop cleanly on Node 20+ without requiring a
separate `tsconfig` for the execution context. It is the current community standard for running TS
files directly and the backlog explicitly lists `tsx` as the preferred approach (E2-S6).

No state library, no router, no additional UI libraries. Minimalist per ADR-005 and project conventions.

---

## 9. Junior Developer Task List — Frontend

**Context:** The Lead has built the scaffold, shared types, scanner, and a minimal compiling
frontend skeleton. The Junior's job is the frontend component tree (Epic 4) per ADR-005 and
user-flows.md. The shared type contract in `src/types/skills.ts` is frozen — do not change it.
The fetch URL in `App.tsx` is frozen — do not change it.

**Files the Junior touches:**
- `src/fe/App.tsx` — fill in the TODO stubs
- `src/fe/components/SearchBar.tsx` — create
- `src/fe/components/SkillList.tsx` — create
- `src/fe/components/SkillCard.tsx` — create
- `src/fe/components/CopyButton.tsx` — create
- `tests/fe/` — create frontend unit tests
- `src/fe/index.css` (or component-level CSS) — minimal styling per conventions

**Do NOT touch:**
- `src/types/skills.ts`
- `src/scan/` (anything)
- `data/skills.json`
- `package.json` scripts
- `tsconfig*.json`
- `vite.config.ts`

---

### Task 1 — E4-S1: App component — fill in the state stubs

**File:** `src/fe/App.tsx`
**Depends on:** Lead's skeleton (already in place)

The skeleton already has the fetch, status state machine, and type imports. The Junior fills in
each status branch:

- `loading`: render the `SearchBar` in disabled state + "Loading skills..." text in the list area
- `error`: render the `SearchBar` in disabled state + error state message (see microcopy below)
- `ready` + `skills.length === 0`: render disabled `SearchBar` + empty state message + timestamp
- `ready` + filtered list empty (query non-empty but no matches): no-results state message
- `ready` + filtered list has items: render `SearchBar` (enabled, autofocus) + `SkillList`

Search state: `query: string` lives in `App` via `useState`. Filtering logic: `useMemo` over
`skills`, case-insensitive match on `name ?? ''` and `description ?? ''`. Key: why null-coalesce
to empty string — the ADR-002 contract permits null; searching null crashes without this.

Pass to `SkillList`: the filtered array, the full skills array length (so SkillList knows whether
empty result is "zero catalog" or "no results for query"), and the current query string.

**Acceptance criteria (maps to must-have #6):**
- All five UI states render without console errors
- `status` transitions correctly from loading → ready or loading → error
- Search filters in real time without network round-trip
- Clearing search restores full list

---

### Task 2 — E4-S2: SearchBar component

**File:** `src/fe/components/SearchBar.tsx`
**Depends on:** Task 1

Props: `value: string`, `onChange: (q: string) => void`, `disabled: boolean`

Requirements:
- `<input type="search">` with `placeholder="Search skills..."`
- Visually hidden `<label htmlFor="search-input">Search skills</label>` (do not use placeholder as
  the only label — WCAG 1.3.1)
- `autoFocus` when not disabled (must-have #7)
- `disabled` prop passes through to the input element
- `onChange` fires on every keystroke (no debounce at this catalog size)

**Acceptance criteria (maps to must-have #7):**
- Input is autofocused on page load
- Typing filters in real time
- Clearing the input restores the full list
- Input is disabled in loading, error, and empty states

---

### Task 3 — E4-S3: SkillList + SkillCard components

**Files:** `src/fe/components/SkillList.tsx`, `src/fe/components/SkillCard.tsx`
**Depends on:** Task 1, shared types

`SkillList` props: `skills: SkillEntry[]`, `totalSkillCount: number`, `query: string`

SkillList rendering logic:
- If `totalSkillCount === 0`: render empty state message (not no-results — the catalog is empty)
- If `skills.length === 0` and `query` is non-empty: render no-results state message
- Otherwise: render a `<ul>` of `<li>` elements, one `<SkillCard>` each

Key each `<li>` on `skill.repo + '/' + skill.path` — not on `skillName` (ADR-002: skillName is
not globally unique).

`SkillCard` props: `skill: SkillEntry`

SkillCard renders:
- Skill name: `<h2>{skill.name ?? skill.skillName}</h2>` — null fallback to skillName (always present)
- Description: if `skill.description !== null`, render `<p>{skill.description}</p>`. If null, render nothing.
- Source repo: `<a href={skill.repoUrl} target="_blank" rel="noopener noreferrer">
    {skill.repo}<span className="visually-hidden"> (opens in new tab)</span></a>`
- Install command: `<code>npx skills add {skill.repoUrl} --skill {skill.skillName}</code>`
- `<CopyButton skill={skill} />`

**State messages (exact microcopy from user-flows.md):**

Empty state:
```
<h2>No skills found yet.</h2>
<p>The scanner has run but found no SKILL.md files in the configured repositories.</p>
```

No-results state:
```
<h2>No skills match "{query truncated to 30 chars}".</h2>
<p>Try a different search term, or clear the search to browse all skills.</p>
```

**Acceptance criteria (maps to must-have #6):**
- One card per skill in the filtered list
- Each card shows name (or skillName fallback), description (omitted if null), repo link, command
- Empty state shows message instead of blank area
- No-results state is distinct from empty state
- Cards keyed correctly (no React key warnings in console)

---

### Task 4 — E4-S4: CopyButton component

**File:** `src/fe/components/CopyButton.tsx`
**Depends on:** Task 3, shared types

Props: `skill: SkillEntry`

Behavior:
1. Build command: `npx skills add ${skill.repoUrl} --skill ${skill.skillName}` — no trailing whitespace, no newline
2. On click: call `navigator.clipboard.writeText(command)`
3. On success:
   - Show "Copied!" for 2 seconds, then revert to "Copy"
   - `console.log('install_copied', { skillName: skill.skillName, repo: skill.repo })`
     — this is the Tier B analytics placeholder (success-metrics.md); do not remove it
4. On failure: show "Failed — try again" for 2 seconds, then revert
5. Do not disable the button during the 2-second feedback window

Accessibility (from user-flows.md):
- `aria-label={`Copy install command for ${skill.name ?? skill.skillName}`}` on the `<button>`
- One `aria-live="polite"` region per-page announces copy result (the component can render the
  live region; App can also own it — Lead's decision was to put it in CopyButton; it should be
  one per page, so consider lifting it to App or SkillList if multiple CopyButtons render)
  - On success: update region to `Install command for ${name} copied to clipboard.`
  - On failure: update region to `Copy failed for ${name}. Try again.`
- Use a native `<button>` element — never `<div>` or `<span>` with onClick

Note on aria-live: if you render one `<div aria-live="polite">` per CopyButton, all of them will
announce simultaneously when any one fires. Recommend: lift the live region into App or SkillList
(one per page) and pass an `onCopy` callback up. This is the cleanest implementation.

**Acceptance criteria (maps to must-have #8):**
- Clicking copies exact command string to clipboard
- "Copied!" feedback appears for 2 seconds then reverts
- "Failed — try again" appears on clipboard failure, then reverts
- `console.log('install_copied', {...})` fires on success (verify in browser devtools)
- Copied string has no trailing whitespace or newline
- Button is keyboard-activatable (Enter and Space)

---

### Task 5 — E4-S5: Frontend unit tests

**Directory:** `tests/fe/`
**Depends on:** Tasks 1–4

Minimum tests (from phase plan cut-line — do not cut below this):

1. **Command string test:** given a `SkillEntry` with known `repoUrl` and `skillName`, the
   generated command is exactly `npx skills add ${repoUrl} --skill ${skillName}` with no trailing
   content. Test this as a pure function (extract the command-building logic from CopyButton).

2. **Search filter test:** given an array of skills, filtering case-insensitively on name and
   description returns correct subsets. Test directly against the filter logic in App.

3. **Null name test:** rendering a SkillCard with `name: null` shows `skillName` instead and does
   not throw.

4. **Null description test:** rendering a SkillCard with `description: null` renders no `<p>` element
   and does not throw.

5. **Empty catalog test:** SkillList with empty skills array and `totalSkillCount === 0` renders
   the empty state message.

6. **No-results test:** SkillList with empty filtered array but `totalSkillCount > 0` renders the
   no-results message.

Use `@testing-library/react` + `jsdom` for component rendering tests, or pure logic extraction
where possible. Keep tests simple — the goal is confidence that the contract is met, not 100%
branch coverage.

---

## 10. aria-live Recommendation for Junior

The `aria-live` region for copy feedback should be a single `<div aria-live="polite" aria-atomic="true">`
rendered in `App`, with its text content controlled by a piece of state. `CopyButton` accepts an
`onCopy: (message: string) => void` callback prop and calls it on success or failure. App updates
the live region text. This keeps exactly one live region in the DOM regardless of how many cards
are rendered, which is the correct accessible pattern.

---

## 11. Definition of Done

**Lead's work (this session):**
- `npm install` completes without errors
- `npm run typecheck` passes with zero errors
- `npm run test` passes with all scanner unit tests green
- `npm run build` completes and produces `dist/` including `dist/data/skills.json`
- `data/skills.json` contains a valid empty-but-conformant envelope
- `src/types/skills.ts` is committed and importable by both halves

**Junior's work (frontend track):**
- All five UI states render correctly (manual verification + unit tests)
- `npm run typecheck` still passes after frontend implementation
- `npm run test` passes including frontend unit tests
- `npm run build` still passes
- CopyButton copies exact command string with no trailing whitespace
- `console.log('install_copied', {...})` fires on successful copy

---

## 12. Technical Debt

None introduced in this session. Tracked items from design decisions:

| Debt | Where | Priority | Notes |
|------|-------|----------|-------|
| No retry button on error state | `App.tsx` | Low | Accepted v1 scope decision; add if error rates observed post-launch |
| No Playwright e2e tests | `tests/e2e/` | Medium | Phase plan cut-line item; fast-follow after launch |
| `console.log` analytics placeholder | `CopyButton.tsx` | Low | Replace with real analytics in fast-follow per success-metrics.md recommendation |
| Sequential per-repo scanning | `src/scan/index.ts` | Low | Sufficient for < 20 repos; add bounded concurrency if repo list grows significantly |
| No debounce on search | `SearchBar.tsx` | Low | Accepted at tens-to-hundreds catalog size; add if catalog grows to thousands |

---

## Links

- `docs/dev-team/adr-001-scanner-discovery-strategy.md` — discovery algorithm
- `docs/dev-team/adr-002-data-schema-output-contract.md` — the data contract
- `docs/dev-team/adr-003-data-serving-on-github-pages.md` — fetch URL and base path
- `docs/dev-team/adr-004-cicd-pipeline-shape.md` — two-workflow CI/CD design
- `docs/dev-team/adr-005-frontend-architecture.md` — component shape and TypeScript decision
- `docs/dev-team/user-flows.md` — all five UI states, microcopy, a11y
- `docs/dev-team/success-metrics.md` — Tier A metadata fields + console.log placeholder
- `docs/dev-team/phase-plan.md` — build order, gates, cut line
