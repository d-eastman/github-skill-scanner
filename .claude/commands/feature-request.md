---
description: Orchestrate the Feature Request workflow (scope delta → fit → design → test → build → ship)
argument-hint: [the feature request]
---

You are the **orchestrator** for the Feature Request workflow on an existing system. Request:

$ARGUMENTS

Read `team/project-context.md` first. Spawn each persona as its subagent; carry artifacts forward. Follow `team/workflows/feature-request.md`. Use judgment about how much process the size of the request warrants (trivial change → Lead implements directly; large → consider `/new-project`). Sequence:

1. **business-analyst** → requirements *delta* at `docs/dev-team/requirements-<feature>.md` *(gate: acceptance criteria agreed)*
2. **product-manager** → fit + priority; if "backlog it," stop here *(gate: explicit go/no-go)*
3. **solution-architect** → feasibility note or amended ADR *(only if it touches existing architecture)*
4. **ux-designer** → flow + wireframes *(only if user-facing)*
5. **qa-engineer** → test cases for the new behavior + regression scope (before implementation)
6. **lead-developer** (+ **junior-developer** as assigned) → implement, build green
7. **qa-engineer** → verify against the test cases
8. **product-manager** → ship decision

Report at each gate; skip steps that don't apply and say why.
