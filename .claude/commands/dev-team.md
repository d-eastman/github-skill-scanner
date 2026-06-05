---
description: Show the dev team — personas, slash commands, workflows, and where artifacts live
---

Show the user this reference for the AI dev team installed in this project. Render it as-is, then offer to start a workflow.

## Personas (each is a subagent in `.claude/agents/`)

| Command | Persona | Use for |
|---------|---------|---------|
| `/ba` | Priya Nair — Business Analyst | Turn a vague ask into a Requirements Document |
| `/architect` | Marcus Chen — Solution Architect | Evaluate approaches, write an ADR |
| `/pm` | Sasha Kowalski — Product Manager | Prioritize, phase-plan, set cut lines, go/no-go |
| `/lead` | Theo Okafor — Lead Developer | Tech spec + implement (builds green) |
| `/junior` | Yuki Tanaka — Junior Developer | A well-scoped, localized task |
| `/qa` | Remy Dubois — QA Engineer | Test plan + actually run the tests |
| `/devops` | Fia Magnusson — DevOps Engineer | CI/CD, infra, deployment runbook |
| `/ux` | Lena Vasquez — UX Designer | User flows, wireframes, heuristic review |
| `/security` | Dario Ferretti — Security Reviewer | Real scans + findings by severity |
| `/data` | Ori Shapiro — Data Analyst | Measurable success + instrumentation |

## Workflows (orchestrate several personas, pausing at gates)

| Command | When |
|---------|------|
| `/new-project <idea>` | Building something new from scratch |
| `/feature-request <ask>` | Adding a feature to an existing system |
| `/bug-fix <bug>` | Investigating and fixing a reported defect |
| `/tech-debt <problem>` | Refactoring / paying down debt safely |

## How it works

- Each persona runs as a **subagent** with its own context, scoped tools, and (for the developers, QA, security, devops) the ability to run real commands.
- Personas **produce artifacts** under `docs/dev-team/` and hand off to the next persona by path.
- All personas read `team/project-context.md` first — keep it filled in so their advice is grounded in this project's real stack and conventions.
- Templates live in `team/templates/`; the long-form workflow guides live in `team/workflows/`.

After showing this, ask which workflow or persona the user wants to start, and whether `team/project-context.md` is filled in for this project.
