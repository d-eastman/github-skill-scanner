# Test Plan
**Feature / Scope:** GitHub Skill Scanner v1 — Full build (scanner + frontend + CI/CD)
**Author:** Remy Dubois (QA Engineer)
**Date:** 2026-06-04
**Build / Commit:** HEAD (main) — tested 2026-06-04
**Status:** Complete

---

## Scope

### What is being tested

All nine must-haves from requirements.md, the five frontend UI states from user-flows.md, the ADR-002
data contract, the scanner module behaviors (layout matching, frontmatter parsing, envelope assembly,
graceful failure), and the GitHub Actions workflow structure.

### What is NOT being tested

- Live GitHub Pages deployment — the build artifact is verified locally; end-to-end HTTPS behavior
  on the deployed Pages URL requires a live environment not available in this test pass.
- Browser-native clipboard API under real browser security context — unit tests mock this; a
  real browser is required to confirm clipboard write actually lands on the OS clipboard.
- `autoFocus` in a real browser — jsdom does not implement focus management; this requires manual
  browser verification.
- `aria-live` announcements audited through a real screen reader (NVDA, VoiceOver, JAWS) — the
  structural correctness is verified in code; actual announcement behavior requires assistive tech.
- PAT-authenticated scan against a live private or rate-limited API — the unauthenticated scan
  run was observed but PAT behavior requires a valid secret.
- Playwright e2e tests — noted as TD-003; not present in this build. All multi-step user flows that
  require a running browser are manual/unverified.
- Scanner performance against > 1 repo (60-second NFR) — only 1 repo is configured; NFR cannot be
  fully exercised without a multi-repo config.
- Cross-browser (Chrome vs. Firefox) rendering differences — not exercised; requires live browser.

### Test environment

- Local macOS (Darwin 25.3.0), Node 20, npm
- Vitest v3.2.6 (unit tests)
- No running browser, no GitHub Pages URL
- Scanner run: unauthenticated against live `anthropics/skills` repo

---

## Entry Criteria

- [x] `npm install` completes without errors
- [x] Requirements document is final (approved 2026-06-04)
- [x] Technical spec is available
- [x] Lead reports green (independent claim — verified by running suite ourselves)

---

## Test Cases

### Happy Path

#### TC-001: Full unit test suite passes
**Hypothesis:** All scanner and frontend unit tests pass without modification, confirming the baseline
build is green.
**Preconditions:** `npm install` complete; no node_modules changes.
**Level:** Automated (Vitest)
**Status:** AUTOMATED — executed this pass

**Steps:**
1. Run `npm run test`

**Expected result:** All test files pass; zero failures.
**Actual result:** [x] Pass
**Notes:** 4 test files, 58 tests, 58 passed. Duration 486ms.
```
Tests  58 passed (58)
Test Files  4 passed (4)
```

---

#### TC-002: TypeScript typecheck passes
**Hypothesis:** The full project (scanner + frontend) typechecks without errors, confirming the shared
type contract in `src/types/skills.ts` is respected by both halves.
**Preconditions:** None
**Level:** Automated (tsc)
**Status:** AUTOMATED — executed this pass

**Steps:**
1. Run `npm run typecheck`

**Expected result:** Zero TypeScript errors.
**Actual result:** [x] Pass
**Notes:** Zero errors, clean exit.

---

#### TC-003: Production build succeeds and includes data artifact
**Hypothesis:** `npm run build` runs `copy-data` then Vite, producing `dist/` that includes
`dist/data/skills.json` — the ADR-003 requirement.
**Preconditions:** `data/skills.json` exists.
**Level:** Automated (build script)
**Status:** AUTOMATED — executed this pass

**Steps:**
1. Run `npm run build`
2. Verify `dist/data/skills.json` exists and is valid JSON.

**Expected result:** Build completes without error; `dist/data/skills.json` is present.
**Actual result:** [x] Pass
**Notes:**
```
✓ built in 232ms
dist/index.html  0.57 kB
dist/assets/index-B69vbVdy.css  1.86 kB
dist/assets/index-o7Ibj9gH.js  147.80 kB
dist/data/skills.json  — present, valid JSON
```

---

#### TC-004: Scanner dry-run without GITHUB_TOKEN — guard behavior
**Hypothesis:** Running `npm run scan` without a token logs a warning but does not fatal-exit before
attempting the API; actual API calls proceed at lower rate limit.
**Preconditions:** `GITHUB_TOKEN` not set in environment.
**Level:** Integration (live network, unauthenticated)
**Status:** EXECUTED — live run this pass

**Steps:**
1. Run `npm run scan` with no `GITHUB_TOKEN` set.

**Expected result:** Warning logged about missing token; scanner proceeds; writes output.
**Actual result:** [x] Pass
**Notes:** Scanner logged the expected warning, then ran to completion. Scanned `anthropics/skills`,
found and wrote 18 skills. Rate limit consumed 2 requests (58 remaining logged). Exited 0.
```
[scanner] GITHUB_TOKEN is not set — proceeding without auth.
[scanner] Wrote 18 skills to ...data/skills.json (1/1 repos succeeded)
```

---

#### TC-005: ADR-002 data contract conformance — live scan output
**Hypothesis:** The scanner's live output conforms to every field rule in ADR-002: correct shape,
`skillCount === skills.length`, sorted order, no trailing slashes on `repoUrl`, all required fields
present on every entry.
**Preconditions:** TC-004 has run; `data/skills.json` contains live scan output.
**Level:** Integration (programmatic verification of file content)
**Status:** EXECUTED — verified this pass

**Steps:**
1. Read `data/skills.json` after live scan.
2. Verify: `schemaVersion === 1`, `skillCount === skills.length`, `lastScanned` is valid ISO 8601,
   all skills have required fields, `repoUrl` has no trailing slash, sort order is repo-then-skillName.

**Expected result:** All checks pass.
**Actual result:** [x] Pass
**Notes:**
- `schemaVersion`: 1 (correct)
- `skillCount` 18 === `skills.length` 18 (correct)
- `lastScanned` parses as valid Date (correct)
- All 18 skills have `name`, `description`, `skillName`, `repo`, `repoUrl`, `path`
- `repoUrl`: no trailing slash on any entry
- Sort order: verified correct (repo ascending, then skillName ascending)

---

### Edge Cases — Scanner

#### TC-010: Layout matching — L1 root SKILL.md → skillName is repo name
**Hypothesis:** `matchSkillPath('SKILL.md', 'my-repo')` returns `skillName = 'my-repo'` (L1 rule).
**Level:** Automated unit (layout.test.ts)
**Status:** AUTOMATED — passing

**Expected result:** `{ layout: 'L1', skillName: 'my-repo' }`
**Actual result:** [x] Pass
**Notes:** 2 L1 tests pass.

---

#### TC-011: Layout matching — L2 `<skill>/SKILL.md`
**Hypothesis:** `matchSkillPath('frontend-design/SKILL.md', 'skills')` returns `skillName = 'frontend-design'`.
**Level:** Automated unit (layout.test.ts)
**Status:** AUTOMATED — passing

**Actual result:** [x] Pass

---

#### TC-012: Layout matching — L3 `skills/<skill>/SKILL.md`
**Hypothesis:** `matchSkillPath('skills/pdf/SKILL.md', 'skills')` returns `skillName = 'pdf'`.
**Level:** Automated unit (layout.test.ts)
**Status:** AUTOMATED — passing

**Actual result:** [x] Pass

---

#### TC-013: Layout matching — non-matching paths return null
**Hypothesis:** Paths that are four segments deep, have wrong filename case, or have wrong L3 prefix
all return null and are excluded from the scan.
**Level:** Automated unit (layout.test.ts)
**Status:** AUTOMATED — passing

**Steps:** Tests cover: `skill.md` (wrong case), `SKILL.MD` (uppercase ext), `docs/examples/x/SKILL.md`
(4 segments), `tooling/pdf/SKILL.md` (wrong prefix), `README.md`.
**Actual result:** [x] Pass (7 non-match tests)

---

#### TC-014: Layout matching — leading slash normalization
**Hypothesis:** Paths with a leading slash (e.g. `/SKILL.md`, `/frontend-design/SKILL.md`) are
normalized and match correctly.
**Level:** Automated unit (layout.test.ts)
**Status:** AUTOMATED — passing

**Actual result:** [x] Pass

---

#### TC-015: Layout matching — L2 vs L3 observed in live data
**Hypothesis:** The live scan correctly applies both L2 and L3 matching; `template/SKILL.md` is
classified as L2 while `skills/*/SKILL.md` are classified as L3.
**Level:** Integration (live scan output verification)
**Status:** EXECUTED — verified this pass

**Actual result:** [x] Pass
**Notes:** `template/SKILL.md` → skillName `template` (L2). 17 skills under `skills/` prefix (L3).
Both layout types correctly discriminated in the real repo.

---

#### TC-016: Frontmatter parse — valid YAML extracts name and description
**Hypothesis:** A `SKILL.md` with well-formed YAML frontmatter yields non-null name and description.
**Level:** Automated unit (parser.test.ts)
**Status:** AUTOMATED — passing

**Actual result:** [x] Pass

---

#### TC-017: Frontmatter parse — missing `name` field → null, no crash
**Hypothesis:** A file with frontmatter that omits `name` yields `name: null`; scan continues.
**Level:** Automated unit (parser.test.ts)
**Status:** AUTOMATED — passing

**Actual result:** [x] Pass

---

#### TC-018: Frontmatter parse — missing `description` field → null, no crash
**Actual result:** [x] Pass

---

#### TC-019: Frontmatter parse — empty frontmatter `--- ---` → both null, no crash
**Actual result:** [x] Pass

---

#### TC-020: Frontmatter parse — no frontmatter at all → both null, no crash
**Actual result:** [x] Pass

---

#### TC-021: Frontmatter parse — malformed YAML → no crash
**Hypothesis:** Genuinely broken YAML (unclosed brackets, invalid structure) does not throw or crash
the scan; both fields are null.
**Level:** Automated unit (parser.test.ts)
**Status:** AUTOMATED — passing

**Actual result:** [x] Pass

---

#### TC-022: Frontmatter parse — non-string values coerced (not null)
**Hypothesis:** `name: 42` (numeric) and `description: true` (boolean) are coerced to strings, not
returned as null.
**Level:** Automated unit (parser.test.ts)
**Status:** AUTOMATED — passing

**Actual result:** [x] Pass

---

#### TC-023: Writer — envelope sort order (repo, then skillName)
**Hypothesis:** Skills written in any order by the scanner are sorted by repo ascending, then
skillName ascending in the output file.
**Level:** Automated unit (writer.test.ts)
**Status:** AUTOMATED — passing

**Actual result:** [x] Pass

---

#### TC-024: Writer — skillCount equals skills.length
**Hypothesis:** `metadata.skillCount` is always the exact length of the `skills` array.
**Level:** Automated unit (writer.test.ts)
**Status:** AUTOMATED — passing

**Actual result:** [x] Pass

---

#### TC-025: Writer — empty skills array produces valid envelope (not absent file)
**Hypothesis:** A zero-skill scan writes `{ metadata: {...}, skills: [] }` — never an absent file,
never null skills.
**Level:** Automated unit (writer.test.ts)
**Status:** AUTOMATED — passing

**Actual result:** [x] Pass

---

#### TC-026: Writer — lastScanned is valid ISO 8601 UTC timestamp
**Level:** Automated unit (writer.test.ts)
**Actual result:** [x] Pass

---

#### TC-027: Scanner — all-repos-fail exit code
**Hypothesis:** If every configured repo fails, the scanner exits with code 1. If only some fail,
it exits 0 with a warning.
**Level:** Code review (src/scan/index.ts lines 257-267)
**Status:** VERIFIED by code inspection — not executable without controlled failure injection

**Expected result:** `reposFailed === reposSucceeded === 0` → `process.exit(1)`. Partial failure → exit 0 + warn.
**Actual result:** [x] Pass (code inspection)
**Notes:** Lines 258-260 implement `if (reposFailed > 0 && reposSucceeded === 0) process.exit(1)`.
Lines 263-265 implement partial-failure warning. Cannot run a destructive test without a mock; the
unit tests do not cover this execution path directly. Recommend adding a unit test for this exit code
path in a fast-follow.

---

### Edge Cases — Frontend

#### TC-030: Command string format — exact, no trailing whitespace, no newline
**Hypothesis:** The command built by CopyButton and displayed in the `<code>` element is exactly
`npx skills add ${repoUrl} --skill ${skillName}` with no trailing content.
**Level:** Automated unit (frontend.test.tsx)
**Status:** AUTOMATED — passing

**Actual result:** [x] Pass

---

#### TC-031: Search — case-insensitive match on name field
**Level:** Automated unit (frontend.test.tsx)
**Actual result:** [x] Pass

---

#### TC-032: Search — case-insensitive match on description field
**Level:** Automated unit (frontend.test.tsx)
**Actual result:** [x] Pass

