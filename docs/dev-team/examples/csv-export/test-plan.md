> **EXAMPLE** — a filled-in Test Plan for the fictional "Export report to CSV" feature, executed
> against a sample build. The "Actual result" fields are filled in to show what a *completed* plan
> looks like — including a real failure (TC-010) that produced `BUG-001.md`. Not a real project
> artifact. See [`../README.md`](../README.md).

# Test Plan
**Feature / Scope:** Export filtered orders report to CSV
**Author:** Remy Dubois (QA Engineer)
**Date:** 2026-05-27
**Build / Commit:** `example-build`
**Status:** Complete

---

## Scope

### What is being tested
CSV export of the filtered orders report — `requirements.md` must-haves #1–#5, using the streaming approach in `ADR-001`.

### What is NOT being tested
Other report types, XLSX export, scheduled exports (all out of scope for this feature).

### Test environment
Staging, seeded orders dataset (~300k rows available). Verified in Chrome, opened in Excel and Google Sheets, and parsed programmatically with `csv-parse` for column-count assertions.

---

## Entry Criteria

- [x] Build is deployed and stable in staging
- [x] Requirements document is Final
- [x] ADR-001 is Accepted (streaming + 250k cap)
- [x] Test accounts exist for both a finance analyst (all regions) and a regional ops user

---

## Test Cases

### Happy Path

#### TC-001: Export matches the filtered table
**Hypothesis:** the export contains exactly the filtered rows plus a header.
**Preconditions:** logged in as finance analyst.

**Steps:**
1. On `/reports`, filter `status = shipped` (returns 1,240 rows on screen)
2. Click Export
3. Open the downloaded file

**Expected result:** 1,240 data rows + 1 header row; 5 spot-checked rows match the table.
**Actual result:** [x] Pass | [ ] Fail | [ ] Blocked
**Notes:** 1,241 lines total; spot checks matched.

---

#### TC-002: Column parity
**Hypothesis:** header row equals the visible columns, in order.
**Preconditions:** none beyond TC-001.

**Steps:**
1. Compare the CSV header row to the on-screen column labels

**Expected result:** identical labels and order.
**Actual result:** [x] Pass | [ ] Fail | [ ] Blocked
**Notes:**

---

### Edge Cases

#### TC-010: Fields with commas / quotes / newlines are quoted
**Hypothesis:** RFC-4180 quoting keeps special-character fields in a single cell with no column shift (`requirements.md` must-have #3).
**Preconditions:** dataset includes order #10481 with customer `Doe, Jane` and a note containing a newline.

**Steps:**
1. Filter to include order #10481 and export
2. Parse the file with `csv-parse` and assert every row has the same column count
3. Open in Google Sheets and inspect the row

**Expected result:** `Doe, Jane` is one cell; the note's newline stays inside one cell; all rows have equal column counts.
**Actual result:** [ ] Pass | [x] Fail | [ ] Blocked
**Notes:** **FAIL** — comma-containing values are written unquoted, so `Jane` spills into the next column and every later column shifts right for that row. Filed as **BUG-001**.

---

#### TC-011: Empty result set
**Hypothesis:** a filter matching 0 rows exports a header-only file without erroring.
**Steps:** filter to a date range with no orders; export.
**Expected result:** file with header row only; no error.
**Actual result:** [x] Pass | [ ] Fail | [ ] Blocked
**Notes:**

---

#### TC-012: Unicode preserved
**Hypothesis:** accented and non-Latin text survives (UTF-8 + BOM).
**Steps:** export rows containing `café` and `日本語`; open in Excel.
**Expected result:** characters render correctly; no mojibake.
**Actual result:** [x] Pass | [ ] Fail | [ ] Blocked
**Notes:** BOM present; Excel detected UTF-8.

---

#### TC-013: 250k row cap boundary
**Hypothesis:** ~250k rows stream within budget; above the cap returns `413` with guidance (`ADR-001`).
**Steps:** run an unfiltered export (~300k rows).
**Expected result:** `413` with a "narrow your filters" message; server heap stays flat (streamed, not buffered).
**Actual result:** [x] Pass | [ ] Fail | [ ] Blocked
**Notes:** 413 returned at the cap; heap flat per monitoring during a separate 240k export.

---

### Error States

#### TC-020: Database error mid-stream
**Hypothesis:** a failure after streaming starts is logged and does not affect other users' API calls.
**Steps:** inject a DB disconnect partway through a large export.
**Expected result:** export download ends (truncated); error is logged; `/api/reports/orders` keeps serving other users.
**Actual result:** [x] Pass | [ ] Fail | [ ] Blocked
**Notes:** Reports API stayed up; truncation is logged. (Truncation is not surfaced to the user — accepted in ADR-001.)

---

#### TC-021: Formula injection neutralized
**Hypothesis:** a cell `=1+1` imports as literal text, not an evaluated formula (`requirements.md` must-have #4).
**Steps:** export a row whose note is `=1+1`; open in Excel.
**Expected result:** cell shows `=1+1` as text.
**Actual result:** [x] Pass | [ ] Fail | [ ] Blocked
**Notes:** Leading `'` applied; Excel showed literal text.

---

### Regression

#### TC-030: Reports table and API unchanged
**Hypothesis:** adding export did not change the on-screen report or its filters.
**Steps:** exercise the existing filters and pagination on `/reports`.
**Expected result:** identical behavior to before the feature.
**Actual result:** [x] Pass | [ ] Fail | [ ] Blocked
**Notes:**

---

## Exit Criteria

- [x] All happy-path cases pass
- [ ] All critical edge cases pass — **blocked by BUG-001 (TC-010)**
- [x] All regression cases pass
- [x] No open Severity 1 (Critical) bugs
- [ ] No open Severity 2 (High) bugs without PM sign-off — **BUG-001 is open (High)**

---

## Bug Summary

| Bug ID | Title | Severity | Status | Link |
|--------|-------|----------|--------|------|
| BUG-001 | Comma-containing fields not quoted; columns shift | High | Open | `BUG-001.md` |

---

## Quality Risk Assessment

**Go recommendation:** [ ] Ship | [x] Do not ship | [ ] Ship with known issues

**Why:** BUG-001 corrupts any export that contains a comma in a text field — and commas are common in customer names and addresses. The corruption is silent (header and comma-free rows look fine), so users would likely trust misaligned data. Fix BUG-001 and re-run TC-010 before release. Everything else passes, including formula-injection neutralization (TC-021) and the streaming row cap (TC-013).

**Concerns that don't block ship but should be watched:**
- No progress indicator for large exports (accepted in ADR-001; spinner-only).
- Mid-stream truncation isn't surfaced to the user (accepted in ADR-001).
