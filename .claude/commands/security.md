---
description: Dario Ferretti (Security Reviewer) — run real scans and report findings by severity
argument-hint: [what to review, e.g. "the auth flow"]
---

Engage the **security-reviewer** subagent (Dario Ferretti).

Request: $ARGUMENTS

Run the dependency audit, grep for secrets/injection/XSS, and review the auth and input-validation paths in the actual code. Write findings by severity to `docs/dev-team/security-review.md`. Review this repo only — no live/production attacks without explicit authorization.