---

#### TC-033: Search — match on skillName field (null name fallback discoverability)
**Hypothesis:** Search matches on `skillName` even when `name` is null, satisfying user-flows.md
note 3 (search must not lose skills with null names).
**Level:** Automated unit (frontend.test.tsx)
**Status:** AUTOMATED — passing

**Actual result:** [x] Pass
**Notes:** App.tsx filter includes `s.skillName.toLowerCase().includes(q)`.

---

#### TC-034: Search — null name does not crash filter
**Level:** Automated unit (frontend.test.tsx)
**Actual result:** [x] Pass

---

#### TC-035: Search — null description does not crash filter
**Level:** Automated unit (frontend.test.tsx)
**Actual result:** [x] Pass

---

#### TC-036: Search — empty query returns full list
**Level:** Automated unit (frontend.test.tsx)
**Actual result:** [x] Pass

---

#### TC-037: Search — query with no matches returns empty array
**Level:** Automated unit (frontend.test.tsx)
**Actual result:** [x] Pass

---

#### TC-038: SkillCard — null name renders skillName fallback, no blank heading
**Level:** Automated unit (frontend.test.tsx)
**Actual result:** [x] Pass

---

#### TC-039: SkillCard — null description omits `<p>` element entirely
**Hypothesis:** When `description` is null, no `<p>` is rendered for description. The only `<p>`
in the card is the Source line.
**Level:** Automated unit (frontend.test.tsx)
**Status:** AUTOMATED — passing

**Actual result:** [x] Pass
**Notes:** Test verifies exactly 1 `<p>` element, containing "Source:".

---

#### TC-040: SkillCard — repo link has correct href, target="_blank", rel="noopener noreferrer"
**Level:** Automated unit (frontend.test.tsx)
**Actual result:** [x] Pass

---

#### TC-041: SkillCard — install command rendered in `<code>` element
**Level:** Automated unit (frontend.test.tsx)
**Actual result:** [x] Pass

---

#### TC-042: SkillList — empty catalog state (totalSkillCount === 0)
**Hypothesis:** When `totalSkillCount` is 0, SkillList renders "No skills found yet." — the empty
state, not the no-results state.
**Level:** Automated unit (frontend.test.tsx)
**Status:** AUTOMATED — passing

**Actual result:** [x] Pass

---

#### TC-043: SkillList — no-results state (catalog has skills, filter matches none)
**Hypothesis:** When `totalSkillCount > 0` but filtered `skills.length === 0`, SkillList renders
"No skills match {query}." — the no-results state, not the empty state.
**Level:** Automated unit (frontend.test.tsx)
**Status:** AUTOMATED — passing

**Actual result:** [x] Pass
**Notes:** Empty state and no-results state are correctly distinguished.

---

#### TC-044: SkillList — long query truncated to 30 chars in no-results message
**Level:** Automated unit (frontend.test.tsx)
**Actual result:** [x] Pass

---

#### TC-045: SkillList — cards rendered as `<ul>` / `<li>` with correct count
**Level:** Automated unit (frontend.test.tsx)
**Actual result:** [x] Pass

---

#### TC-046: SkillList — list keyed on `repo + '/' + path` (not skillName)
**Level:** Automated unit (frontend.test.tsx — key test via render without console warnings)
**Actual result:** [x] Pass (no key warnings in test output; key logic confirmed in code)

---

### Error States

#### TC-050: Error state — fetch fails → error message rendered (not blank page)
**Hypothesis:** When the `fetch()` for `data/skills.json` fails or returns non-OK, `status` becomes
`"error"` and the error message is rendered with `role="alert"`.
**Level:** Manual / requires browser with network mocking or broken fetch URL
**Status:** MANUAL — NOT EXECUTED in this pass

**Expected result:** "Could not load the skill catalog." heading rendered with `role="alert"`;
SearchBar is disabled; no blank page.
**Actual result:** [ ] Not executed
**Notes:** Unit test coverage of the App fetch lifecycle is absent. This path is only tested manually
or via Playwright e2e (TD-003). Recommend adding an App-level unit test that mocks fetch to reject.

---

#### TC-051: Loading state — SearchBar disabled during fetch
**Hypothesis:** While `status === 'loading'`, the SearchBar `disabled` prop is `true` and the input
does not accept keyboard input.
**Level:** Manual / requires browser (or App-level unit test with fetch mock)
**Status:** MANUAL — NOT EXECUTED; code-verified only

**Actual result:** [ ] Not executed (code-verified: `disabled={true}` in loading branch of App.tsx)

---

#### TC-052: Empty state — shows timestamp, SearchBar disabled
**Hypothesis:** When `skills.length === 0` after a successful fetch, the empty state message renders
and the SearchBar is disabled (nothing to search).
**Level:** Manual
**Status:** MANUAL — NOT EXECUTED in this pass

**Actual result:** [ ] Not executed
**Notes:** Code-verified: `isSearchDisabled = status !== 'ready' || skills.length === 0`. Empty
state SkillList rendering tested (TC-042). App integration not tested.

---

#### TC-053: CopyButton — "Copied!" feedback reverts to "Copy" after 2 seconds
**Hypothesis:** After a successful clipboard write, the button label changes to "Copied!" and reverts
to "Copy" exactly 2 seconds later.
**Level:** Manual (requires real browser + timer)
**Status:** MANUAL — NOT EXECUTED; requires real browser

**Actual result:** [ ] Not executed
**Notes:** Code path is present (`setTimeout 2000`). Not exercisable in jsdom without fake timers.
This is a must-have #8 acceptance criterion that is not covered by any automated test.

---

#### TC-054: CopyButton — "Failed — try again" on clipboard API failure
**Hypothesis:** When `navigator.clipboard.writeText` rejects (e.g., permissions denied), the failure
label appears and reverts.
**Level:** Manual
**Status:** MANUAL — NOT EXECUTED

**Actual result:** [ ] Not executed

---

### Accessibility Cases

#### TC-060: SearchBar — visually hidden label present
**Hypothesis:** `<label htmlFor="search-input">Search skills</label>` exists in the DOM; label is
associated with the input via `htmlFor`. Placeholder is not the only label (WCAG 1.3.1).
**Level:** Automated unit (code-visible in SearchBar.tsx; structural)
**Status:** VERIFIED by code inspection

**Actual result:** [x] Pass (code inspection)
**Notes:** `<label htmlFor="search-input" className="sr-only">Search skills</label>` present.

---

#### TC-061: SearchBar — autoFocus when not disabled
**Hypothesis:** `autoFocus={!disabled}` on the search input means the input is autofocused on page
load in the populated state.
**Level:** Manual (real browser required)
**Status:** MANUAL — NOT EXECUTED

**Actual result:** [ ] Not executed
**Notes:** Code-verified: `autoFocus={!disabled}`. Real browser required. jsdom does not implement
focus management. This is a must-have #7 acceptance criterion.

---

#### TC-062: CopyButton — aria-label includes skill name
**Hypothesis:** Each copy button has `aria-label="Copy install command for {name ?? skillName}"`,
making it distinguishable from other copy buttons for screen readers.
**Level:** Automated unit (code inspection + frontend.test.tsx renders button)
**Status:** VERIFIED by code inspection

**Actual result:** [x] Pass (code inspection)
**Notes:** `aria-label={\`Copy install command for ${skill.name ?? skill.skillName}\`}` present.

---

#### TC-063: aria-live region — one per page, not one per CopyButton
**Hypothesis:** A single `<div aria-live="polite" aria-atomic="true">` exists in App, not one per
CopyButton. CopyButton calls `onCopy` callback to update it.
**Level:** Automated unit (code inspection)
**Status:** VERIFIED by code inspection

**Actual result:** [x] Pass
**Notes:** Single live region in App.tsx line 92-94. CopyButton accepts `onCopy` prop.

---

#### TC-064: Error state — role="alert" on error container
**Hypothesis:** The error state container has `role="alert"` so screen readers announce it immediately.
**Level:** Code inspection
**Status:** VERIFIED by code inspection

**Actual result:** [x] Pass
**Notes:** `<div role="alert" className="state-message">` present in App.tsx line 115.

---

#### TC-065: aria-busy on list container during loading (TD-007)
**Hypothesis:** The list container has `aria-busy="true"` during loading per user-flows.md spec.
**Level:** Code inspection
**Status:** FAIL — known gap (TD-007)

**Actual result:** [x] Fail
**Notes:** `aria-busy` is absent from App.tsx. This is a documented tech debt item (TD-007). Severity:
Low per tech debt register. Not a blocker per PM decision in the debt register.
**Bug:** BUG-001 filed.

---

#### TC-066: CopyButton — native `<button>` element (not div/span)
**Level:** Code inspection
**Actual result:** [x] Pass
**Notes:** `<button onClick={handleClick}>` in CopyButton.tsx.

---

#### TC-067: aria-live — copy result announced to screen reader
**Hypothesis:** When CopyButton fires, the aria-live region text updates to the appropriate message.
**Level:** Manual (real screen reader required for true verification)
**Status:** PARTIALLY VERIFIED

**Actual result:** [x] Structural pass (code inspection); [!] Behavioral unverified
**Notes:** The live region updates via React state (`setLiveMessage`). Actual screen reader
announcement requires VoiceOver or NVDA. This cannot be confirmed without assistive technology.

---

### GitHub Actions / CI-CD Cases

#### TC-070: scan.yml — cron schedule is at least daily
**Level:** Workflow file inspection
**Status:** VERIFIED

**Actual result:** [x] Pass
**Notes:** `cron: "0 6 * * *"` (daily at 06:00 UTC).

---

#### TC-071: scan.yml — runs npm install and scanner script
**Level:** Workflow file inspection
**Status:** VERIFIED

**Actual result:** [x] Pass
**Notes:** Steps: `npm ci`, then `npm run scan` with `GITHUB_TOKEN: ${{ secrets.SCAN_PAT }}`.

---

#### TC-072: scan.yml — commits only if data changed, no empty commit
**Level:** Workflow file inspection
**Status:** VERIFIED

**Actual result:** [x] Pass
**Notes:** `if [ -z "$(git status --porcelain data/)" ]` guard before commit. Exits 0 cleanly on no change.

---

#### TC-073: deploy.yml — builds frontend and uploads Pages artifact
**Level:** Workflow file inspection
**Status:** VERIFIED

**Actual result:** [x] Pass
**Notes:** `npm run build` step followed by explicit check for `dist/data/skills.json` before upload.
Hard-fails if data artifact is missing.

---

#### TC-074: Workflow — no hard-coded GITHUB_TOKEN (PAT stored as secret)
**Level:** Workflow + source file inspection
**Status:** VERIFIED

**Actual result:** [x] Pass
**Notes:** `src/scan/client.ts` reads `process.env.GITHUB_TOKEN`. Workflows reference `secrets.SCAN_PAT`.
No token visible in any committed file.

---

### Regression Cases

#### TC-080: `data/skills.json` is present at repo root (frontend fetch dependency)
**Preconditions:** Post-build state.
**Status:** VERIFIED

**Actual result:** [x] Pass
**Notes:** File exists; contains valid empty-but-conformant envelope as initial committed state.

---

#### TC-081: `dist/data/skills.json` present after `npm run build`
**Status:** VERIFIED (TC-003)

**Actual result:** [x] Pass

---

#### TC-082: `src/scan/repos.json` contains at least one entry
**Status:** VERIFIED

**Actual result:** [x] Pass
**Notes:** `[{ "owner": "anthropics", "repo": "skills" }]`

---

#### TC-083: `data/README.md` documents schema (must-have #4 AC)
**Status:** VERIFIED

**Actual result:** [x] Pass
**Notes:** `data/README.md` present with full schema documentation, field rules, install command
format, and layout table. Points to ADR-002.

---

---

## Must-Have Coverage Summary

| Must-Have | TC(s) | Automated | Result |
|-----------|-------|-----------|--------|
| #1 Static repo config | TC-082 | Inspection | Pass |
| #2 Discover ALL SKILL.md per repo (incl. layouts, graceful skip, exit code) | TC-010–TC-015, TC-027 | Unit (L1/L2/L3/null); Integration (live); Code inspection (exit code) | Pass (exit code: code-verified only) |
| #3 Metadata extraction (name, desc, skillName, repo, repoUrl, path; null-tolerant) | TC-016–TC-022, TC-005 | Unit + Integration | Pass |
| #4 JSON output to data/ with documented schema | TC-023–TC-026, TC-080, TC-083 | Unit + Inspection | Pass |
| #5 Scheduled GHA workflow | TC-070–TC-074 | Inspection | Pass |
| #6 Frontend catalog display (all 5 states) | TC-042–TC-046, TC-050–TC-052 | Unit (states 3-5); MANUAL UNVERIFIED (states 1-2 integration) | Partial |
| #7 Frontend search (autofocus, case-insensitive, real-time, clear, no-results) | TC-031–TC-037, TC-061 | Unit; autofocus MANUAL | Partial |
| #8 Copy install command (exact string, feedback, clipboard, 2s revert) | TC-030, TC-053–TC-054 | Unit (string); MANUAL (clipboard, timer) | Partial |
| #9 Frontend deployed to GitHub Pages | TC-003, TC-073 | Build verified; live Pages NOT tested | Partial |

