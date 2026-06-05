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
