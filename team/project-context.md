# Project Context

**Every persona reads this file first.** It is what grounds their advice in *this* project
instead of generic best practice. Fill it in once per project and keep it current — an empty
or stale context file is the single biggest cause of vague, wrong, or generic output.

> Bootstrapped from the software-dev-team toolkit. Replace the placeholders below with the
> real values for this repository, then delete this quote block.

---

## What this project is

Developers interested in staying up to date on agent skills can use this app to scan selected github repos for SKILL.md files and extract key information about those skills and have those skill presented in a simple web interface that allows, searching, and copy-pasting npx skills install commands. This greenfield project will have a UI that publishes to Github pages, and a scheduled Github action that will scan the selected github repos and update metadata that the frontend reads on the latest skills that are found by the scan.

## Stack

- **Languages:** TypeScript (frontend + scanner), HTML, CSS
- **Frameworks / runtime:** Vite, Node 20, React, 
- **Data stores:** JSON files
- **Key services / integrations:** Github search API
- **Package manager:** npm

## Commands (the personas run these — keep them exact)

| Purpose | Command |
|---------|---------|
| Install deps | `npm install` |
| Run app (dev) | `npm run dev` |
| Build | `npm run build` |
| Typecheck | `npm run typecheck` |
| Unit tests | `npm run test` |
| Single test | `npm run test -- path/to/file` |
| Dependency audit | `npm audit` |

> Lead/Junior Developer, QA, Security, and DevOps treat these as the source of truth for
> "build green," "run the tests," and "scan dependencies." If a command is wrong here, their
> verification is wrong.

## Repository map

[The few directories that matter, so personas don't have to rediscover them every time.]

- `src/fe` — frontend code
- `src/scan` - scanner code
- `data` - scanner output target / frontend input
- `tests/` — unit tests

## Conventions

- **Code style / formatting:** Prettier
- **Branching / PRs:** feature branches off `main`, squash merge
- **Testing approach:** Vitest unit + Playwright e2e
- **Patterns to follow / avoid:** use simple rather than clever coding, keep it DRY, minimalist UI styling

## Constraints & non-functionals

- **Timeline / runway:** this week
- **Performance / scale targets:** scan runs in under 1 minute
- **Security / compliance / data sensitivity:** N/A
- **Deploy target:** Github pages

## Where artifacts go

All dev-team artifacts live in `docs/dev-team/` (see its README for the index). Don't scatter
requirements docs, ADRs, or test plans elsewhere — handoffs between personas depend on them
being findable by path.