---

## Exit Criteria

- [x] All happy path test cases pass (TC-001 through TC-005)
- [x] All automated scanner edge cases pass (TC-010–TC-027 excluding TC-027 which is code-verified)
- [x] All automated frontend unit tests pass (TC-030–TC-046)
- [x] All workflow inspection cases pass (TC-070–TC-083)
- [x] No open Severity 1 (Critical) bugs
- [x] No open Severity 2 (High) bugs without PM sign-off
- [ ] Playwright e2e tests — not present (TD-003); fast-follow item

---

## Bug Summary

| Bug ID | Title | Severity | Status | Link |
|--------|-------|----------|--------|------|
| BUG-001 | aria-busy missing on list container during loading | Low | Open (Tech Debt TD-007) | docs/dev-team/bug-reports/BUG-001.md |

---

## Quality Risk Assessment

See bottom of this document and the separate risk assessment below.

**Go recommendation:** Ship with known issues

**Known issues accepted for this release:**
- BUG-001: `aria-busy` missing (TD-007, Low severity, accepted per tech debt register)
- No Playwright e2e tests (TD-003, Medium severity); manual browser verification recommended before
  deploy
- Copy button 2s revert timer is code-present but not automatically tested
- `autoFocus` behavior is code-correct but not verified in a real browser

**Concerns that don't block ship but should be watched:**
- `skillCount >= 1` at launch is an operational gate — the scanner ran and produced 18 skills from
  the live repo. This satisfies the content gate for the current config, but the deployed site must
  be verified against the actual Pages URL after deploy.
- Live Pages URL fetch path (`/github-skill-scanner/data/skills.json`) is configured via `BASE_URL`
  but has not been confirmed end-to-end.
- Vitest < 4.1.0 CVE (TD-001): only affects `vitest ui` which is not used. Not a ship blocker but
  should be addressed in the first post-launch sprint.

---

---

# Feature Addition: Scanned Repos Indicator (SR-1)

**Feature:** Scanned Repos Indicator (Story SR-1)
**Author:** Remy Dubois (QA Engineer)
**Date:** 2026-06-05
**Status:** PRE-IMPLEMENTATION — test cases authored before build begins
**Source documents:** requirements-scanned-repos.md (OQ-SR-1 → B, OQ-SR-2 → summary+expand);
user-flows.md Section 8; ADR-002 addendum 2026-06-05

---

## SR-1 Scope

### What this section tests

The new `metadata.repos` scanner output (ADR-002 addendum), the `ScannedReposIndicator` frontend
component (user-flows.md §8), and the five render-guard states from §8g. Regression scope covers
the existing writer, frontend, and e2e suites that could be affected by changes to `writeCatalog`,
`SkillsMetadata`, and `App.tsx`.

### What this section does NOT test

- Per-repo skill-count display (deferred to a future iteration per UX recommendation in §8f)
- Any UI for editing or adding repos (out of scope per requirements-scanned-repos.md)
- Animated open/close transition (not specified in v1; §8i)
- Screen reader announcement of `<details>` open/close via a real assistive technology (structural
  correctness is verifiable in code; behavioral confirmation requires VoiceOver or NVDA)

### Prerequisite note — e2e fixture

The e2e fixture at `tests/e2e/fixtures/skills.json` currently has no `metadata.repos` field. The
new e2e cases (TC-135 through TC-137) require the fixture to include a `metadata.repos` array with
at least one entry covering each status variant (`succeeded` with skills, `succeeded` with zero
skills, `failed`). The Lead must update the fixture before the e2e tests can run. See TC-135 for
the exact shape required.

---

## SR-1 Test Cases

TC numbers begin at 100. Scanner cases are 100–109, frontend unit cases 110–129,
accessibility cases 130–134, e2e cases 135–139, regression cases 140–149.

---

### Scanner — `metadata.repos` Population

#### TC-100: Writer — `metadata.repos` is always an array in output
**Hypothesis:** After the SR-1 scanner change, `writeCatalog` always writes `metadata.repos` as an
array (never absent, never null), even when called with a single succeeding repo and no failed repos.
This mirrors the always-array guarantee already present for `skills`.
**Preconditions:** `writeCatalog` has been updated to accept and write `repos` per the ADR-002
addendum. `npm install` complete.
**Level:** Automated unit (writer.test.ts)
**Automatable now:** Yes — extend existing writer test suite with a `repos` presence check.
**Status:** NOT YET WRITTEN

**Steps:**
1. Call `writeCatalog` with one succeeding repo (`{ repo: "a/b", repoUrl: "...", skillCount: 2, status: "succeeded" }`).
2. Read and parse `data/skills.json`.
3. Assert `Array.isArray(written.metadata.repos)` is true.
4. Assert `written.metadata.repos.length === 1`.

**Expected result:** `metadata.repos` is a non-null array with one element.

---

#### TC-101: Writer — repo with skills → `{ skillCount: N, status: "succeeded" }`
**Hypothesis:** A repo that the scanner processes successfully and from which N skills were found
produces a `repos` entry with `skillCount === N` and `status === "succeeded"`.
**Preconditions:** Same as TC-100.
**Level:** Automated unit (writer.test.ts)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN

**Steps:**
1. Call `writeCatalog` with `skills = [makeSkill("a/b", "s1"), makeSkill("a/b", "s2")]` and
   `repos = [{ repo: "a/b", repoUrl: "https://github.com/a/b", skillCount: 2, status: "succeeded" }]`.
2. Read output; inspect `metadata.repos[0]`.

**Expected result:** `{ repo: "a/b", repoUrl: "https://github.com/a/b", skillCount: 2, status: "succeeded" }`.

---

#### TC-102: Writer — repo that succeeded with zero skills → `{ skillCount: 0, status: "succeeded" }`
**Hypothesis:** A repo that was scanned successfully but has no SKILL.md files is represented with
`skillCount: 0` and `status: "succeeded"` — not flagged as failed, not omitted.
This is the critical semantic distinction: zero skills is not an error.
**Preconditions:** Same as TC-100.
**Level:** Automated unit (writer.test.ts)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN

**Steps:**
1. Call `writeCatalog` with `skills = []` and
   `repos = [{ repo: "a/b", repoUrl: "https://github.com/a/b", skillCount: 0, status: "succeeded" }]`.
2. Read output; inspect `metadata.repos[0]`.

**Expected result:** `{ skillCount: 0, status: "succeeded" }`. No "failed" tag. `metadata.reposSucceeded === 1`, `metadata.reposFailed === 0`.

---

#### TC-103: Writer — failed repo → `{ status: "failed", skillCount: 0 }`
**Hypothesis:** A repo that errored during the tree-fetch is represented with `status: "failed"` and
`skillCount: 0`. The invariant `failed => skillCount === 0` is enforced at the write site, not just
by convention.
**Preconditions:** Same as TC-100.
**Level:** Automated unit (writer.test.ts)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN

**Steps:**
1. Call `writeCatalog` with
   `repos = [{ repo: "broken/repo", repoUrl: "https://github.com/broken/repo", skillCount: 0, status: "failed" }]`.
2. Read output; inspect `metadata.repos[0]`.

**Expected result:** `{ status: "failed", skillCount: 0 }`. `metadata.reposFailed === 1`.

---

#### TC-104: Writer — `repos` sorted ascending by `repo` string
**Hypothesis:** The writer sorts `metadata.repos` by `repo` ascending (case-sensitive) before
writing, regardless of the order repos were processed. This keeps git diffs stable when config order
changes.
**Preconditions:** Same as TC-100.
**Level:** Automated unit (writer.test.ts)
**Automatable now:** Yes — mirrors the existing sort test for `skills` (TC-023).
**Status:** NOT YET WRITTEN

**Steps:**
1. Call `writeCatalog` with `repos` supplied in reverse-alphabetical order:
   `[{ repo: "z-org/z-repo", ... }, { repo: "a-org/a-repo", ... }, { repo: "m-org/m-repo", ... }]`.
2. Read output; extract `metadata.repos.map(r => r.repo)`.

**Expected result:** `["a-org/a-repo", "m-org/m-repo", "z-org/z-repo"]`.

---

#### TC-105: Writer — invariant: `repos.length === metadata.repoCount`
**Hypothesis:** The length of `metadata.repos` always equals `metadata.repoCount`. These cannot
diverge: `repoCount` is derived from the `repos` array at the write site.
**Preconditions:** Same as TC-100.
**Level:** Automated unit (writer.test.ts)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN

**Steps:**
1. Call `writeCatalog` with 3 repos (mix of succeeded and failed).
2. Read output; assert `written.metadata.repos.length === written.metadata.repoCount`.

**Expected result:** Both values equal 3.

---

#### TC-106: Writer — invariant: succeeded/failed counts match `reposSucceeded` / `reposFailed`
**Hypothesis:** `count(repos[].status === "succeeded") === metadata.reposSucceeded` and
`count(repos[].status === "failed") === metadata.reposFailed`. These are the ADR-002 addendum
invariants and must be enforced at the single write site.
**Preconditions:** Same as TC-100.
**Level:** Automated unit (writer.test.ts)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN

**Steps:**
1. Call `writeCatalog` with 2 succeeded repos and 1 failed repo.
2. Read output.
3. Count `repos` entries by `status`.

**Expected result:** `reposSucceeded === 2`, `reposFailed === 1`, and the counts in `metadata` match
the counts derived from `repos[].status`.

---

#### TC-107: Writer — invariant: `sum(repos[].skillCount) === metadata.skillCount === skills.length`
**Hypothesis:** The sum of all per-repo `skillCount` values equals `metadata.skillCount` which
equals `skills.length`. This is the cross-invariant that lets the frontend trust `metadata.repos`
without re-deriving from `skills[]`.
**Preconditions:** Same as TC-100.
**Level:** Automated unit (writer.test.ts)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN

**Steps:**
1. Call `writeCatalog` with:
   - repo A: 3 skills, `skillCount: 3`, `status: "succeeded"`
   - repo B: 0 skills (empty scan), `skillCount: 0`, `status: "succeeded"`
   - repo C: failed, `skillCount: 0`, `status: "failed"`
   - `skills` array has exactly 3 entries, all from repo A.
2. Read output.
3. Assert `sum(repos[].skillCount) === 3`.
4. Assert `metadata.skillCount === 3`.
5. Assert `skills.length === 3`.

**Expected result:** All three values equal 3.

---

#### TC-108: Writer — invariant: `status === "failed"` implies `skillCount === 0`
**Hypothesis:** A `repos` entry with `status: "failed"` always has `skillCount: 0`. The writer must
reject or correct a `repos` entry that violates this (e.g. caller accidentally passes
`{ status: "failed", skillCount: 5 }`).
**Preconditions:** Same as TC-100.
**Level:** Automated unit (writer.test.ts)
**Automatable now:** Yes — but the exact behavior (throw vs. coerce to 0) is the Lead's call. The
test should verify either that an invalid entry throws, or that the written output coerces
`skillCount` to 0. The Lead must decide and the test must match that contract.
**Status:** NOT YET WRITTEN

**Steps:**
1. Call `writeCatalog` passing a `repos` entry with `{ status: "failed", skillCount: 5 }`.
2. Observe output or thrown error.

**Expected result:** Either a thrown invariant error, or `written.metadata.repos[0].skillCount === 0`.
The result of a `status: "failed"` entry must never be `skillCount > 0` in the written file.
**Note for Lead:** Decide at implementation time whether to throw or silently coerce. Document the
choice here when the test is written.

---

#### TC-109: TypeScript — `ScannedRepo` type and updated `SkillsMetadata` typecheck cleanly
**Hypothesis:** Adding `ScannedRepo` interface and `repos: ScannedRepo[]` to `SkillsMetadata` in
`src/types/skills.ts` does not introduce TypeScript errors in the scanner or frontend.
**Preconditions:** Type definitions updated per ADR-002 addendum.
**Level:** Automated (tsc — `npm run typecheck`)
**Automatable now:** Yes — run typecheck; zero errors is the pass criterion.
**Status:** NOT YET WRITTEN

**Steps:**
1. Apply type changes to `src/types/skills.ts`.
2. Run `npm run typecheck`.

**Expected result:** Zero TypeScript errors. Both scanner and frontend compile cleanly against the
new type.

---

### Frontend Unit — Render Guard

#### TC-110: ScannedReposIndicator — hidden in loading state
**Hypothesis:** When `status === "loading"`, the `ScannedReposIndicator` component is not present
in the DOM (not rendered at all, per the `status === "ready"` render guard in §8g).
**Preconditions:** `ScannedReposIndicator` component implemented; App passes `status` and
`metadata?.repos` to it (or the guard lives in App).
**Level:** Automated unit (frontend.test.tsx — extend existing suite or new describe block)
**Automatable now:** Yes, once component exists.
**Status:** NOT YET WRITTEN

