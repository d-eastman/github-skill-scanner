# GitHub Skill Scanner

Scans configured GitHub repositories for Claude `SKILL.md` files and publishes a
searchable catalog as a static site. Each result includes a ready-to-copy install
command.

## How it works

1. **Scan** — `npm run scan` reads `src/scan/repos.json`, finds `SKILL.md` files in
   each repo (root, `<skill>/`, or `skills/<skill>/` layouts), parses their
   frontmatter, and writes the catalog to `data/skills.json`.
2. **Display** — a Vite + React frontend (`src/fe`) fetches `data/skills.json` and
   renders a searchable list of skills.
3. **Automate** — GitHub Actions runs the scan daily and deploys the site to GitHub
   Pages whenever the data or frontend changes.

`data/skills.json` is the contract between scanner and frontend — see
[`data/README.md`](data/README.md) for its schema.

## Quick start

```bash
npm install

npm run scan       # scan repos and regenerate data/skills.json
npm run copy-data  # copy data/skills.json into src/fe/public/data/ for the frontend
npm run dev        # run the frontend locally
npm run build      # build the static site to dist/ (runs copy-data first)

npm test           # unit tests (vitest)
npm run test:e2e   # end-to-end tests (playwright)
npm run typecheck  # tsc --noEmit
```

`build` runs `copy-data` automatically; `dev` does not, so run `npm run copy-data`
once after a fresh scan before `npm run dev` picks up new data.

The scanner runs unauthenticated by default; set `GITHUB_TOKEN` to raise the API
rate limit:

```bash
GITHUB_TOKEN=ghp_xxx npm run scan
```

## Layout

```
src/scan/   scanner CLI — fetch repos, match layouts, parse frontmatter, write catalog
src/fe/     Vite + React frontend
data/       generated skills.json catalog (do not edit by hand)
docs/       architecture decision records and dev-team artifacts
```

## Configuring repos to scan

Edit `src/scan/repos.json`:

```json
[{ "owner": "anthropics", "repo": "skills" }]
```
