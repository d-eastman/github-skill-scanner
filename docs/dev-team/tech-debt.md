# Technical Debt Register
**Project:** GitHub Skill Scanner
**Owner:** Theo Okafor (Lead Developer)
**Last updated:** 2026-06-05 (fast-follow batch: TD-001, TD-003, TD-007, TD-008, TD-009 resolved)

---

| ID | Description | File | Severity | Notes |
|----|-------------|------|----------|-------|
| TD-001 | vitest < 4.1.0 has a CVE in the vitest UI server (GHSA-5xrq-8626-4rwp) | `package.json` | Low | **RESOLVED 2026-06-05** (with TD-009): upgraded to vitest 4.1.8. `npm audit` now reports 0 vulnerabilities. No config migration was required; all 69 unit tests pass under v4. |
| TD-002 | No retry button on error state | `src/fe/App.tsx` | Low | Accepted v1 scope decision (user-flows.md); add if error rates are observed post-launch |
| TD-003 | No Playwright e2e tests | `tests/e2e/` | Medium | **RESOLVED 2026-06-05**: added `@playwright/test`, `playwright.config.ts`, and `tests/e2e/catalog.spec.ts` (4 tests). Runs against `vite preview` at the real `/github-skill-scanner/` base path with a seeded fixture catalog. Covers the base-path data fetch (the "404-in-prod" regression), card rendering, real-time search + no-results state, and a real-browser copy (clipboard contents + 2s feedback revert). Run with `npm run test:e2e`. Not yet wired into CI — see new TD-010. |
| TD-004 | `console.log` analytics placeholder in CopyButton | `src/fe/components/CopyButton.tsx` | Low | Replace with real analytics tool in fast-follow sprint per success-metrics.md recommendation |
| TD-005 | Sequential per-repo scanning | `src/scan/index.ts` | Low | Sufficient for < 20 repos at daily frequency; add bounded concurrency if repo list grows significantly |
| TD-006 | No debounce on search input | `src/fe/components/SearchBar.tsx` | Low | Accepted at tens-to-hundreds catalog size per ADR-005; add if catalog grows to thousands of entries |
| TD-007 | Missing `aria-busy="true"` on list container during loading | `src/fe/App.tsx` | Low | **RESOLVED 2026-06-05**: added `aria-busy={status === "loading"}` to the `<section aria-label="Skill catalog">`. (Closes BUG-001.) |
| TD-008 | No fetch size limit on SKILL.md content (SEC-003) | `src/scan/limits.ts`, `src/scan/index.ts` | Medium | **RESOLVED 2026-06-05**: added `src/scan/limits.ts` (`MAX_CONTENT_BYTES` = 1 MB + `exceedsSizeLimit` helper) and wired it into `fetchRawContent` — rejects on the declared `Content-Length` before reading, and re-checks actual byte length after reading. Oversized files are skipped with a warning (entry emitted with null fields). 8 unit tests in `tests/scanner/limits.test.ts`. (Original note pointed at `fetcher.ts`, which never existed; the fetch lives in `index.ts`.) |
| TD-009 | vitest upgrade to v4 for CVE remediation (SEC-005) | `package.json` | Low | **RESOLVED 2026-06-05**: see TD-001 — upgraded to vitest 4.1.8, `npm audit` clean (0 vulnerabilities), no migration needed. |
| TD-010 | Playwright e2e not yet run in CI | `.github/workflows/` | Low | **RESOLVED 2026-06-05**: added reusable `verify.yml` (typecheck + unit + e2e via `npx playwright install --with-deps chromium` then `npm run test:e2e`), called by new `ci.yml` on every PR to main, and added as a `verify` gate job in `deploy.yml` (`build` now `needs: verify`). The base-path regression now fails CI on PRs and blocks deploy. YAML validated; `npm ci` + `npm run test:e2e` confirmed green from a clean install locally. Suggested follow-up: require the CI check in branch protection on main. |