**Steps:**
1. Render `App` with a fetch mock that never resolves (status stays "loading").
2. Query the DOM for the `<details>` element or the summary text "Scanning".

**Expected result:** Zero matches. The element is not in the DOM.

---

#### TC-111: ScannedReposIndicator — hidden in error state
**Hypothesis:** When `status === "error"`, the indicator is not present in the DOM.
**Preconditions:** Same as TC-110.
**Level:** Automated unit (frontend.test.tsx)
**Automatable now:** Yes, once component exists.
**Status:** NOT YET WRITTEN

**Steps:**
1. Render `App` with a fetch mock that rejects.
2. Query DOM for the indicator.

**Expected result:** Indicator absent from DOM.

---

#### TC-112: ScannedReposIndicator — hidden when `metadata.repos` is absent (older JSON)
**Hypothesis:** When `status === "ready"` but the parsed JSON has no `metadata.repos` key (i.e.
an older `skills.json` from before this feature), the indicator is not rendered and the app does
not crash with `undefined.length` or similar.
**Preconditions:** Same as TC-110.
**Level:** Automated unit (frontend.test.tsx)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN

**Steps:**
1. Render `App` (or `ScannedReposIndicator` directly) with `metadata` that has no `repos` key.
2. Assert no crash (no thrown error).
3. Query DOM for the indicator.

**Expected result:** App renders normally (skill cards visible if skills are present); indicator
absent from DOM; no console errors for undefined access.

---

#### TC-113: ScannedReposIndicator — hidden when `metadata.repos` is an empty array
**Hypothesis:** When `status === "ready"` and `metadata.repos` is `[]` (zero-length), the indicator
is not rendered. An empty array means the config had no repos configured — a degenerate state that
should not show a "Scanning 0 repositories" summary line.
**Preconditions:** Same as TC-110.
**Level:** Automated unit (frontend.test.tsx)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN

**Steps:**
1. Render with `metadata.repos = []`.
2. Query DOM for indicator.

**Expected result:** Indicator absent from DOM.

---

#### TC-114: ScannedReposIndicator — shown when `status === "ready"` and repos present
**Hypothesis:** When `status === "ready"` and `metadata.repos` has at least one entry, the
`<details>` element is rendered and the summary text is visible.
**Preconditions:** Same as TC-110.
**Level:** Automated unit (frontend.test.tsx)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN

**Steps:**
1. Render with `status = "ready"` and `metadata.repos = [{ repo: "a/b", repoUrl: "https://github.com/a/b", skillCount: 1, status: "succeeded" }]`.
2. Query DOM for the `<details>` element with `aria-label="Scanned repositories"`.
3. Query for the summary text.

**Expected result:** `<details>` element present; summary contains "Scanning 1 repository".

---

### Frontend Unit — Summary Text

#### TC-115: Summary text — singular: "Scanning 1 repository" (not "repositories")
**Hypothesis:** When `metadata.repos.length === 1`, the `<summary>` text is exactly
"Scanning 1 repository" (singular). The plural form "repositories" must not appear.
**Preconditions:** Same as TC-110.
**Level:** Automated unit (frontend.test.tsx)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN

**Steps:**
1. Render with one repo in `metadata.repos`.
2. Query for summary element text content.

**Expected result:** Text content is "Scanning 1 repository".

---

#### TC-116: Summary text — plural: "Scanning N repositories" for N > 1
**Hypothesis:** When `metadata.repos.length === 2`, summary is "Scanning 2 repositories".
When `metadata.repos.length === 12`, summary is "Scanning 12 repositories".
**Preconditions:** Same as TC-110.
**Level:** Automated unit (frontend.test.tsx)
**Automatable now:** Yes — test at N=2; optionally N=12 as a parameterized case.
**Status:** NOT YET WRITTEN

**Steps:**
1. Render with two repos in `metadata.repos`.
2. Query summary text.

**Expected result:** "Scanning 2 repositories".

---

### Frontend Unit — Expanded List Content

#### TC-117: Expanded list — each repo renders as a link with correct `href`
**Hypothesis:** When the `<details>` is open (or when testing the list content directly), each
`ScannedRepo` entry renders as an `<a>` whose `href` is `ScannedRepo.repoUrl` and whose text
content is `ScannedRepo.repo` (`owner/repo` format).
**Preconditions:** Same as TC-110.
**Level:** Automated unit (frontend.test.tsx)
**Automatable now:** Yes — query by link text; assert `href`.
**Status:** NOT YET WRITTEN

**Steps:**
1. Render with `metadata.repos = [{ repo: "anthropics/skills", repoUrl: "https://github.com/anthropics/skills", skillCount: 3, status: "succeeded" }]`.
2. Query the link with text "anthropics/skills".
3. Assert `href`, `target`, `rel`.

**Expected result:** Link present; `href === "https://github.com/anthropics/skills"`;
`target === "_blank"`; `rel === "noopener noreferrer"`.

---

#### TC-118: Expanded list — repo list is a `<ul>` of `<li>` elements
**Hypothesis:** The repo list inside the expanded `<details>` panel is a semantic `<ul>` / `<li>`
structure, consistent with the skill card list convention (§8c and §2c).
**Preconditions:** Same as TC-110.
**Level:** Automated unit (frontend.test.tsx)
**Automatable now:** Yes — query `<ul>` inside `<details>`.
**Status:** NOT YET WRITTEN

**Steps:**
1. Render with two repos.
2. Query `details > ul` (or equivalent selector).
3. Assert `li` count.

**Expected result:** `<ul>` present; two `<li>` children.

---

#### TC-119: Failed repo — "scan failed" tag is present for `status: "failed"` entries
**Hypothesis:** A repo with `status: "failed"` renders with a `<span>` (or equivalent inline
element) containing the text "scan failed" immediately after the repo link, within the same list
item.
**Preconditions:** Same as TC-110.
**Level:** Automated unit (frontend.test.tsx)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN

**Steps:**
1. Render with `metadata.repos` containing one failed repo:
   `{ repo: "someorg/broken-repo", repoUrl: "...", skillCount: 0, status: "failed" }`.
2. Query the list item for text "scan failed".

**Expected result:** "scan failed" text present in the DOM within the same list item as the repo
link. The tag is a `<span>` (not a heading, not a button, not an `<em>`).

---

#### TC-120: Succeeded repo — no "scan failed" tag for `status: "succeeded"` with skills
**Hypothesis:** A repo that succeeded with N > 0 skills does NOT render a "scan failed" tag.
The tag must be absent from its list item.
**Preconditions:** Same as TC-110.
**Level:** Automated unit (frontend.test.tsx)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN

**Steps:**
1. Render with one succeeded repo having `skillCount: 3`.
2. Assert "scan failed" text count in the DOM is 0.

**Expected result:** "scan failed" absent from DOM.

---

#### TC-121: Zero-skill succeeded repo — no "scan failed" tag
**Hypothesis:** A repo with `status: "succeeded"` and `skillCount: 0` does NOT render a "scan
failed" tag. Zero skills after a successful scan is not an error condition (§8e).
This is the most likely confusion-point for implementers — explicitly test it.
**Preconditions:** Same as TC-110.
**Level:** Automated unit (frontend.test.tsx)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN

**Steps:**
1. Render with `metadata.repos = [{ repo: "someorg/empty-repo", skillCount: 0, status: "succeeded" }]`.
2. Assert "scan failed" text count in DOM is 0.

**Expected result:** "scan failed" absent. The repo appears in the list identically to a repo that
has skills.

---

#### TC-122: Mixed-status list — correct tags appear on correct items only
**Hypothesis:** When the list contains multiple repos with different statuses, only the failed ones
show "scan failed"; succeeded repos (with or without skills) show no tag. No cross-contamination
between list items.
**Preconditions:** Same as TC-110.
**Level:** Automated unit (frontend.test.tsx)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN

**Steps:**
1. Render with three repos:
   - `{ repo: "a/succeeded-with-skills", skillCount: 2, status: "succeeded" }`
   - `{ repo: "b/succeeded-no-skills", skillCount: 0, status: "succeeded" }`
   - `{ repo: "c/failed", skillCount: 0, status: "failed" }`
2. Count "scan failed" occurrences in the DOM.
3. Assert the "scan failed" tag is in the list item for `c/failed` and nowhere else.

**Expected result:** Exactly one "scan failed" tag in the DOM; it is in the list item whose link
text is "c/failed".

---

### Frontend Unit — Empty Catalog + Repos Present

#### TC-123: Empty catalog with repos present — indicator renders alongside empty state message
**Hypothesis:** When `status === "ready"`, `skills.length === 0`, and `metadata.repos` has entries,
both the "No skills found yet." message AND the `ScannedReposIndicator` are visible. The indicator
does not suppress itself just because the skill catalog is empty.
This is the most important UX correctness case: a zero-skill catalog with the indicator hidden is
worse than useless — it removes the one signal that helps the user understand the scope of the scan.
**Preconditions:** Same as TC-110.
**Level:** Automated unit (frontend.test.tsx)
**Automatable now:** Yes — render App (or the relevant App subcomponent) with empty skills and
non-empty repos.
**Status:** NOT YET WRITTEN

**Steps:**
1. Render with `status = "ready"`, `skills = []`, `metadata.repos` = 2 entries.
2. Assert "No skills found yet." text is present.
3. Assert the `<details>` indicator is also present.
4. Assert summary text is "Scanning 2 repositories".

**Expected result:** Both empty state message and repos indicator are visible simultaneously.

---

### Frontend Unit — `<details>` Element Structure

#### TC-124: `<details>` element has `aria-label="Scanned repositories"`
**Hypothesis:** The `<details>` element carries `aria-label="Scanned repositories"` so screen
readers announce the widget by a meaningful name, not just the summary text repeated.
**Preconditions:** Same as TC-110.
**Level:** Automated unit (frontend.test.tsx — code inspection or DOM query)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN

**Steps:**
1. Render with at least one repo.
2. Query the `<details>` element.
3. Assert `aria-label === "Scanned repositories"`.

**Expected result:** `aria-label` attribute present with the correct value.

---

#### TC-125: `<details>` is closed by default (no `open` attribute)
**Hypothesis:** The indicator renders in the collapsed state on initial mount. The `open` attribute
is absent from the `<details>` element. Collapsed is the default; the user opts in to expanding.
**Preconditions:** Same as TC-110.
**Level:** Automated unit (frontend.test.tsx)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN

**Steps:**
1. Render with repos present.
2. Query the `<details>` element.
3. Assert `open` attribute is absent (or `element.open === false`).

**Expected result:** `<details>` is closed; repo links are not visible until user activates the
summary.

---

### Accessibility Cases — SR-1

#### TC-130: `<details>`/`<summary>` keyboard activation — Enter opens/closes
**Hypothesis:** The `<summary>` element responds to the Enter key to toggle the `<details>` open
state. This is native browser behavior for `<details>`/`<summary>` and requires no custom
`onKeyDown` handler.
**Preconditions:** Real browser or Playwright test with keyboard interaction.
**Level:** e2e (Playwright) or manual browser verification
**Automatable now:** Yes, via Playwright once the e2e suite is extended (TD-003 path).
**Status:** NOT YET WRITTEN

**Steps:**
1. Load the app with populated `metadata.repos`.
2. Tab to the `<summary>` element (Shift+Tab from the search input, since summary precedes it).
3. Press Enter.
4. Assert the repo list is now visible.
5. Press Enter again.
6. Assert the repo list is collapsed.

**Expected result:** Enter toggles the disclosure widget. No JavaScript required beyond what
`<details>` provides natively.

---

#### TC-131: `<details>`/`<summary>` keyboard activation — Space opens/closes
**Hypothesis:** The `<summary>` element also responds to Space to toggle, consistent with standard
button-like disclosure semantics.
**Preconditions:** Same as TC-130.
**Level:** e2e (Playwright) or manual
**Automatable now:** Yes, via Playwright.
**Status:** NOT YET WRITTEN

**Steps:**
1. Tab to the `<summary>` element.
2. Press Space.
3. Assert expansion.

**Expected result:** Space toggles the disclosure widget.

---

#### TC-132: Tab order — `<summary>` precedes search input; repo links fall between them when open
**Hypothesis:** With the `<details>` collapsed, tab order is: `<summary>` → search input → first
skill card link → ... (§8i). With `<details>` open, tab order is: `<summary>` → repo link 1 →
repo link 2 → ... → repo link N → search input. This is native DOM order and requires no
manipulation.
**Preconditions:** Real browser; autofocus on search is bypassed for this test (test starting tab
from the summary explicitly).
**Level:** Manual (real browser)
**Automatable now:** Partially — Playwright can assert focus order.
**Status:** NOT YET WRITTEN

