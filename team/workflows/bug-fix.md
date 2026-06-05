# Workflow: Bug Fix

> **Run it:** `/bug-fix <bug>` orchestrates these steps — reproduce, diagnose, triage, fix, verify —
> spawning each persona as a subagent and pausing at the gates. Run any single step with its
> persona command (`/qa`, `/lead`, …). The `Invoke:` examples below are the gist of each step.

Use this workflow when investigating and resolving a reported defect.

---

## When to use this workflow

- A user or QA has reported unexpected behavior
- A feature is not behaving as specified
- There's a crash, data issue, or error in production or staging
- Performance has degraded unexpectedly

---

## Workflow Steps

### Step 1 — QA or BA: Capture and Characterize

**Who:** Remy Dubois (QA) — preferred if QA found it. Priya Nair (BA) — if reported by a stakeholder and symptoms are vague.  
**Input:** Bug report, user description, error logs  
**Output:** Bug Report using `team/templates/bug-report.md`

Invoke QA: "Act as Remy Dubois, the QA Engineer. We have a reported bug: [description]. Write a formal bug report and verify you can reproduce it."

Invoke BA (if symptoms are unclear): "Act as Priya Nair, the Business Analyst. A user is reporting [symptom]. Help me understand what they're actually experiencing and what the expected behavior should be."

A good bug report includes: exact repro steps, expected vs. actual behavior, environment, severity hypothesis. It does NOT include "it's broken" or "it doesn't work."

**Gate:** Bug is reproduced and documented before any fix begins

---

### Step 2 — Solution Architect (if needed): Root Cause Diagnosis

**Who:** Marcus Chen (Architect) — only if the bug implies an architectural or systemic issue  
**Input:** Bug report  
**Output:** Root Cause Analysis

Invoke: "Act as Marcus Chen, the Solution Architect. Read this bug report and diagnose whether the root cause is architectural. Is this a symptom of a deeper design issue, or is it a localized implementation bug?"

Skip this step for straightforward implementation bugs. Use it when:
- The same bug has appeared multiple times in different places
- The bug suggests a fundamental assumption was wrong (data model, API contract, state management)
- Fixing the bug the obvious way would just move it somewhere else

**Gate:** Decision: is this a localized fix or does it need an ADR?

---

### Step 3 — Product Manager: Triage + Priority

**Who:** Sasha Kowalski (PM)  
**Input:** Bug Report (with severity from QA), Root Cause Analysis (if applicable)  
**Output:** Priority decision: fix now / fix next sprint / accept and backlog

Invoke: "Act as Sasha Kowalski, the Product Manager. QA has filed this bug report [link/paste]. What's our priority and timeline for fixing it?"

The PM decides:
- Fix before ship (blocker)
- Fix in next sprint (high priority but not a blocker)
- Accept and backlog (low severity, workaround exists)

---

### Step 4 — Lead Developer: Fix

**Who:** Theo Okafor (Lead Developer) — or Yuki (Junior) if it's a well-scoped, localized fix  
**Input:** Bug Report, Root Cause Analysis (if applicable), PM priority decision  
**Output:** PR with fix

Invoke: "Act as Theo Okafor, the Lead Developer. Fix the bug documented in [bug report]. Explain your approach before implementing."

The fix includes:
- The actual code change
- A unit test that would have caught this bug (prevents regression)
- PR description explaining what changed and why

**Gate:** PR reviewed by Lead Developer (if fixed by Junior)

---

### Step 5 — QA: Verification + Regression

**Who:** Remy Dubois (QA)  
**Input:** Fix deployed to test environment, original bug report  
**Output:** Verification result + regression test update

Invoke: "Act as Remy Dubois, the QA Engineer. Verify that bug [BUG-NNN] is fixed in the current build and that the fix hasn't introduced any regressions."

QA confirms:
- The specific bug is fixed (original repro steps no longer reproduce the bug)
- The fix hasn't broken related behavior (regression pass)
- The bug report is updated with resolution

---

### Step 6 — Close / Communicate

- Bug report is updated: Fixed in [build/commit]
- If the bug was reported by a stakeholder: PM communicates resolution
- If the bug revealed a systemic issue: Architect creates or updates an ADR

---

## Triage Quick Reference

| Severity | Who decides priority | Default timeline |
|----------|---------------------|-----------------|
| Critical (data loss, security, system down) | PM + Lead Dev immediately | Fix before anything else |
| High (feature broken, no workaround) | PM within 1 business day | Fix this sprint |
| Medium (degraded, workaround exists) | PM at next planning | Fix next sprint |
| Low (cosmetic, minor edge case) | PM at backlog grooming | Backlog |
