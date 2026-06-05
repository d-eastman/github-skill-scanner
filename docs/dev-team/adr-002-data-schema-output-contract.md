# Architecture Decision Record (ADR)
**ADR Number:** ADR-002
**Title:** Single `data/skills.json` with a top-level metadata object as the scanner↔frontend contract
**Author:** Marcus Chen (Solution Architect)
**Date:** 2026-06-04
**Status:** Proposed

---

## Context

`data/skills.json` is the **contract between the two halves of the system**: the scanner writes it,
the frontend reads it. Getting this shape right and stable matters more than almost any other
decision here, because both sides are built against it this week and any churn ripples to both.

Requirements fix the fields (must-have #3, OQ-1): per skill we need `name` and `description` (from
frontmatter), `skillName` (directory-derived, drives the install command), `repo` (`owner/repo`),
`repoUrl`, and `path`. Two shape questions are open: (a) a bare array vs. an envelope with metadata
(the "last scanned" nice-to-have and counts want a home), and (b) a single aggregate file vs.
per-repo files (nice-to-have #5).

---

## Decision Drivers

1. **Stability** — both halves code against this now; changing it later is expensive.
2. **One fetch on the frontend** — the catalog is small (tens to low-hundreds of skills); a single
   request keeps load simple and fast (NFR: render < 2s).
3. **Room for the cheap nice-to-haves** without a breaking change (last-scanned timestamp, counts).
4. **Tolerant of missing data** — malformed/absent frontmatter must yield `null` fields, not a crash
   or a missing entry (must-have #3 acceptance).

---

## Options Considered

### Option 1: Bare top-level array (`[ {skill}, {skill}, ... ]`)

`skills.json` is just an array of skill objects.

**Pros:**
- Simplest possible shape; frontend does `data.map(...)` directly.

**Cons:**
- **No place for metadata** — the last-scanned timestamp and counts have nowhere to live, so the
  low-effort nice-to-haves (#3 display, debugging counts) force a later breaking change.
- An empty scan is `[]`, which is fine, but you can't distinguish "scanned, found nothing" from
  "never scanned" without a timestamp.

**Estimated effort:** Small

---

### Option 2: Envelope object — metadata + skills array

`skills.json` is `{ metadata: {...}, skills: [...] }`.

**Pros:**
- Carries `lastScanned`, counts, and version alongside the data — the nice-to-haves come for free.
- Versioned (`schemaVersion`) so future changes are detectable rather than silent.
- Still a single fetch; frontend reads `data.skills` and `data.metadata`.

**Cons:**
- One extra level of nesting (trivial).

**Estimated effort:** Small

---

### Option 3: Per-repo files (`data/<owner>__<repo>.json`) ± an index

Each repo's skills in its own file, optionally with an aggregate index.

**Pros:**
- Easier to eyeball a single repo's output when debugging (nice-to-have #5).
- Smaller diffs per repo in git history.

**Cons:**
- **Frontend would need N fetches or a separate index file** to assemble the catalog — more code,
  more failure modes, for no user benefit at this scale.
- Two write paths in the scanner; two things to keep consistent.

**Estimated effort:** Medium

---

## Decision

**We will: Option 2 — a single `data/skills.json` envelope** (`{ metadata, skills }`).

A single file means the frontend does exactly one fetch (ADR-003) and renders. The envelope gives the
timestamp/counts/version a permanent home, so the last-scanned and debugging nice-to-haves don't
require a breaking schema change later. Per-repo files (Option 3) are a debugging convenience we can
add **additively** as nice-to-have #5 without touching this contract, so we don't pay for them now.

### The schema (v1)

```jsonc
{
  "metadata": {
    "schemaVersion": 1,            // bump on any breaking change to this shape
    "lastScanned": "2026-06-04T08:00:00Z", // ISO 8601 UTC; when the scan completed
    "repoCount": 12,               // repos in config attempted this run
    "reposSucceeded": 11,          // repos that returned a tree (whether or not they had skills)
    "reposFailed": 1,              // repos skipped due to error (see must-have #2)
    "skillCount": 34               // == skills.length; convenience for the UI footer
  },
  "skills": [
    {
      "name": "Frontend Design",          // frontmatter `name`; null if missing/malformed
      "description": "Helps build...",     // frontmatter `description`; null if missing/malformed
      "skillName": "frontend-design",      // directory-derived; the --skill value (never null)
      "repo": "anthropics/skills",         // owner/repo
      "repoUrl": "https://github.com/anthropics/skills", // canonical, no trailing slash
      "path": "frontend-design/SKILL.md"   // path within the repo of the matched SKILL.md
    }
    // ...one object per discovered skill
  ]
}
```

### Rules
- `skills` is **always an array** (empty `[]` on a zero-skill scan — never an absent file; must-have #4).
- `name` and `description` are `null` when frontmatter is missing/malformed; the scanner logs a
  warning but still emits the entry (must-have #3). `skillName`, `repo`, `repoUrl`, `path` are always
  present (they derive from discovery, not from file content).
- `repoUrl` is **canonical and trailing-slash-free** so the frontend can build the install command by
  string-concatenation with confidence (`npx skills add <repoUrl> --skill <skillName>`, must-have #8).
- **Sort order:** scanner emits `skills` sorted by `repo`, then `skillName`, so git diffs are stable
  and don't churn on reordering (keeps CI commits meaningful — see ADR-004).
- **`skillName` uniqueness is not globally guaranteed** (two repos can both have `pdf`). The frontend
  must key list items on `repo + "/" + path`, not on `skillName` alone.

---

## Consequences

### Positive
- One fetch, one parse, render. Frontend stays minimal.
- Timestamp, counts, and `schemaVersion` are available without a future breaking change.
- `null`-tolerant fields satisfy the "don't crash on bad frontmatter" requirement cleanly.

### Negative
- The frontend must read `data.skills` rather than treating the file as a bare array (minor).
- Counts in `metadata` must be kept in sync with the actual array by the scanner (single write site,
  low risk).

### Neutral / Watch
- `schemaVersion` is the escape hatch: any breaking change increments it and gets a **new** ADR that
  supersedes this one. Additive optional fields (e.g. `tags`, `author` for nice-to-have #1/#2) do
  **not** bump the version.
- Per-repo files (nice-to-have #5) can be added later writing to `data/repos/<owner>__<repo>.json`
  without altering `skills.json`.

---

## The Road Not Taken

**Bare array (Option 1)** was the runner-up for sheer simplicity; we rejected it because it has no
home for the timestamp/counts and would force a breaking change the moment we want the (already
requested) last-scanned display. **Per-repo files (Option 3)** lose to "one fetch on the frontend";
we'd add them as a debugging supplement, not as the primary contract, if scans get hard to diagnose.

---

## Implementation Notes

- Lead: treat this file as the **single source of truth for the contract**. If a field needs to
  change, that's an ADR, not a quiet edit.
- The frontend should defensively default `name`/`description` to a placeholder at render time (the
  data can legitimately contain `null`).
- Frontmatter parsing: a small, dependency-light YAML frontmatter parser is appropriate (e.g.
  `gray-matter` or a minimal hand-rolled `---`-fence split + YAML parse). Dependency choice is the
  Lead's call; the contract above is what matters.
- Document this schema inline in `data/` (a short `data/README.md` or header comment) per must-have #4
  acceptance, pointing back to this ADR.

---

## Links

- `requirements.md` must-have #3, #4; nice-to-haves #3, #5; OQ-1
- ADR-001 (how each entry is discovered)
- ADR-003 (how the frontend fetches this file)
- ADR-005 (how the frontend renders it)