**Steps:**
1. Load the app. Tab backward (Shift+Tab) from the search input.
2. Assert focus lands on the `<summary>` element.
3. Open the `<details>`. Tab forward from `<summary>`.
4. Assert focus moves to the first repo link.

**Expected result:** Document order matches spec §8i. No elements are skipped; no trap.

---

#### TC-133: Autofocus on search input not broken by indicator presence
**Hypothesis:** Adding the `ScannedReposIndicator` to the DOM (above the search input in the
`<header>`) does not displace or cancel the `autoFocus` on the search input. On page load, focus
still lands on the search input.
**Preconditions:** Real browser.
**Level:** Manual (real browser) — jsdom does not implement focus
**Automatable now:** Yes, via Playwright (the existing e2e autofocus test in catalog.spec.ts can
be extended or re-run against the updated build).
**Status:** NOT YET WRITTEN

**Steps:**
1. Load the app with a populated `metadata.repos`.
2. Do not interact with the page.
3. Assert that the search input has focus (`document.activeElement === searchInput`).

**Expected result:** Search input is focused on page load; the presence of the `<summary>` above it
in the DOM does not steal focus.

---

#### TC-134: `aria-live` region for copy feedback not polluted by indicator
**Hypothesis:** The single `aria-live="polite"` region used by `CopyButton` is unchanged by the
SR-1 implementation. The `ScannedReposIndicator` does not write to it, create a second live region,
or alter the existing region's attributes.
**Preconditions:** SR-1 component implemented.
**Level:** Automated unit (code inspection of App.tsx + ScannedReposIndicator.tsx)
**Automatable now:** Yes — query `[aria-live]` elements; assert count remains 1.
**Status:** NOT YET WRITTEN

**Steps:**
1. Render App with repos present.
2. Query all elements with `aria-live` attribute.
3. Assert count is 1 (the existing copy-feedback region).

**Expected result:** Exactly one `aria-live` region in the DOM. `ScannedReposIndicator` adds none.

---

### e2e Cases — SR-1

#### TC-135: e2e fixture prerequisite — `metadata.repos` array added to `tests/e2e/fixtures/skills.json`
**Hypothesis:** This is not a runnable test case — it is a required setup step. The e2e fixture
must be updated by the Lead before TC-136 and TC-137 can run.
**Preconditions:** N/A — this is a prerequisite tracking item.
**Level:** Setup (fixture update by Lead Developer)
**Automatable now:** N/A
**Status:** BLOCKED — fixture update required

**Required fixture shape:** The `metadata` object in `tests/e2e/fixtures/skills.json` must include:
```json
"repos": [
  { "repo": "anthropics/skills", "repoUrl": "https://github.com/anthropics/skills", "skillCount": 2, "status": "succeeded" },
  { "repo": "someorg/empty-repo", "repoUrl": "https://github.com/someorg/empty-repo", "skillCount": 0, "status": "succeeded" },
  { "repo": "someorg/broken-repo", "repoUrl": "https://github.com/someorg/broken-repo", "skillCount": 0, "status": "failed" }
]
```
This gives the e2e suite one succeeded-with-skills repo (matches the existing 2-skill fixture),
one zero-skill succeeded repo, and one failed repo — covering all meaningful display branches.
The `repoCount`, `reposSucceeded`, and `reposFailed` values in `metadata` must be updated to
match: `repoCount: 3`, `reposSucceeded: 2`, `reposFailed: 1`.

---

#### TC-136: e2e — repos indicator visible and shows correct count
**Hypothesis:** After fixture update (TC-135), the app loaded in a real browser shows the
`ScannedReposIndicator` in the header area. The collapsed summary text reflects the correct count
from the fixture (3 repos).
**Preconditions:** TC-135 complete; Playwright suite runnable (`npm run preview` or equivalent).
**Level:** e2e (Playwright — extend `tests/e2e/catalog.spec.ts`)
**Automatable now:** Yes, once TC-135 is done.
**Status:** NOT YET WRITTEN

**Steps:**
1. Navigate to the app (`/github-skill-scanner/`).
2. Assert the `<details>` element with `aria-label="Scanned repositories"` is visible.
3. Assert the `<summary>` text content is "Scanning 3 repositories".
4. Assert the `<details>` is closed (repo links not visible).

**Expected result:** Indicator present, summary correct, closed by default.

---

#### TC-137: e2e — expand reveals repo list; failed repo shows "scan failed" tag
**Hypothesis:** Activating the `<summary>` reveals the repo list. The "someorg/broken-repo" entry
shows the "scan failed" tag. The "someorg/empty-repo" entry (zero skills, succeeded) shows no tag.
Each link navigates to the correct `repoUrl`.
**Preconditions:** TC-135 and TC-136 pass.
**Level:** e2e (Playwright)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN

**Steps:**
1. Navigate to the app.
2. Click (or keyboard-activate) the `<summary>`.
3. Assert the `<ul>` inside `<details>` is now visible.
4. Assert a link with text "anthropics/skills" and `href` "https://github.com/anthropics/skills" is present.
5. Assert a link with text "someorg/broken-repo" is present, and "scan failed" text appears in the same list item.
6. Assert a link with text "someorg/empty-repo" is present, and no "scan failed" text appears in that list item.
7. Assert total link count inside the list is 3.

**Expected result:** All three repos displayed; only the failed one has the "scan failed" tag;
links are correct.

---

#### TC-138: e2e — existing autofocus test still passes with indicator present
**Hypothesis:** The existing catalog.spec.ts test that asserts `search` is focused on load
(`await expect(search).toBeFocused()`) continues to pass after the `ScannedReposIndicator` is
added above the search input in the DOM.
**Preconditions:** SR-1 implementation complete; existing e2e suite runnable.
**Level:** e2e (Playwright — re-run existing test, do not modify it)
**Automatable now:** Yes — this is a regression check on an existing test.
**Status:** NOT YET WRITTEN

**Steps:**
1. Run the full e2e suite including the existing "client-side search" test.
2. Confirm `await expect(search).toBeFocused()` still passes.

**Expected result:** The existing autofocus assertion passes unchanged. If it fails, it is a
regression introduced by SR-1 and must be investigated before shipping.

---

#### TC-139: e2e — copy command string unchanged (ends with `-a github-copilot -y`)
**Hypothesis:** The copy command string verified in the existing e2e copy test
(`npx skills add https://github.com/anthropics/skills --skill frontend-design -a github-copilot -y`)
is not affected by the SR-1 change. The copy functionality is independent of the repos indicator.
**Preconditions:** Same as TC-138.
**Level:** e2e (Playwright — re-run existing copy test)
**Automatable now:** Yes — regression check.
**Status:** NOT YET WRITTEN

**Steps:**
1. Run the existing `copy button writes the command` e2e test.

**Expected result:** Passes unchanged. The clipboard string is the same command verified in the
original test pass.

---

### Regression Cases — SR-1

#### TC-140: Existing unit test suite passes after SR-1 changes
**Hypothesis:** After the scanner and frontend changes for SR-1 (type additions, writer update,
new component, App.tsx changes), `npm run test` still reports all previously-passing tests as
passing. No existing test is broken by the changes.
**Preconditions:** SR-1 implementation complete.
**Level:** Automated (Vitest — `npm run test`)
**Automatable now:** Yes — this is the standard regression gate.
**Status:** NOT YET WRITTEN

**Steps:**
1. Run `npm run test`.
2. Confirm all tests that passed in the original build (TC-001 through TC-046) still pass.

**Expected result:** Zero regressions in the existing suite.

---

#### TC-141: TypeScript typecheck passes after SR-1 type additions
**Hypothesis:** Adding `ScannedRepo` and updating `SkillsMetadata` in `src/types/skills.ts`
does not break existing type usage in the scanner or frontend.
**Preconditions:** Type changes applied.
**Level:** Automated (tsc — `npm run typecheck`)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN

**Steps:**
1. Run `npm run typecheck`.

**Expected result:** Zero errors.

---

#### TC-142: Skill cards, search, and copy unaffected by indicator presence (unit regression)
**Hypothesis:** The SR-1 implementation touches `App.tsx` (to pass `metadata.repos` to the new
component) and adds a new component. Existing SkillCard, SkillList, and search filter unit tests
(TC-030 through TC-046) must continue to pass without modification.
**Preconditions:** SR-1 implementation complete.
**Level:** Automated unit (Vitest)
**Automatable now:** Yes — run existing suite.
**Status:** NOT YET WRITTEN

**Steps:**
1. Run `npm run test -- --reporter=verbose`.
2. Filter output to the frontend.test.tsx results.
3. Confirm TC-030 through TC-046 pass.

**Expected result:** All 17 existing frontend unit tests pass.

---

#### TC-143: "Last scanned" timestamp line still renders after SR-1 (not displaced)
**Hypothesis:** The indicator is placed below the "Last scanned" line in the header (§8a). Adding
the indicator must not remove, relocate, or suppress the timestamp display.
**Preconditions:** SR-1 implementation complete; app running in browser or Playwright.
**Level:** e2e or manual
**Automatable now:** Yes, via Playwright — extend the existing render test.
**Status:** NOT YET WRITTEN

**Steps:**
1. Load the app with a `metadata.lastScanned` value in the fixture.
2. Assert the "Last scanned:" text is visible.
3. Assert the `<details>` indicator is also visible below it.

**Expected result:** Both the timestamp and the indicator are present in the header simultaneously.

---

#### TC-144: No horizontal scrollbar introduced at 320px viewport width
**Hypothesis:** The indicator, including its summary text and expanded list, does not cause
a horizontal scrollbar at 320px width — the minimum viewport specified in requirements-scanned-repos.md
must-have #1.
**Preconditions:** Real browser or Playwright with viewport override.
**Level:** Manual or e2e (Playwright — set viewport to 320px, check `document.body.scrollWidth`)
**Automatable now:** Partially — Playwright can set viewport and measure scroll width.
**Status:** NOT YET WRITTEN

**Steps:**
1. Open the app at 320px viewport width.
2. Expand the `<details>` to show the full repo list.
3. Assert `document.body.scrollWidth <= window.innerWidth` (no horizontal overflow).

**Expected result:** No horizontal scrollbar at 320px with the indicator in either state.

---

## SR-1 Must-Have Coverage

| SR-1 Must-Have / AC | TC(s) | Level | Automatable |
|---------------------|-------|-------|-------------|
| Indicator appears in header area | TC-114, TC-136 | Unit + e2e | Yes |
| Hidden in loading / error / no-repos states | TC-110, TC-111, TC-112, TC-113 | Unit | Yes |
| Collapsed by default, one summary line | TC-125, TC-136 | Unit + e2e | Yes |
| Singular/plural summary text | TC-115, TC-116 | Unit | Yes |
| Full list on expand; repo links correct | TC-117, TC-118, TC-137 | Unit + e2e | Yes |
| Failed repo "scan failed" tag | TC-119, TC-137 | Unit + e2e | Yes |
| Zero-skill succeeded repo — no tag | TC-121, TC-137 | Unit + e2e | Yes |
| `metadata.repos` always-array in scanner output | TC-100 | Unit | Yes |
| Repo succeeded with skills | TC-101 | Unit | Yes |
| Repo succeeded with zero skills | TC-102 | Unit | Yes |
| Repo failed → `skillCount: 0` | TC-103 | Unit | Yes |
| `repos` sorted by `repo` ascending | TC-104 | Unit | Yes |
| All four ADR-002 addendum invariants | TC-105, TC-106, TC-107, TC-108 | Unit | Yes |
| Keyboard operable (Enter/Space) | TC-130, TC-131 | e2e / manual | Playwright |
| `aria-label="Scanned repositories"` on `<details>` | TC-124 | Unit | Yes |
| Autofocus on search not broken | TC-133, TC-138 | Manual + e2e | Playwright |
| `aria-live` region unchanged (one, not two) | TC-134 | Unit | Yes |
| No horizontal scrollbar at 320px | TC-144 | Manual / e2e | Playwright |
| Empty catalog + repos → both visible | TC-123 | Unit | Yes |

---

## SR-1 Regression Scope Summary

The following existing test areas are at risk from SR-1 changes and must be confirmed green before
shipping:

| Area | Risk | Tests to re-run |
|------|------|-----------------|
| `writeCatalog` signature change (new `repos` param) | Medium — callers in `src/scan/index.ts` must be updated; existing writer tests exercise the old signature | TC-023 through TC-026 (existing); TC-001 (full suite) |
| `SkillsMetadata` type change | Medium — any code that destructures or spreads `metadata` may fail typecheck | TC-109, TC-141 |
| `App.tsx` rendering changes | Medium — passing `metadata.repos` to the new component changes App's render logic; existing App-level behavior (5 states, search, copy) must be unchanged | TC-042 through TC-046, TC-140, TC-142 |
| e2e fixture lacks `metadata.repos` | High — all new e2e assertions require the fixture update; existing e2e tests may also be affected if the frontend now expects `repos` in `metadata` defensively | TC-135 (prerequisite), TC-138, TC-139 |
| Autofocus on search input | Low — adding a focusable `<summary>` above the search input in DOM order does not displace autofocus, but it is a real interaction concern | TC-133, TC-138 |
| Copy command string | Low — SR-1 is purely additive and does not touch `buildInstallCommand`; included as a sanity check | TC-139 |

