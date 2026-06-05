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

---

## Addendum — 2026-06-05: `metadata.repos` (additive; configured-scan-list extension)

**Author:** Marcus Chen (Solution Architect)
**Resolves:** OQ-SR-3 in `requirements-scanned-repos.md` (Interpretation B).
**Status of this addendum:** Accepted as part of ADR-002. **No `schemaVersion` bump (stays `1`).**

### Why this is an amendment and not a new ADR

`metadata.repos` is a purely additive optional field. ADR-002's "Neutral / Watch" section already
declares the governing rule: *"Additive optional fields … do **not** bump the version"* and *"any
breaking change increments it and gets a **new** ADR that supersedes this one."* Recording an
additive field as an addendum to the contract it extends keeps a single source of truth — which is
exactly what that rule was written to enable. A separate ADR would only be warranted if this changed
or removed an existing field (it does not).

### The rule applied, and the verdict

**Rule:** A change is *additive* (no `schemaVersion` bump) if it neither removes, renames, retypes,
nor changes the meaning of any existing field — such that a frontend built against the prior schema
continues to read the file correctly by simply ignoring the new key.

**Verdict: ADDITIVE. `schemaVersion` remains `1`.** Adding `metadata.repos` introduces one new key
on `metadata`. Every v1 field (`lastScanned`, `repoCount`, `reposSucceeded`, `reposFailed`,
`skillCount`) and the entire `skills` array are untouched in name, type, and meaning. A v1 reader
ignores the new key and works unchanged.

### The exact shape of `metadata.repos`

The BA's proposed shape is **confirmed** (one clarification on the enum, below). Each element
describes one repo from `src/scan/repos.json` *as the scanner saw it at scan time*:

```ts
// Add to src/types/skills.ts:
export interface ScannedRepo {
  repo: string;        // "owner/repo" — same form as SkillEntry.repo
  repoUrl: string;     // canonical, no trailing slash — same construction as SkillEntry.repoUrl
  skillCount: number;  // skills found in THIS repo this run (0 for a clean scan with no skills)
  status: "succeeded" | "failed";
}

export interface SkillsMetadata {
  schemaVersion: number;
  lastScanned: string;
  repoCount: number;
  reposSucceeded: number;
  reposFailed: number;
  skillCount: number;       // unchanged — total across all repos == skills.length
  repos: ScannedRepo[];     // NEW — always present in scanner output (empty [] only if repos.json were empty)
}
```

```jsonc
"repos": [
  { "repo": "anthropics/skills",   "repoUrl": "https://github.com/anthropics/skills",   "skillCount": 5, "status": "succeeded" },
  { "repo": "someorg/empty-repo",  "repoUrl": "https://github.com/someorg/empty-repo",  "skillCount": 0, "status": "succeeded" },
  { "repo": "someorg/broken-repo", "repoUrl": "https://github.com/someorg/broken-repo", "skillCount": 0, "status": "failed" }
]
```

### Decisions on the open shape questions

