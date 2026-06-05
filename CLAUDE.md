# Project CLAUDE.md

<!-- ai-dev-team -->
## AI Dev Team

This project has a structured AI persona team installed as native Claude Code
subagents and slash commands.

- **Personas:** `/ba` `/architect` `/pm` `/lead` `/junior` `/qa` `/devops` `/ux` `/security` `/data`
- **Workflows:** `/new-project` `/feature-request` `/bug-fix` `/tech-debt`
- **Index / help:** `/dev-team`

Personas read `team/project-context.md` first (keep it current), produce artifacts
under `docs/dev-team/`, and hand off to each other by path. Full definitions live in
`.claude/agents/`; workflow guides in `team/workflows/`.