**Key fixture note (repeated for clarity):** `tests/e2e/fixtures/skills.json` must have
`metadata.repos` added before any e2e SR-1 test can run. The Lead must also confirm that the
existing e2e tests that read `catalog.skills.length` and assert card counts still pass after the
fixture `metadata` object is extended — the `skills` array itself is unchanged, but the `metadata`
shape changes, and any e2e assertion that reads `metadata` directly (such as the base-path fetch
test asserting `Array.isArray(catalog.skills)`) must be re-confirmed.

---

# UI Dark Restyle (UI-1)

**Feature:** Dark Developer UI Restyle
**Author:** Remy Dubois (QA Engineer)
**Date:** 2026-06-05
**Status:** PRE-IMPLEMENTATION — test cases authored before build begins
**Source documents:** requirements-ui-styling.md; user-flows.md Section 9; existing test suite
(90 unit tests in 5 files, 9 e2e tests in catalog.spec.ts)

---

## UI-1 Scope

### What this section tests

Regression protection for all existing DOM contracts that a CSS restyle could accidentally break,
plus new verification cases for the dark-developer palette: computed-style smoke checks automatable
in e2e, contrast verification via tool-assisted manual review, visual rendering of all five states,
focus-ring visibility on dark backgrounds, and the 320px no-scroll guarantee.

### What this section does NOT test

- Any interaction behavior change (none is in scope — this is CSS-only)
- Light-mode or `prefers-color-scheme` switching (single dark theme only per requirements)
- Animation or transition effects (not required for v1 per requirements-ui-styling.md)
- Screen reader announcement of colors (contrast is a visual/tool concern, not an AT concern)
- Cross-browser rendering pixel differences between Chrome and Firefox (both must pass the
  contrast gate and the computed-style assertions; visual fidelity differences are acceptable)

### What constitutes a regression for this feature

The pass bar for regression is strict and simple: `npm run test` reports 90/90 passing and
`npx playwright test` reports 9/9 passing, with zero changes to any test file. A restyle that
requires editing an existing test selector or text assertion to make it pass is a contract
break, not a test fix.

### The `.repo-scan-failed` color value this plan tests against

The new value is `#848d97` (`var(--tag-scan-failed)` per user-flows.md Section 9c). The old
value is `#999` (approximately `rgb(153, 153, 153)`). Tests assert the new value is applied
and the old value is absent. Contrast: `#848d97` on `--surface` (`#161b22`) = 5.11:1 (PASS,
AA 4.5:1 threshold). `#848d97` on `--bg` (`#0d1117`) = 5.67:1 (PASS).

---

## UI-1 Test Cases

TC numbers begin at 150. Regression cases are 150–159, new automated visual/computed-style
cases are 160–164, contrast verification cases are 170–176 (manual/tool-assisted), visual
state cases are 180–184 (manual), focus-ring cases are 190–194 (manual/keyboard).

---

### Regression — Existing Suite Must Pass Unchanged

#### TC-150: Full unit suite (90 tests) passes after CSS-only restyle
**Hypothesis:** The restyle touches only `index.css` (and optionally a new `tokens.css`). No TSX
file is modified unless a single class name addition is required (and only with Lead coordination).
Since the 90 unit tests run in jsdom and do not evaluate CSS, they are inherently CSS-agnostic —
but any accidental TSX edit or selector rename would break them.
**Preconditions:** Restyle implementation complete; no TSX changes except a documented class-name
addition if one was required and coordinated with the Lead.
**Level:** Automated (Vitest — `npm run test`)
**Automatable now:** Yes — this is the primary regression gate.
**Status:** NOT YET WRITTEN (pending implementation)

**Steps:**
1. Run `npm run test`.
2. Assert exit code 0 and "90 passed (90)" in output.

**Expected result:** 90/90 tests pass. Zero failures. No test modified to accommodate the restyle.
**Pass criterion:** The suite is green with zero changes to any file under `tests/`.

**DOM-contract assertions this protects (what a careless restyle could break):**

The following selectors and text strings are used verbatim in the unit and e2e suites. Any
rename, removal, or structural change to these would cause test failures that must be treated
as regressions, not test updates:

| Contract | Selector / value | Test(s) that depend on it |
|----------|-----------------|--------------------------|
| CSS class | `ul.skill-list > li` | e2e: card count assertion (2 cards) |
| CSS class | `span.repo-scan-failed` | e2e TC-137 locator; unit TC-119, TC-122 |
| CSS class | `details[aria-label='Scanned repositories']` | e2e TC-136, TC-137, TC-144; unit TC-114, TC-124 |
| CSS class | `details ul` | unit TC-118: `container.querySelector("details ul")` |
| Element type | `<code>` | unit: `codeElement.tagName === "CODE"` (TC-041 area) |
| Element type | `<h1>` | e2e: `getByRole("heading", { level: 1, name: "GitHub Skill Scanner" })` |
| Element type | `<h2>` | e2e: `getByRole("heading", { level: 2 })` for card names |
| ARIA attribute | `aria-label="Scanned repositories"` on `<details>` | e2e TC-136, TC-137, TC-144; unit TC-114, TC-124 |
| ARIA attribute | `role="alert"` on error container | user-flows.md a11y contract; styling must not hide it |
| Role | `role="searchbox"` from `<input type="search">` | e2e: `page.getByRole("searchbox")` |
| Visible text | `"Copy"` | e2e: `toHaveText("Copy")` |
| Visible text | `"Copied!"` | e2e: `toHaveText("Copied!")` |
| Visible text | `"Scanning N repositories"` | unit TC-115, TC-116; e2e TC-136 |
| Visible text | `"scan failed"` | unit TC-119, TC-122; e2e TC-137 |
| Visible text | exact install command string including `-a github-copilot -y` | e2e: `toBeVisible()` + clipboard assertion |
| Visible text | `"No skills found yet."` | e2e and unit |
| Visible text | `/No skills match/` | e2e and unit |
| Visible text | `"GitHub Skill Scanner"` (h1) | e2e |
| Class | `.sr-only` | must not be altered — it is accessibility infrastructure |
| Class | `.visually-hidden` | must not be altered — it is accessibility infrastructure |

The specific failure modes a restyle can trigger:
- Renaming `.skill-card` breaks `container.querySelectorAll("p")` scoped to that class.
- Altering `.sr-only` rules (e.g., removing `position: absolute` or adding `display: none`)
  would visually hide accessible labels that the test suite verifies are present.
- Adding `display: none` or `visibility: hidden` to `.state-message` or the `[role="alert"]`
  container would suppress the error state announcement and fail user-flows.md a11y contracts.
- Changing `<code>` to a `<span>` via TSX edit would break the `tagName === "CODE"` assertion.
- Any CSS rule that sets `content` on a pseudo-element of a heading or button will not affect
  `textContent` (used by Playwright `toHaveText`) but could affect visual text — manual
  verification of the `::before` terminal prompt (if implemented) is included in TC-163.

---

#### TC-151: Full e2e suite (9 tests) passes after CSS-only restyle
**Hypothesis:** All 9 Playwright tests in `tests/e2e/catalog.spec.ts` pass unchanged. The
restyle must not alter any selector, accessible name, or text string that Playwright uses to
locate elements or assert content.
**Preconditions:** Restyle implementation complete; `npx playwright test` runnable against
`npm run preview`.
**Level:** e2e (Playwright — `npx playwright test`)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN (pending implementation)

**Steps:**
1. Build: `npm run build`.
2. Start preview server: `npm run preview` (or equivalent).
3. Run: `npx playwright test`.
4. Assert 9/9 pass.

**Expected result:** All 9 e2e tests pass. Zero failures. No test file modified.
**Pass criterion:** Green suite with zero changes to `tests/e2e/catalog.spec.ts`.

---

#### TC-152: TypeScript typecheck passes after CSS changes
**Hypothesis:** The restyle is CSS-only. `npm run typecheck` must exit 0 after the restyle.
If a one-line class addition was made to a TSX file (per the requirements assumption), that
one change must not introduce TypeScript errors.
**Preconditions:** Restyle implementation complete.
**Level:** Automated (tsc — `npm run typecheck`)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN (pending implementation)

**Steps:**
1. Run `npm run typecheck`.

**Expected result:** Zero TypeScript errors.

---

#### TC-153: Production build succeeds and CSS artifact is present
**Hypothesis:** `npm run build` succeeds and `dist/assets/` contains a `.css` file. The build
size of the CSS artifact may increase modestly (tokens block + new rules); this is acceptable
and is not a failure criterion. The test confirms the build pipeline is not broken by the CSS
changes.
**Preconditions:** Restyle implementation complete.
**Level:** Automated (build script)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN (pending implementation)

**Steps:**
1. Run `npm run build`.
2. Assert exit code 0.
3. Assert at least one `.css` file exists under `dist/assets/`.

**Expected result:** Build succeeds; CSS artifact present. `dist/data/skills.json` is also
present (the existing ADR-003 guard — confirm this still holds).

---

#### TC-154: No raw hex values remain in `index.css` after restyle
**Hypothesis:** The requirements state explicitly that all inline hex values must be replaced by
CSS custom properties. A post-restyle grep for bare hex values (`#` followed by 3 or 6 hex
digits) outside comment lines is a sufficient conformance check for the token migration.
This is an implementation-correctness check, not a DOM-contract regression check — but it
is automated and fast, so it belongs in the regression suite.
**Preconditions:** Restyle implementation complete.
**Level:** Automated (grep — shell check)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN (pending implementation)

**Steps:**
1. Run: `grep -v '^\s*/\*' src/fe/index.css | grep -E '#[0-9a-fA-F]{3,6}\b'`
   (or equivalent: search for hex color patterns, excluding comment lines).
2. Assert zero matches.

**Expected result:** Zero lines with bare hex values outside comments. If a `tokens.css` file
was split out, run the same check on that file (it should contain only the `:root {}` block
with tokens, and the hex values there are intentional — but they should be only in that block,
nowhere else in the stylesheet).
**Note for Lead:** The grep must exclude the `:root {}` token block if it lives in the same
file. The intent is to confirm no hex values exist outside the token declarations. The exact
grep pattern should be confirmed with the Lead at implementation time.

---

#### TC-155: `.sr-only` and `.visually-hidden` rules are bitwise unchanged
**Hypothesis:** The requirements call out that these two classes must not be altered. A direct
diff of the two rules before and after the restyle is the verification method.
**Preconditions:** Baseline `index.css` committed before restyle begins; restyle implementation
complete.
**Level:** Automated (git diff — shell check)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN (pending implementation)

**Steps:**
1. Run: `git diff HEAD~1 -- src/fe/index.css | grep -A 10 '\.sr-only\|\.visually-hidden'`
   (or equivalent: diff the before/after CSS for these two selectors).
2. Assert no changes to either rule's property declarations.

**Expected result:** Both rules are identical before and after the restyle. Any change to
`.sr-only` or `.visually-hidden` is a hard failure and must be reverted before shipping.

---

### New Automated Cases — Computed-Style Smoke Checks

These cases are the 2 new e2e computed-style assertions I recommend adding to `catalog.spec.ts`.
They are cheap to write, provide permanent regression protection against the dark theme being
accidentally reverted or overridden, and catch the two highest-risk color regressions identified
in the requirements: (a) body still white, (b) `.repo-scan-failed` reverts to old `#999` gray.

**Recommendation:** Add both TC-160 and TC-161 to `catalog.spec.ts` as new Playwright tests.
They require no new dependencies — `page.evaluate` with `getComputedStyle` is standard Playwright.
They are fast (no interaction, just DOM inspection) and will not flake.

---

#### TC-160: e2e computed-style — `body` background is the dark `--bg` color
**Hypothesis:** After the restyle, `getComputedStyle(document.body).backgroundColor` (or
`getComputedStyle(document.documentElement).backgroundColor`) returns the RGB equivalent of
`--bg` (`#0d1117` = `rgb(13, 17, 23)`). This confirms the full-viewport dark background is
applied and has not been overridden by a browser default or a more specific rule.
**Preconditions:** Restyle implementation complete; e2e suite runnable.
**Level:** e2e (Playwright — new test in `tests/e2e/catalog.spec.ts`)
**Automatable now:** Yes — recommend adding immediately.
**Status:** NOT YET WRITTEN (pending implementation)

**Steps:**
1. Navigate to the app.
2. Evaluate: `getComputedStyle(document.body).backgroundColor`.
3. Assert result equals `"rgb(13, 17, 23)"`.

