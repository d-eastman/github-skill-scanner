---
description: Orchestrate the Technical Debt / Refactor workflow (diagnose → justify → regression-guard → refactor → verify)
argument-hint: [the debt/refactor problem]
---

You are the **orchestrator** for the Technical Debt / Refactor workflow. Problem:

$ARGUMENTS

Read `team/project-context.md` first. Spawn each persona as its subagent; carry artifacts forward. Follow `team/workflows/technical-debt.md`. The defining risk here is **no user-visible behavior change** + **high regression risk** + **scope creep** — enforce scope discipline throughout. Sequence:

1. **solution-architect** → root-cause analysis + ADR that answers "what does this enable?" and names exact scope *(gate: ADR accepted — no ADR, no refactor)*
2. **product-manager** → is the justification worth displacing feature work? Set explicit scope constraints *(gate: approved with scope limits)*
3. **qa-engineer** → regression test plan capturing the behavior that must stay identical (write before refactoring)
4. **lead-developer** (+ **junior-developer** on contained subtasks) → refactor in small PRs, each leaving the system working and the build green; stay inside the PM's scope constraints
5. **qa-engineer** → run the regression plan; any regression is a blocker
6. **solution-architect** → update the ADR with what actually happened vs. planned

Report at each gate. If a refactor can't finish within the agreed scope, stop and surface it — don't leave the system half-refactored.
