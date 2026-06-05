# The Software Development Team

A team of AI personas for software development, installed as **native Claude Code subagents and
slash commands**. Each persona has a defined role, explicit blind spots, scoped tools, clear
deliverables, and rules for when to defer to others. Invoke them individually, or let a workflow
command orchestrate them — there is no mandatory pipeline.

---

## How to Use This Team

**Run a single persona** with its slash command:

```
/ba       a vague idea or feature → Requirements Document
/architect evaluate approaches → ADR
/qa       write a test plan and run the tests
```

**Run a whole workflow** (orchestrates several personas, pausing at gates):

```
/new-project <idea>      /feature-request <ask>      /bug-fix <bug>      /tech-debt <problem>
```

**See everything** with `/dev-team`.

Each persona is a subagent (`.claude/agents/<role>.md`) with its own context window, its own
scoped tools, and its own model. The developers, QA, security, and DevOps personas run real
commands — they verify against the codebase, they don't just describe work.

---

## Persona Index

### Core (engage on most work)

| Command | Persona | Role | Subagent file |
|---------|---------|------|--------------|
| `/ba` | Priya Nair | Business Analyst | `.claude/agents/business-analyst.md` |
| `/architect` | Marcus Chen | Solution Architect | `.claude/agents/solution-architect.md` |
| `/pm` | Sasha Kowalski | Product Manager | `.claude/agents/product-manager.md` |
| `/lead` | Theo Okafor | Lead Developer | `.claude/agents/lead-developer.md` |
| `/junior` | Yuki Tanaka | Junior Developer | `.claude/agents/junior-developer.md` |
| `/qa` | Remy Dubois | QA Engineer | `.claude/agents/qa-engineer.md` |

### Fractional (engage at specific gates)

| Command | Persona | Role | When to engage |
|---------|---------|------|---------------|
| `/devops` | Fia Magnusson | DevOps Engineer | Initial setup, deployment gates, infra changes |
| `/ux` | Lena Vasquez | UX Designer | Any user-facing feature; usability reviews |
| `/security` | Dario Ferretti | Security Reviewer | Pre-launch audit; auth/data handling |
| `/data` | Ori Shapiro | Data Analyst / A/B Lead | Define success metrics; post-launch analysis |

---

## Workflow Index

| Situation | Command | Guide |
|-----------|---------|-------|
| Building something new | `/new-project` | `workflows/new-project.md` |
| Fixing a reported bug | `/bug-fix` | `workflows/bug-fix.md` |
| Adding a feature to an existing system | `/feature-request` | `workflows/feature-request.md` |
| Addressing technical debt or refactoring | `/tech-debt` | `workflows/technical-debt.md` |

---

## Artifacts

Everything the personas produce lives in **`docs/dev-team/`** with consistent naming, indexed in
that directory's README. Handoffs work by path: the Architect reads the BA's `requirements.md`,
the Lead Dev reads the Architect's `adr-NNN-*.md`, and so on.

For a complete, filled-in chain (requirements → ADR → test plan → bug report) for one small
feature, see the worked example in **`docs/dev-team/examples/csv-export/`**.

| Artifact | Who produces it | Path | Template |
|----------|----------------|------|----------|
| Requirements Document | `/ba` | `requirements.md` | `templates/requirements.md` |
| Architecture Decision Record | `/architect` | `adr-NNN-*.md` | `templates/adr.md` |
| Phase Plan | `/pm` | `phase-plan.md` | `templates/phase-plan.md` |
| Technical Spec | `/lead` | `tech-spec.md` | — |
| Test Plan | `/qa` | `test-plan.md` | `templates/test-plan.md` |
| Bug Report | `/qa` | `bug-reports/BUG-NNN.md` | `templates/bug-report.md` |
| Success Metrics | `/data` | `success-metrics.md` | — |
| User Flows | `/ux` | `user-flows.md` | — |
| Deployment Runbook | `/devops` | `deployment-runbook.md` | — |
| Security Review | `/security` | `security-review.md` | — |

---

## Project Grounding

**Every persona reads `team/project-context.md` first.** It holds the stack, the exact
build/test/audit commands, the repo map, and conventions. Keep it filled in and current — it is
the difference between grounded advice and generic boilerplate. The developer, QA, security, and
DevOps personas treat its command table as the source of truth for "build green," "run the tests,"
and "scan dependencies."

---

## Quick Reference: Who to Call

| Question or task | Command |
|-----------------|---------|
| What should we build? What does the user need? | `/ba` |
| How should we build it? What are the trade-offs? | `/architect` |
| What should we build now vs. later? What do we cut? | `/pm` |
| How do we implement this? How long will it take? | `/lead` |
| Implement this scoped task | `/junior` (or `/lead`) |
| Is this working correctly? What are the edge cases? | `/qa` |
| How do we deploy and operate this? | `/devops` |
| How will users interact with this? | `/ux` |
| Is this secure? What are the vulnerabilities? | `/security` |
| How do we measure success? Did the feature work? | `/data` |

---

## Design Principles

These are the principles that make this system work. Don't skip them.

**1. Blind spots are named, not hidden.**
Every persona knows what they're bad at and who to defer to. This prevents the "I don't see the problem" failure mode.

**2. Priorities are ordered.**
Not "I care about quality" — "correctness > coverage > speed." When there's tension, the ordering resolves it.

**3. What they don't do is explicit.**
Every persona has a "What You Don't Do" section, and scoped `tools:` that enforce it. This prevents scope bleed and persona confusion.

**4. Deliverables are artifacts, not advice.**
Each persona produces a named, structured artifact in `docs/dev-team/`. "Advice" dissipates; artifacts persist and can be handed off.

**5. They verify against reality.**
Developers leave the build green; QA runs the suite; Security scans dependencies and greps for real vulnerabilities. The team produces working software, not a description of working software.

**6. Fractional personas engage at gates.**
DevOps, UX, Security, and Data are not on every task. They engage at defined moments — high-signal, not blocking.

**7. Decisions are made before pressure hits.**
Cut lines, fallbacks, and go/no-go criteria are defined before the deadline arrives. The PM's phase plan pre-decides what gets cut rather than forcing a panic decision under pressure.

---

## Installing Into a New Project

From the toolkit:

```bash
/path/to/software-dev-team/bootstrap.sh /path/to/your/project
```

This installs the subagents and slash commands into `.claude/`, the templates/workflows into
`team/`, seeds `docs/dev-team/`, and (optionally) appends a section to the project's `CLAUDE.md`.
Use `--link` to symlink back to the toolkit so personas update when the toolkit does.

---

## Customizing This Team

The personas are a starting point, not a constitution.

- **Ground them:** fill in `team/project-context.md` — this is the highest-leverage customization.
- **Model per persona:** set `model:` in `.claude/agents/<role>.md` frontmatter.
- **Tool scope per persona:** set `tools:` in the same frontmatter.
- **Add a persona:** copy an existing agent file (frontmatter + body + Execution Loop), add a
  matching `.claude/commands/<short>.md`, and list it here.
- **Remove a persona:** delete its agent + command files, or just don't invoke it.