**Expected result:** `rgb(13, 17, 23)`. Any other value (especially `rgba(0, 0, 0, 0)` or
`rgb(255, 255, 255)`) is a failure indicating the body background was not set or was overridden.
**Why this matters:** The requirements note that the current stylesheet does not style `body` at
all — the page background is browser-default white. This test is the permanent regression guard
that the fix was applied and stays applied.

---

#### TC-161: e2e computed-style — `span.repo-scan-failed` color is NOT the old `#999`
**Hypothesis:** After the restyle, `getComputedStyle(span.repo-scan-failed).color` is not
`rgb(153, 153, 153)` (the old `#999` value that fails WCAG AA for small text). The test
asserts the absence of the old value rather than the presence of a specific new value, so
it remains valid if the exact token value is refined during implementation.
**Preconditions:** Restyle implementation complete; fixture includes a failed repo so
`span.repo-scan-failed` is present in the DOM (TC-135 prerequisite already met).
**Level:** e2e (Playwright — new test in `tests/e2e/catalog.spec.ts`)
**Automatable now:** Yes — recommend adding immediately.
**Status:** NOT YET WRITTEN (pending implementation)

**Steps:**
1. Navigate to the app.
2. Expand the scanned repos disclosure (click `<summary>`).
3. Locate `span.repo-scan-failed`.
4. Evaluate: `getComputedStyle(span).color`.
5. Assert result is NOT `"rgb(153, 153, 153)"`.
6. Assert result IS `"rgb(132, 141, 151)"` (the RGB equivalent of `#848d97`).

**Expected result:** Color is `rgb(132, 141, 151)`. The old value `rgb(153, 153, 153)` must not
appear.
**Note:** Step 6 asserts the positive value for tighter regression protection. If the UX designer
later adjusts the token, only this assertion needs updating — the "not `#999`" check in step 5
remains valid regardless.

---

#### TC-162: e2e computed-style — `.skill-card` background is the dark surface color
**Hypothesis:** `getComputedStyle(skillCard).backgroundColor` returns `rgb(22, 27, 34)` (the
RGB equivalent of `--surface` `#161b22`). This confirms the card surface token is applied
and that the old `#fafafa` light surface is gone.
**Preconditions:** Restyle implementation complete; populated state loaded (skill cards visible).
**Level:** e2e (Playwright — optional third smoke check)
**Automatable now:** Yes.
**Status:** NOT YET WRITTEN (pending implementation)

**Steps:**
1. Navigate to the app (populated state).
2. Locate the first `.skill-card` element.
3. Evaluate its `backgroundColor`.
4. Assert result equals `"rgb(22, 27, 34)"`.
5. Assert result does NOT equal `"rgb(250, 250, 250)"` (old `#fafafa`).

**Expected result:** `rgb(22, 27, 34)`. The old light card surface must not appear.
**Classification:** Recommended but lower priority than TC-160 and TC-161. Add if the Lead
is writing the computed-style tests anyway — marginal cost, additional regression signal.

---

#### TC-163: `::before` terminal prompt (if implemented) — does not affect `textContent`
**Hypothesis:** If the optional `code::before { content: "$ " }` is implemented per
user-flows.md Section 9g, the `$ ` prefix is a CSS pseudo-element and does not appear in
`element.textContent`. The existing e2e test that asserts the exact install command string
via `page.getByText(...)` must still pass — Playwright's `getByText` uses text content,
not rendered visual text.
**Preconditions:** `::before` terminal prompt implemented; e2e suite runnable.
**Level:** e2e regression check (re-run existing install command visibility test)
**Automatable now:** Yes — this is a re-run of the existing test, not a new one.
**Status:** NOT YET WRITTEN (applies only if `::before` is implemented)

**Steps:**
1. Confirm `::before` is present in the CSS.
2. Run the existing e2e test: `page.getByText("npx skills add ... -a github-copilot -y")`.
3. Assert it still passes.

**Expected result:** `getByText` locates the element by text content; `::before` content is
not in `textContent`; test passes unchanged.
**Note:** If this test fails, the `::before` implementation incorrectly used a real DOM text
node rather than a CSS pseudo-element. That is a test-contract regression and must be fixed
before shipping.

---

### Contrast Verification — Manual / Tool-Assisted

These cases are inherently manual. The ratios are pre-computed in user-flows.md Section 9c
and verified against the WCAG 2.1 relative luminance formula. QA's job is to confirm the
implementation matches the spec and spot-check with an external contrast tool.

**Verification method (applies to all TC-170 through TC-176):**

1. Build the app and load it in a browser.
2. Use the browser DevTools color picker (or a dedicated contrast tool such as the WebAIM
   Contrast Checker, Colour Contrast Analyser, or the axe DevTools browser extension) to
   sample the foreground and background colors as rendered.
3. Compare the measured ratio against the WCAG AA threshold for that pairing.
4. Accept if the measured ratio meets or exceeds the threshold. Fail if it falls below.

The ratios in the table below are taken directly from user-flows.md Section 9c. They are
the design spec's own stated values; QA verifies the implementation matches them. If the
implementation uses different hex values than the spec, the ratios must be re-computed —
use the WCAG relative luminance formula: `L = 0.2126*R + 0.7152*G + 0.0722*B` (where each
channel is linearized), then `ratio = (L_lighter + 0.05) / (L_darker + 0.05)`.

**Recommended tool:** axe DevTools (browser extension) for a full-page automated WCAG audit
as a first pass, then manual spot-check of the specific pairings below for confirmation. The
axe scan will catch failures the manual spot-check might miss, and the manual spot-check
confirms the pairings that automated tools sometimes misreport on dark surfaces.

---

#### TC-170: Contrast — primary body text (`--text`) on page background (`--bg`)
**Level:** Manual / tool-assisted
**Automatable now:** No (requires rendered colors; not unit-automatable without an a11y lib)

**Pairing:** `#c9d1d9` (text) on `#0d1117` (bg)
**Expected ratio per spec:** 11.57:1
**WCAG threshold:** 4.5:1 (AA normal text)
**Pass criterion:** Measured ratio >= 4.5:1. Spec value 11.57:1 provides substantial margin;
any result >= 4.5:1 is a pass. A result below 7:1 should be flagged as a concern even if it
technically passes (margin has eroded).

**Verification steps:**
1. Load the app in a browser (populated state, a skill card visible).
2. Sample the color of a card description paragraph (`<p>` text inside `.skill-card`).
3. Sample the background of the page body (`<main>` or `body`).
4. Compute or tool-check the ratio.

---

#### TC-171: Contrast — muted secondary text (`--text-muted`) on card surface (`--surface`)
**Level:** Manual / tool-assisted

**Pairing:** `#8b949e` (muted) on `#161b22` (surface)
**Expected ratio per spec:** 5.46:1
**WCAG threshold:** 4.5:1 (AA normal text)
**Pass criterion:** Measured ratio >= 4.5:1.
**Why this is the critical case:** This is the most likely failure point identified in the
requirements risk table. `--text-muted` is used for `.last-scanned`, `.scanned-repos summary`,
placeholder text, and disabled input text — all small text that must meet the 4.5:1 threshold.
A measurement below 4.5:1 here is a hard blocker.

**Verification steps:**
1. Sample the "Last scanned" timestamp text.
2. Sample the header background (which is `--bg` inherited from body, not `--surface`).
   Note: the "Last scanned" line is in the header, which sits on `--bg`, not `--surface`.
   The more conservative pairing to verify is `--text-muted` on `--surface` (the card context).
3. Also verify the `.scanned-repos summary` text (on `--bg`) — expected ratio 6.06:1.
4. Verify placeholder text in the disabled `input[type="search"]` (on `--surface`) — expected 5.46:1.

---

#### TC-172: Contrast — accent / link text (`--accent`) on card surface (`--surface`)
**Level:** Manual / tool-assisted

**Pairing:** `#58a6ff` (accent) on `#161b22` (surface)
**Expected ratio per spec:** 6.51:1
**WCAG threshold:** 4.5:1 (AA normal text)
**Pass criterion:** Measured ratio >= 4.5:1.

**Verification steps:**
1. Sample a repo link inside a skill card (`<a>` text, `--accent` on `--surface`).
2. Sample a repo link in the scanned-repos list (`<a>` text, `--accent` on `--bg`).
   Expected ratio for second pairing: 7.22:1.

---

#### TC-173: Contrast — code text (`--code-text`) on code background (`--code-bg`)
**Level:** Manual / tool-assisted

**Pairing:** `#a5d6ff` (code-text) on `#1c2128` (code-bg)
**Expected ratio per spec:** 9.56:1
**WCAG threshold:** 4.5:1 (AA normal text)
**Pass criterion:** Measured ratio >= 4.5:1.

**Verification steps:**
1. Sample the install command text inside the `<code>` element.
2. Sample the code block background.
3. Confirm the monospace font stack is applied (visual inspection — the font should appear
   as a system monospace font, not a sans-serif).

---

#### TC-174: Contrast — scan-failed tag (`--tag-scan-failed`) on card or page background
**Level:** Manual / tool-assisted

**Pairing 1:** `#848d97` on `#161b22` (--surface)
**Expected ratio per spec:** 5.11:1
**Pairing 2:** `#848d97` on `#0d1117` (--bg)
**Expected ratio per spec:** 5.67:1
**WCAG threshold:** 4.5:1 (AA normal text — small text applies here, `.repo-scan-failed` is
0.8rem per the typography table)
**Pass criterion:** Measured ratio >= 4.5:1 for both pairings.

**Verification steps:**
1. Expand the scanned repos disclosure.
2. Sample the "scan failed" tag text color.
3. Sample the background of the list item it sits on (this is `--bg` since the list is in
   the header, not inside a card).
4. Also verify it does not appear as an accent or warning color (visual check — must be
   visually secondary, clearly dimmer than primary text, not red/orange/cyan).

---

#### TC-175: Contrast — focus ring (`--focus-ring`) against adjacent surface
**Level:** Manual / tool-assisted

**Pairing 1 (search input on `--bg`):** `#58a6ff` focus ring against `#0d1117`
**Expected ratio per spec:** 7.22:1
**Pairing 2 (Copy button on `--surface`):** `#58a6ff` focus ring against `#161b22`
**Expected ratio per spec:** 6.51:1
**WCAG threshold:** 3:1 (WCAG 2.4.11 non-text contrast for focus indicators)
**Pass criterion:** Measured ratio >= 3:1 for both pairings. Both pairings substantially
exceed this threshold per the spec; a measurement below 5:1 should be flagged even if it
technically passes.

**Verification steps:**
1. Tab to the search input; observe the focus ring (must be a solid outline, not the browser
   default glow).
2. Sample the ring color against the page background.
3. Tab to a Copy button; observe the focus ring.
4. Sample the ring color against the card surface.
5. Tab to the `<summary>` element; observe its focus ring against the page background.
6. Tab to a repo link (when disclosure is open); observe focus ring against page background.

---

#### TC-176: axe DevTools full-page WCAG AA audit
**Hypothesis:** A full-page axe scan of the populated state returns zero WCAG AA violations.
This is a belt-and-suspenders check that catches pairings the manual spot-checks above might
miss (e.g., disabled input text, placeholder contrast, button border contrast).
**Level:** Manual / tool-assisted (browser extension)
**Automatable now:** Partially — axe-playwright could be added as a dependency to run this
in CI. Not recommended as a required gate for this feature (it would add a dependency), but
worth raising with the Lead as a future investment.

**Verification steps:**
1. Install the axe DevTools browser extension (or use the axe Playwright integration in an
   ad-hoc run).
2. Load the app in the populated state (skill cards visible, disclosure collapsed).
3. Run the axe scan.
4. Assert zero violations at WCAG AA level.
5. Repeat with the disclosure expanded (to check `.repo-scan-failed` and repo link colors).
6. Repeat with the error state visible (to check the `--danger` left-border and
   `div[role="alert"]` container styling).

**Expected result:** Zero WCAG AA violations across all tested states. If violations are
reported, triage: any contrast failure against an element in the DOM-contract registry is
a hard blocker; contrast failures on elements not visible in normal use can be deferred with
PM sign-off.

---

### Visual State Verification — Manual

All five states must render correctly in the dark palette. These cases require a running
browser and cannot be automated as unit tests. They can be covered by Playwright screenshots
for a visual regression baseline, but screenshot diffing is not part of the current test
infrastructure — these are recorded as manual for this pass.

---

#### TC-180: Visual — Loading state renders with dark palette; no white background
**Preconditions:** App served with network throttling or a delayed fetch mock to hold the
loading state visible.
**Level:** Manual (real browser)
**Automatable now:** Partially — Playwright can intercept the fetch to delay it.

**Steps:**
1. Open the app with the network request delayed (browser DevTools throttle, or Playwright
   `route` to delay the response).
2. Observe the page before the data arrives.

**Expected result:**
- Page background is dark (no white viewport visible).
- "Loading skills..." text is visible on the dark background.
- Search input is rendered but visually muted (disabled state — `--surface` background,
  `--text-muted` text color).
- No light-colored surfaces visible anywhere.

---

