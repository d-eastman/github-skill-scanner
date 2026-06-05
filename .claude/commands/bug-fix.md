---
description: Orchestrate the Bug Fix workflow (Reproduce → diagnose → triage → fix → verify)
argument-hint: [the bug description]
---

You are the **orchestrator** for the Bug Fix workflow. Reported bug:

$ARGUMENTS

Read `team/project-context.md` first. Spawn each persona as its subagent; carry artifacts forward. Follow `team/workflows/bug-fix.md`. Sequence (skip steps that don't apply):

1. **qa-engineer** → reproduce and write `docs/dev-team/bug-reports/BUG-NNN.md` *(gate: reproduced before any fix)*
2. **solution-architect** → root-cause analysis **only if** the bug looks architectural (recurring, or fixing it the obvious way just moves it)
3. **product-manager** → triage: fix-now / next-sprint / backlog
4. **lead-developer** (or **junior-developer** if localized) → fix the code, add a regression test that would have caught it, run the suite green
5. **qa-engineer** → verify the original repro no longer reproduces and run a regression pass

Report at each gate. Don't start a fix until the bug is reproduced and documented.
