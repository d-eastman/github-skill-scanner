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