#### TC-181: Visual — Error state renders correctly; `role="alert"` container is visible
**Preconditions:** App served with the fetch configured to fail (network offline, or Playwright
`route` to abort the request).
**Level:** Manual (real browser)
**Automatable now:** Partially — Playwright can route requests to fail.

**Steps:**
1. Load the app with the fetch aborted.
2. Observe the error state.

**Expected result:**
- "Could not load the skill catalog." heading visible on dark card surface.
- Error container (`.state-message` with `role="alert"`) has dark background — no white or
  near-white background visible.
- Left-border accent (`--danger` `#f85149`) is visible as a 3px left-side accent on the
  error container.
- CSS does not suppress the `[role="alert"]` container with `display:none`, `visibility:hidden`,
  or `opacity: 0` — the container is visibly rendered.

---

#### TC-182: Visual — Empty state renders correctly (zero skills, repos indicator visible)
**Preconditions:** Fixture temporarily modified to return `skills: []` with `metadata.repos`
present.
**Level:** Manual (real browser)
**Automatable now:** Partially — Playwright can serve a modified fixture.

**Steps:**
1. Load the app with an empty skills array but valid `metadata.repos`.
2. Observe the empty state.

**Expected result:**
- "No skills found yet." heading visible on dark card surface.
- `.state-message` container has dark background.
- ScannedReposIndicator is visible (both indicator and empty-state message appear simultaneously,
  per TC-123 unit coverage and the §8g spec).
- Search input is disabled and visually muted.
- No white background patches visible.

---

#### TC-183: Visual — No-results state renders correctly
**Preconditions:** Populated app with a search query that matches nothing.
**Level:** Manual (real browser)
**Automatable now:** Yes, via Playwright (the search filter e2e test already covers this path
functionally; add a computed-style spot-check if desired).

**Steps:**
1. Load the app in the populated state.
2. Type a query that matches nothing (e.g., "zzz-no-match").
3. Observe the no-results state.

**Expected result:**
- "No skills match 'zzz-no-match'." visible on dark card surface.
- `.state-message` container has dark background.
- Search input remains active (not disabled) and styled for the dark palette.

---

#### TC-184: Visual — Populated state renders correctly; all card elements use dark palette
**Preconditions:** Populated app (fixture with skill cards).
**Level:** Manual (real browser)
**Automatable now:** Partially — TC-160 / TC-162 cover computed-style spot-checks; visual
completeness is manual.

**Steps:**
1. Load the app in the populated state.
2. Observe a skill card.

**Expected result:**
- Card background is `--surface` (dark, distinct from page background but not high-contrast).
- Card heading (`<h2>`) is light text (`--text`).
- Description paragraph is light text.
- Repo link is accent color (`--accent` cyan `#58a6ff`), visually distinct from body text.
- Install command (`<code>` block) has dark code-background (`--code-bg`) and cyan-tinted
  code text (`--code-text`). Monospace font applied.
- Copy button is a ghost button: transparent background, accent border and text color.
- No white or near-white background visible in any part of any card.
- ScannedReposIndicator visible in header (collapsed summary, muted text, right-aligned).

---

### Focus-Ring Verification — Manual / Keyboard

Focus rings are inherently a manual verification — only a real browser renders them, and only
a keyboard user can trigger `:focus-visible`. These cases require keyboard navigation in a
real browser.

---

#### TC-190: Focus ring — search input is visible on dark background
**Level:** Manual (real browser, keyboard navigation)
**Automatable now:** No — `:focus-visible` rendering cannot be verified in jsdom.

**Steps:**
1. Load the app.
2. Tab to the search input (or it will be autofocused on load).
3. Observe the focus ring.

**Expected result:** A `2px solid #58a6ff` outline is visible around the search input.
The outline is distinct from the dark page background — the cyan color creates a high-contrast
ring that is immediately legible. The browser-default focus glow must NOT appear instead of
(or in addition to) the explicit `outline` rule.

---

#### TC-191: Focus ring — Copy button is visible on dark card surface
**Level:** Manual (real browser, keyboard navigation)
**Automatable now:** No.

**Steps:**
1. Tab to a Copy button inside a skill card.
2. Observe the focus ring.

**Expected result:** A `2px solid #58a6ff` outline is visible around the Copy button. The
ring is legible against the `--surface` card background. The ghost button's accent border
(also `--accent`) and the focus ring are both visible simultaneously — the focus ring is
offset (`outline-offset: 2px`) and therefore visually distinguishable from the button's own
border.

---

#### TC-192: Focus ring — repo link (inside skill card) is visible
**Level:** Manual (real browser, keyboard navigation)
**Automatable now:** No.

**Steps:**
1. Tab to a repo link inside a skill card.
2. Observe the focus ring.

**Expected result:** A `2px solid #58a6ff` outline is visible around the link text, offset
by 2px, on the dark card surface.

---

#### TC-193: Focus ring — `<summary>` element (repos disclosure) is visible on dark background
**Level:** Manual (real browser, keyboard navigation)
**Automatable now:** No.

**Steps:**
1. Shift+Tab from the search input to reach the `<summary>` element.
2. Observe the focus ring.

**Expected result:** A `2px solid #58a6ff` outline is visible around the summary text on the
dark page background. The native `<details>` marker (disclosure triangle) may or may not be
included in the outline depending on browser implementation — either is acceptable. The ring
must be clearly visible.

---

#### TC-194: Focus ring — repo links inside expanded disclosure are visible
**Level:** Manual (real browser, keyboard navigation)
**Automatable now:** No.

**Steps:**
1. Open the scanned repos disclosure.
2. Tab through the repo links inside the list.
3. Observe the focus ring on each link.

**Expected result:** A `2px solid #58a6ff` outline is visible on each repo link as focus
moves through the list. Links are on the `--bg` page background (the header does not use
`--surface`); the ring contrast is 7.22:1 (TC-175 pairing 1).

---

### Responsive Layout — Regression

#### TC-195: No horizontal scrollbar at 320px viewport — dark CSS does not introduce overflow
**Hypothesis:** TC-144 (the existing e2e regression) already covers no-overflow at 320px.
This case explicitly re-confirms that the restyle — which adds new `border` declarations,
potentially a `box-shadow` removal, and new padding/outline rules — does not introduce
horizontal overflow at the minimum supported viewport width.
**Preconditions:** Restyle implementation complete; e2e runnable.
**Level:** e2e (Playwright — TC-144 in `catalog.spec.ts`, re-run unchanged)
**Automatable now:** Yes — this is a re-run of an existing test.
**Status:** NOT YET WRITTEN (re-run of TC-144)

**Steps:**
1. Run `npx playwright test` and confirm TC-144 ("no horizontal overflow at 320px viewport")
   passes.
2. Specifically: the test sets viewport to 320px, expands the scanned-repos disclosure, and
   asserts `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.

**Expected result:** TC-144 passes. If it fails after the restyle, the specific CSS property
that caused the regression must be identified — the most likely candidates are:
- An `outline` or `outline-offset` on a full-width element that adds to its rendered width.
- A new `min-width` on an input or button element.
- A `border` addition that increases the element's box size if `box-sizing` is not set to
  `border-box`.

---

## UI-1 Must-Have Coverage

| Requirement (from requirements-ui-styling.md) | TC(s) | Level | Automatable |
|----------------------------------------------|-------|-------|-------------|
| Token system established; no raw hex values remain | TC-154 | Shell (grep) | Yes |
| Dark palette on all surfaces; no white background patches | TC-160, TC-162, TC-180–TC-184 | e2e computed-style + manual | Partially |
| Cyan/green accent on links, code, copy button | TC-172, TC-173, TC-184 | Contrast tool + manual visual | Manual |
| All interactive states styled for dark palette | TC-191–TC-194 | Manual keyboard | Manual |
| All five application states covered | TC-180–TC-184 | Manual visual | Manual |
| `.repo-scan-failed` meets AA contrast (4.5:1) | TC-161, TC-174 | e2e computed-style + contrast tool | Partially |
| WCAG AA preserved — primary text | TC-170 | Contrast tool | Manual |
| WCAG AA preserved — muted text (highest risk) | TC-171 | Contrast tool | Manual |
| WCAG AA preserved — accent/links | TC-172 | Contrast tool | Manual |
| WCAG AA preserved — code text | TC-173 | Contrast tool | Manual |
| Focus rings meet 3:1 non-text contrast (WCAG 2.4.11) | TC-175, TC-190–TC-194 | Contrast tool + manual keyboard | Manual |
| `.sr-only` and `.visually-hidden` unchanged | TC-155 | git diff | Yes |
| `role="alert"` container not suppressed by CSS | TC-181 | Manual visual | Manual |
| No horizontal scroll at 320px | TC-195 / TC-144 regression | e2e (Playwright) | Yes |
| Existing 90 unit tests pass unchanged | TC-150 | Automated (Vitest) | Yes |
| Existing 9 e2e tests pass unchanged | TC-151 | Automated (Playwright) | Yes |
| Build succeeds; CSS artifact present | TC-153 | Automated (build script) | Yes |
| TypeScript typecheck clean | TC-152 | Automated (tsc) | Yes |
| Full-page WCAG AA axe audit | TC-176 | Tool-assisted manual | Manual (automatable with axe-playwright) |

---

## UI-1 Automatable vs Manual Summary

**Automatable now (recommend implementing):**

| TC | What it tests | Notes |
|----|--------------|-------|
| TC-150 | 90 unit tests pass unchanged | Run `npm run test` — already exists, just re-run |
| TC-151 | 9 e2e tests pass unchanged | Run `npx playwright test` — already exists, just re-run |
| TC-152 | TypeScript typecheck clean | Run `npm run typecheck` — already exists |
| TC-153 | Build succeeds, CSS artifact present | Run `npm run build` — already exists |
| TC-154 | No raw hex values in CSS | New grep check — trivial to add to CI |
| TC-155 | `.sr-only` / `.visually-hidden` unchanged | git diff check — trivial |
| **TC-160** | **body background = dark `rgb(13, 17, 23)`** | **New Playwright test — RECOMMENDED** |
| **TC-161** | **`span.repo-scan-failed` color is NOT `rgb(153, 153, 153)`** | **New Playwright test — RECOMMENDED** |
| TC-162 | `.skill-card` background = dark surface | New Playwright test — optional third smoke check |
| TC-195 | No horizontal overflow at 320px | Re-run of existing TC-144 — already exists |

**Manual / tool-assisted (not unit-automatable without adding an a11y library):**

| TC | What it tests | Method |
|----|--------------|--------|
| TC-163 | `::before` terminal prompt does not break `textContent` | e2e regression re-run (if `::before` implemented) |
| TC-170–TC-176 | WCAG contrast for all pairings | Browser DevTools / axe / contrast checker |
| TC-180–TC-184 | All five states visual in dark palette | Real browser visual inspection |
| TC-190–TC-194 | Focus ring visibility on keyboard navigation | Real browser keyboard navigation |

**The 2 new e2e smoke checks I am recommending (TC-160 and TC-161):**

These are the two highest-value additions to the automated suite. They are cheap (3–5 lines of
Playwright each), permanent regression guards, and they protect against the two most likely
regressions in a CSS restyle: (1) the dark body background being accidentally absent or
overridden, and (2) the `.repo-scan-failed` color silently reverting to the old failing value.
Neither requires a new dependency. Both use `page.evaluate` with `getComputedStyle`, which is
standard Playwright practice. I recommend the Lead add these to `catalog.spec.ts` alongside
the SR-1 e2e cases already present there.

TC-162 (card surface color) is a lower-priority third check that is worth adding if the Lead
is already writing the other two.

---

## UI-1 Regression Risk Summary

| Risk | Likelihood | Impact | Protected by |
|------|-----------|--------|-------------|
| Restyle accidentally edits TSX file and breaks a DOM-contract selector | Medium | High (test failures) | TC-150 (unit suite), TC-151 (e2e suite) |
| `.sr-only` or `.visually-hidden` rule modified | Low | High (a11y regression) | TC-155 (git diff check) |
| `role="alert"` container hidden by CSS | Low | High (a11y regression) | TC-181 (manual visual) |
| body background not set (dark cards on white viewport) | High | Medium (visual break) | TC-160 (e2e computed-style — RECOMMENDED) |
| `.repo-scan-failed` retains old `#999` color (contrast failure) | High | Medium (WCAG AA failure) | TC-161 (e2e computed-style — RECOMMENDED), TC-174 (manual contrast) |
| Muted text fails WCAG AA on dark surface | High | High (hard requirement) | TC-171 (manual contrast — critical case) |
| Focus rings invisible on dark backgrounds | Medium | High (WCAG 2.4.11) | TC-175 (contrast), TC-190–TC-194 (keyboard) |
| New CSS introduces horizontal overflow at 320px | Low | Medium | TC-195 / TC-144 re-run |
| Raw hex values remain (token migration incomplete) | Low | Low (implementation quality) | TC-154 (grep check) |
