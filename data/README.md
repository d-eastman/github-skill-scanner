# data/skills.json — Schema Documentation

This directory contains the output of the GitHub Skill Scanner.

**The file `data/skills.json` is the contract between the scanner and the frontend.**
Do not edit it by hand. It is written by `npm run scan` and committed by the `scan.yml`
GitHub Actions workflow.

See `docs/dev-team/adr-002-data-schema-output-contract.md` for the full architectural decision.

---

## Schema (v1)

```jsonc
{
  "metadata": {
    "schemaVersion": 1,           // Integer. Bump on any breaking change to this shape.
    "lastScanned": "2026-06-04T08:00:00Z", // ISO 8601 UTC. When the scan completed.
    "repoCount": 1,               // Repos in repos.json attempted this run.
    "reposSucceeded": 1,          // Repos that returned a tree (with or without skills).
    "reposFailed": 0,             // Repos skipped due to error (404, network, rate limit).
    "skillCount": 5               // == skills.length. Convenience for the UI.
  },
  "skills": [
    {
      "name": "Frontend Design",          // string | null. From YAML frontmatter `name`.
      "description": "Helps build...",    // string | null. From YAML frontmatter `description`.
      "skillName": "frontend-design",     // string. Directory-derived; never null. The --skill value.
      "repo": "anthropics/skills",        // string. "owner/repo".
      "repoUrl": "https://github.com/anthropics/skills", // string. No trailing slash.
      "path": "frontend-design/SKILL.md" // string. Repo-relative path of the SKILL.md.
    }
  ]
}
```

## Field rules

- `skills` is **always an array** — even when zero skills are found (never an absent file).
- `name` and `description` may be **null** when frontmatter is missing or malformed. The frontend
  must handle null defensively.
- `skillName` is **never null** — derived from the directory name, or the repo name for a
  root-level `SKILL.md`.
- `repoUrl` has **no trailing slash** — safe to append `--skill {skillName}` by concatenation.
- Skills are **sorted by `repo`, then `skillName`** for stable git diffs.
- `skillName` is **not globally unique** — two repos may have the same skillName. Key list items
  on `repo + '/' + path`.

## Install command format

```
npx skills add {repoUrl} --skill {skillName}
```

Example:
```
npx skills add https://github.com/anthropics/skills --skill frontend-design
```

## Discovery layouts (SKILL.md paths that qualify)

| Layout | Path shape | skillName source |
|--------|-----------|-----------------|
| L1 | `SKILL.md` (repo root) | repo name |
| L2 | `<skill>/SKILL.md` | directory name |
| L3 | `skills/<skill>/SKILL.md` | sub-directory name |

Paths deeper than 3 segments are not matched by design. See ADR-001.
