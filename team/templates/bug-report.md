<!-- Filled-in example: docs/dev-team/examples/csv-export/BUG-001.md -->
# Bug Report
**ID:** [BUG-NNN]  
**Title:** [Short imperative description — "Checkout form clears all fields on invalid email"]  
**Author:** Remy Dubois (QA Engineer)  
**Date:** [Date]  
**Build / Commit:** [Build or commit hash where bug was found]

---

## Severity

[ ] **Critical** — Data loss, security vulnerability, or system unavailable for primary use case  
[ ] **High** — Feature is broken for a significant user path; no workaround  
[ ] **Medium** — Feature works but with significant degradation; workaround exists  
[ ] **Low** — Minor issue, cosmetic, or edge case with acceptable workaround

## Priority

[ ] **Must fix before ship** — Blocks release  
[ ] **Fix in next sprint** — Important but not a release blocker  
[ ] **Backlog** — Known issue, accepted for now, tracked for future  

---

## Environment

- **Environment:** [local / staging / production]
- **OS / Browser / Device:** [e.g., macOS 14, Chrome 124, iPhone 15 iOS 17]
- **User role / account:** [What account type was being used when the bug appeared]
- **Build / version:** [Commit hash or build number]

---

## Steps to Reproduce

[Specific steps from a clean state. Another developer should be able to follow these and hit the same bug.]

1. [Starting state — e.g., "Navigate to /checkout as a logged-in user with items in cart"]
2. [Action]
3. [Action]
4. [Action — the one that triggers the bug]

---

## Expected Result

[What should happen according to the requirements, spec, or reasonable expectation]

---

## Actual Result

[What actually happens. Be specific. Include error messages verbatim. Describe what the user sees.]

---

## Evidence

[Screenshots, screen recordings, logs, network trace — whatever makes the bug unambiguous. If you can't attach here, describe what you'd attach and where it is.]

- [Screenshot: describe what it shows]
- [Console error: paste verbatim if relevant]
- [Network request/response: paste if relevant]

---

## Frequency

[ ] Happens every time  
[ ] Happens intermittently — approximately [X]% of the time  
[ ] Happened once — could not reproduce consistently

---

## Hypothesis

[Your hypothesis about root cause. Not required to be correct — but helps the Lead Developer orient. Based on your understanding of the implementation.]

[e.g., "Suspect the field validation runs on the entire form state rather than per-field, and on error resets all form state to initial values rather than only the invalid field"]

---

## Workaround

[Is there a workaround? If so, what is it? If no workaround, say so explicitly.]

---

## Related

- [Link to relevant requirement or acceptance criteria]
- [Link to related test case in test plan]
- [Link to related bug if part of a pattern]
