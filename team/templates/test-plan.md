<!-- Filled-in example: docs/dev-team/examples/csv-export/test-plan.md -->
# Test Plan
**Feature / Scope:** [What is being tested]  
**Author:** Remy Dubois (QA Engineer)  
**Date:** [Date]  
**Build / Commit:** [Build or commit hash being tested]  
**Status:** Draft | Ready | In Progress | Complete

---

## Scope

### What is being tested
[Brief description of the feature or change under test]

### What is NOT being tested
[Explicitly call out what's excluded to prevent "why didn't you test X" conversations]

### Test environment
[Where tests are run — local, staging, specific environment URL or config]

---

## Entry Criteria

[What must be true before testing begins]

- [ ] Build is deployed and stable in the test environment
- [ ] Requirements document is final (or changes are communicated)
- [ ] Technical spec is available for reference
- [ ] [Any specific setup required — test accounts, data fixtures, etc.]

---

## Test Cases

Each test case has: a hypothesis (what we're testing), steps to reproduce, expected result, actual result (filled in during execution).

### Happy Path

#### TC-001: [Name — what the user does]
**Hypothesis:** [What assumption are we testing? e.g., "A logged-in user can complete the checkout flow with a valid card"]  
**Preconditions:** [What state must exist before this test]

**Steps:**
1. [Step]
2. [Step]
3. [Step]

**Expected result:** [What should happen]  
**Actual result:** [ ] Pass | [ ] Fail | [ ] Blocked  
**Notes:** [Observed behavior if not pass]

---

#### TC-002: [Name]
**Hypothesis:** [What are we testing]  
**Preconditions:** [State required]

**Steps:**
1. [Step]
2. [Step]

**Expected result:** [What should happen]  
**Actual result:** [ ] Pass | [ ] Fail | [ ] Blocked  
**Notes:**

---

### Edge Cases

#### TC-010: [Name — edge case description]
**Hypothesis:** [e.g., "Submitting the form with a missing required field shows an inline error without clearing other fields"]  
**Preconditions:** [State required]

**Steps:**
1. [Step]

**Expected result:** [What should happen]  
**Actual result:** [ ] Pass | [ ] Fail | [ ] Blocked  
**Notes:**

---

### Error States

#### TC-020: [Name — error condition]
**Hypothesis:** [e.g., "If the API is unavailable, the user sees a meaningful error message rather than a spinner"]  
**Preconditions:** [How to simulate the error condition]

**Steps:**
1. [Step]

**Expected result:** [What should happen]  
**Actual result:** [ ] Pass | [ ] Fail | [ ] Blocked  
**Notes:**

---

### Regression Cases

[Test cases for existing behavior that could be affected by this change. Pull from prior test plans or known prior behaviors.]

#### TC-030: [Name — existing behavior]
**Hypothesis:** [e.g., "Existing user login flow is unaffected by the new OAuth integration"]

**Steps:**
1. [Step]

**Expected result:** [What should still happen]  
**Actual result:** [ ] Pass | [ ] Fail | [ ] Blocked  
**Notes:**

---

## Exit Criteria

[What must be true for testing to be considered complete and the feature ready to ship]

- [ ] All happy path test cases pass
- [ ] All critical edge cases pass
- [ ] All regression cases pass
- [ ] No open Severity 1 (Critical) bugs
- [ ] No open Severity 2 (High) bugs without PM sign-off on accepted risk
- [ ] Bug report filed for any failing tests

---

## Bug Summary

| Bug ID | Title | Severity | Status | Link |
|--------|-------|----------|--------|------|
| [ID] | [Short description] | Critical / High / Medium / Low | Open / Fixed / Accepted | [Link] |

---

## Quality Risk Assessment

[Honest assessment of what concerns remain after testing. PM uses this for go/no-go.]

**Go recommendation:** [ ] Ship | [ ] Do not ship | [ ] Ship with known issues (documented below)

**Known issues accepted for this release:**
- [Issue and rationale for acceptance]

**Concerns that don't block ship but should be watched:**
- [Concern]
