# Technical Debt Register
**Project:** GitHub Skill Scanner
**Owner:** Theo Okafor (Lead Developer)
**Last updated:** 2026-06-04 (updated post-security review: SEC-003, SEC-005 logged)

---

| ID | Description | File | Severity | Notes |
|----|-------------|------|----------|-------|
| TD-001 | vitest < 4.1.0 has a CVE in the vitest UI server (GHSA-5xrq-8626-4rwp) | `package.json` | Low | Only affects `vitest ui` which we do not run; `vitest run` is safe. Upgrade to vitest 4 is a breaking change requiring API migration. Upgrade after v1 ships. |
| TD-002 | No retry button on error state | `src/fe/App.tsx` | Low | Accepted v1 scope decision (user-flows.md); add if error rates are observed post-launch |
| TD-003 | No Playwright e2e tests | `tests/e2e/` | Medium | Phase plan cut-line item; fast-follow immediately after launch |
| TD-004 | `console.log` analytics placeholder in CopyButton | `src/fe/components/CopyButton.tsx` | Low | Replace with real analytics tool in fast-follow sprint per success-metrics.md recommendation |
| TD-005 | Sequential per-repo scanning | `src/scan/index.ts` | Low | Sufficient for < 20 repos at daily frequency; add bounded concurrency if repo list grows significantly |
| TD-006 | No debounce on search input | `src/fe/components/SearchBar.tsx` | Low | Accepted at tens-to-hundreds catalog size per ADR-005; add if catalog grows to thousands of entries |
| TD-007 | Missing `aria-busy="true"` on list container during loading | `src/fe/App.tsx` | Low | user-flows.md notes it; not in numbered acceptance criteria; adds polish for screen reader users announcing busy state — add in a11y fast-follow |
| TD-008 | No fetch size limit on SKILL.md content (SEC-003) | `src/scan/fetcher.ts` | Medium | Security reviewer finding SEC-003: a maliciously large SKILL.md could cause memory pressure or OOM on the Actions runner. Add a maximum byte limit (e.g. 1 MB) and reject/skip files that exceed it. PM-triaged fast-follow; not blocking Go/No-Go. |
| TD-009 | vitest upgrade to v4 for CVE remediation (SEC-005) | `package.json` | Low | Security reviewer finding SEC-005 references the same vitest CVE as TD-001 (GHSA-5xrq-8626-4rwp). TD-001 documents the risk acceptance. Upgrade post-v1 as a dedicated task once the v4 migration guide is reviewed. |