1. **Is a 2-value `status` enum enough? Is the "scanned-but-no-skills vs failed" distinction
   preserved?** Yes, and yes — keep the 2-value enum. The scanner (`src/scan/index.ts`, `scanRepo`)
   already returns the two facts independently: `succeeded: true` with an empty skills array for a
   clean scan that found nothing (returns `{ skills: [], succeeded: true }`), versus
   `succeeded: false` for an error (could-not-determine-branch / could-not-fetch-tree paths).
   Mapping that onto `status` plus `skillCount` keeps both facts addressable:
   - **scanned, no skills:** `{ skillCount: 0, status: "succeeded" }`
   - **failed:** `{ status: "failed" }` (and `skillCount` is `0` because no tree was read)

   I considered a 3-value enum (`"succeeded" | "empty" | "failed"`) and **rejected it.** "Empty" is
   not an independent state — it is fully derived from `status === "succeeded" && skillCount === 0`.
   Encoding it in the enum would duplicate that fact, create a third state the scanner doesn't
   actually track, and risk the enum and `skillCount` disagreeing. The requirements
   (`requirements-scanned-repos.md` must-have #3, Interpretation B) call for exactly this
   distinction, and the 2-value form delivers it: the frontend shows `skillCount: 0` +
   `status: "succeeded"` with no warning, and visually distinguishes `status: "failed"`.

2. **Sort order.** `repos` is emitted sorted **ascending by `repo`** (the `owner/repo` string),
   case-sensitive — the same primary key and comparator style as the existing `skills` sort in
   `src/scan/writer.ts` (`compareSkills`). Note: the scanner currently iterates `repos.json` in
   *config* order; the writer must sort the assembled `repos` array by `repo` before writing, so git
   diffs stay stable regardless of config-file ordering. Matches `requirements-scanned-repos.md`
   must-have #3 (Interpretation B): "match scanner sort order from ADR-002."

3. **Always present?** **Yes — `repos` is always an array, never absent in newly-written files,**
   mirroring the `skills` always-array rule. An empty `repos.json` already throws at load
   (`src/scan/index.ts` `loadReposConfig`), so in practice `repos` has at least one element; but the
   *type* is a (possibly empty) array, never optional, in freshly-written output. This keeps the
   present-day frontend simple: when reading current data it can assume `metadata.repos` is an array.

### Frontend compatibility / fallback expectation

This is consistent with how I version the contract. The "always present" guarantee above applies to
**files written by the scanner from this addendum onward.** It does **not** retroactively rewrite
older `skills.json` files (a cached/older deploy, or a fixture from before this change), which have
no `repos` key at all. Because we deliberately did **not** bump `schemaVersion`, the frontend cannot
use the version number to tell old from new — so the field's *presence* is the signal:

- **`metadata.repos` present (array):** use it directly as the configured scan list
  (Interpretation B). Do not re-derive from `skills[]`.
- **`metadata.repos` absent (`undefined`):** degrade gracefully — either hide the repos indicator or
  fall back to the Interpretation-A derivation `[...new Set(skills.map(s => s.repo))]`. No crash, no
  `undefined.length`.

This "read by presence, not by version" defensiveness is the correct pattern *precisely because* the
change is additive: additive fields are optional from the reader's point of view, so the reader must
treat them as optional. That is the symmetric obligation that lets us avoid the `schemaVersion` bump.
The field should therefore be modeled to the frontend as optional at the read boundary
(`metadata.repos?: ScannedRepo[]`, or a `Array.isArray(metadata.repos)` guard before use) even though
the scanner always writes it. The shared-type mechanics — one always-written interface vs. a
reader-side optional — are the Lead's call; the contract obligation is fixed:
**scanner always writes `repos`; frontend never assumes it is present.**

### Invariants (scanner-enforced, single write site `src/scan/writer.ts`)

These let the frontend trust `metadata.repos` without re-deriving from `skills[]`:

- `repos.length === metadata.repoCount`
- `count(repos[].status === "succeeded") === metadata.reposSucceeded` (and likewise `failed`)
- `sum(repos[].skillCount) === metadata.skillCount === skills.length`
- `status === "failed"` implies `skillCount === 0`

Assert these in the writer the same way `skillCount === skills.length` is already asserted
(`writeCatalog` invariant check).

### Consequences of this addendum

- **Positive:** UI shows the true configured scan scope incl. zero-skill and failed repos with no new
  fetch and no breaking change; the per-repo data the scanner already tracks gets a documented home.
- **Negative / watch:** A further set of counts must stay in sync — `repos[]` entries and their
  `status`/`skillCount` must agree with `repoCount`/`reposSucceeded`/`reposFailed`/`skillCount`.
  Single write site, low risk; covered by the invariants above.
- **Neutral:** If a future need *does* require breaking `repos` (e.g. renaming `status` values), that
  is a new ADR that supersedes this one and bumps `schemaVersion` — unchanged from the base policy.
