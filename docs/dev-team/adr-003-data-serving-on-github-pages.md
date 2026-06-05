# Architecture Decision Record (ADR)
**ADR Number:** ADR-003
**Title:** Copy `data/skills.json` into the Vite build via `public/`, fetch with a base-path-aware URL
**Author:** Marcus Chen (Solution Architect)
**Date:** 2026-06-04
**Status:** Proposed

---

## Context

This resolves **OQ-5**: how does `data/skills.json` (committed at the repo root by the scanner, see
ADR-002/ADR-004) reach the **deployed** frontend on GitHub Pages?

The trap here is the **base path**. A GitHub Pages *project* site is served from
`https://<user>.github.io/<repo>/`, not the domain root. So a naive `fetch('/data/skills.json')`
resolves to `https://<user>.github.io/data/skills.json` — wrong, and it 404s **only in production**
while working fine on `localhost` in dev. This is exactly the "frontend loads but shows nothing"
risk flagged in requirements. We must make the fetch path correct under the project base path, and we
must make sure the data file is actually *present* in what Pages serves.

Two coupled questions: (1) where does the file physically end up in the deployed artifact, and
(2) what URL does the frontend fetch.

---

## Decision Drivers

1. **Correct in production, not just dev** — the failure mode is environment-specific, so the design
   must be base-path-safe by construction.
2. **Single origin, no CORS** — the data must be same-origin with the app (no auth, no cross-origin).
3. **Minimal moving parts** — one build, one deploy artifact; nothing to keep in sync by hand.
4. **`data/` stays the scanner's canonical output location** (per project context and ADR-002).

---

## Options Considered

### Option 1: Copy `data/skills.json` into Vite's `public/` at build time; fetch via `import.meta.env.BASE_URL`

The repo-root `data/skills.json` is the scanner's canonical output. At build time, a step copies it
to `src/fe/public/data/skills.json` (or symlink/import equivalent). Vite copies `public/` verbatim
into `dist/`, applying the configured `base`. The frontend fetches:

```js
const res = await fetch(`${import.meta.env.BASE_URL}data/skills.json`);
```

`BASE_URL` is `/` in dev and `/<repo>/` in production (set by Vite `base`), so the URL is correct in
both environments.

**Pros:**
- **Base-path-correct by construction** — `import.meta.env.BASE_URL` is exactly the mechanism Vite
  provides for this; works in dev and prod with one line.
- Same-origin, no CORS, no auth.
- `data/` remains the scanner's home; the copy is a build concern, not a data-model change.

**Cons:**
- Requires a copy step in the build (`vite build`) so `public/` has fresh data. Small and scriptable.
- The data is duplicated into `dist/` (by design — that's what gets served).

**Estimated effort:** Small

---

### Option 2: Import the JSON as a module (`import skills from '../../data/skills.json'`)

Let Vite bundle the JSON directly into the JS at build time.

**Pros:**
- No runtime fetch at all; no path/base-path issue; no loading/error state needed for the network.
- Type/shape is "guaranteed present" at build.

**Cons:**
- **Data is baked into the JS bundle** — every scan-driven data change requires a full frontend
  rebuild+redeploy (couples data freshness to a code build; see ADR-004's loop concern).
- Loses the clean "frontend reads a static JSON contract at runtime" model the requirements assume
  (must-have #6/#9 talk about *fetching* `data/skills.json`).
- Harder to reason about caching/versioning of the data independent of the app.

**Estimated effort:** Small

---

### Option 3: Fetch `data/` from the repo's raw/`main` URL (cross-origin)

Frontend fetches `https://raw.githubusercontent.com/<owner>/<repo>/main/data/skills.json` directly.

**Pros:**
- No copy step; always the latest committed data regardless of when the app was built.

**Cons:**
- **Cross-origin** (raw.githubusercontent.com) — CORS and reliability are not under our control;
  raw URLs are not a supported "API" and can be rate-limited/cached unpredictably.
- Adds an external dependency to a site whose whole point is to be a simple static artifact.

**Estimated effort:** Small

---

## Decision

**We will: Option 1 — copy `data/skills.json` into `public/` and fetch it with
`import.meta.env.BASE_URL`.**

This is the idiomatic Vite + GitHub Pages pattern and it is correct in both dev and production by
construction, which directly neutralizes the "works locally, 404s on Pages" risk. It keeps everything
same-origin (no CORS, no auth in the bundle, satisfying the security NFR) and preserves `data/` as the
scanner's canonical output. The cost is a trivial copy step in the build.

### Concretely
- **Vite config:** set `base: '/<repo-name>/'` for the production build (e.g. `base: '/github-skill-scanner/'`).
  Dev keeps the default `/`.
- **Build step:** before/within `npm run build`, copy repo-root `data/skills.json` ->
  `src/fe/public/data/skills.json`. (Mechanism — npm prebuild script, a tiny Node copy, or Vite
  `publicDir` pointing appropriately — is the Lead's/DevOps' call; the requirement is "fresh data
  lands in `dist/data/skills.json`".)
- **Fetch in the app:**
  ```js
  fetch(`${import.meta.env.BASE_URL}data/skills.json`)
  ```
  -> dev: `/data/skills.json`; prod: `/github-skill-scanner/data/skills.json`. Both correct.
- The deployed artifact therefore contains `dist/index.html`, hashed JS/CSS, and `dist/data/skills.json`,
  all served from the same Pages origin under the project base path.

---

## Consequences

### Positive
- One origin, one deploy artifact, no CORS, no secrets in the bundle.
- The dev/prod path discrepancy — the single most likely "silent empty page" bug — is designed out.
- Data and app ship together, so a deploy is always internally consistent.

### Negative
- The frontend's data is only as fresh as its **last build/deploy**, not the last *scan commit*. This
  is fine **as long as a data-only commit triggers a redeploy** — that coupling is handled in ADR-004.
- The copy step is one more thing in the build; keep it dumb and well-named.

### Neutral / Watch
- If `base` is ever wrong (repo renamed, custom domain added), the fetch breaks in prod only. Pin the
  base in one place and document it. A custom domain would make `base: '/'` correct again.
- Cache headers on Pages mean a freshly deployed `skills.json` may be briefly cached; acceptable for a
  daily-scan catalog. If staleness becomes an issue, append a cache-busting query (e.g. the
  `lastScanned` value) to the fetch URL.

---

## The Road Not Taken

**Bundling the JSON (Option 2)** was the runner-up — it removes the runtime fetch and its error
states entirely. We rejected it because it welds data freshness to a code rebuild and breaks the
clean runtime-contract model; we'd reconsider only if the data were truly static. **Raw-URL fetch
(Option 3)** loses on the cross-origin/external-dependency cost for a site whose value is being a
self-contained static artifact.

---

## Implementation Notes

- DevOps/Lead: the **deploy must include `dist/data/skills.json`** — verify against the *deployed*
  Pages URL, not just `npm run dev` (this is the explicit requirements risk).
- Keep `base` in `vite.config.js` and the fetch's use of `BASE_URL` as the *only* two places that know
  about the path; never hardcode `/github-skill-scanner/` in the app code.
- The fetch belongs behind explicit loading/empty/error states (ADR-005, must-haves #6/#7).

---

## Links

- `requirements.md` OQ-5; must-haves #6, #9; "wrong fetch URL" risk row
- ADR-002 (the file being served)
- ADR-004 (ensuring a data-only commit triggers a redeploy)
- ADR-005 (loading/empty/error handling around the fetch)
