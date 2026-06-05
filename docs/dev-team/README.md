# Dev Team Artifacts

This directory is the **single home for everything the AI dev team produces**. Personas write
their deliverables here and hand off to each other *by path* — so keeping this organized is what
makes the handoffs work. This file is the index; each persona updates it with a one-line pointer
when it produces something.

> Seeded by the software-dev-team toolkit. The table below is empty until the personas start
> producing artifacts in this project.

**New here?** See the worked example in [`examples/csv-export/`](examples/) — a complete
requirements → ADR → test plan → bug report chain for one small feature, showing what filled-in
artifacts look like and how the personas hand off.

## Naming conventions

| Artifact | Path | Produced by |
|----------|------|-------------|
| Requirements Document | `requirements.md` (or `requirements-<feature>.md` for a delta) | `/ba` |
| Architecture Decision Record | `adr-NNN-<short-title>.md` (zero-padded, never renumbered) | `/architect` |
| Success Metrics / Instrumentation | `success-metrics.md`, `instrumentation.md` | `/data` |
| Phase Plan / Backlog / Scope Log | `phase-plan.md`, `backlog.md`, `scope-decision-log.md` | `/pm` |
| User Flows | `user-flows.md` | `/ux` |
| Technical Spec | `tech-spec.md` | `/lead` |
| Tech Debt Register | `tech-debt.md` | `/lead` |
| Test Plan | `test-plan.md` | `/qa` |
| Bug Reports | `bug-reports/BUG-NNN.md` | `/qa` |
| Deployment Runbook | `deployment-runbook.md` | `/devops` |
| Security Review | `security-review.md` | `/security` |

## Index

*Personas: add a one-line pointer here when you create or significantly update an artifact.*

| Date | Artifact | Status | Summary |
|------|----------|--------|---------|
| 2026-06-04 | [`requirements.md`](requirements.md) | Approved | Full requirements for GitHub Skill Scanner v1 — scanner, data pipeline, and frontend |
| 2026-06-04 | [`adr-001-scanner-discovery-strategy.md`](adr-001-scanner-discovery-strategy.md) | Proposed | Discover SKILL.md via recursive Git Trees API; fixed layouts L1–L3 (root, `<skill>/`, `skills/<skill>/`) — resolves OQ-6 |
| 2026-06-04 | [`adr-002-data-schema-output-contract.md`](adr-002-data-schema-output-contract.md) | Proposed | Single `data/skills.json` envelope (`{metadata, skills}`) as the scanner↔frontend contract |
| 2026-06-04 | [`adr-003-data-serving-on-github-pages.md`](adr-003-data-serving-on-github-pages.md) | Proposed | Copy `data/` into Vite `public/`, fetch via `import.meta.env.BASE_URL` — resolves OQ-5 |
| 2026-06-04 | [`adr-004-cicd-pipeline-shape.md`](adr-004-cicd-pipeline-shape.md) | Proposed | Two workflows: scheduled scanner commits `data/` (PAT push triggers deploy); Pages deploy on data/code change |
| 2026-06-04 | [`adr-005-frontend-architecture.md`](adr-005-frontend-architecture.md) | Accepted | Single-page TypeScript React, local hook state, no router; TypeScript confirmed by stakeholder (amended) |
| 2026-06-04 | [`success-metrics.md`](success-metrics.md) | Draft | v1 success definition, Tier A health metrics (free, from metadata envelope + Actions), Tier B usage metrics (deferred), instrumentation asks, guardrails |
| 2026-06-04 | [`backlog.md`](backlog.md) | Active | Prioritized v1 backlog — 6 epics, 20 stories, MoSCoW tagged, mapped to must-haves and ADRs |
| 2026-06-04 | [`phase-plan.md`](phase-plan.md) | Active | 5-day phase plan with day-by-day sequence, critical path, 4 gates, cut line, and go/no-go criteria |
| 2026-06-04 | [`scope-decision-log.md`](scope-decision-log.md) | Active — updated UI-1 ship | 28 scope decisions: includes UI-1 ship (entry #28), SR-1 ship (entry #26), 3-repo scan list (entry #23) |
| 2026-06-04 | [`user-flows.md`](user-flows.md) | Ready for Lead review | Single-screen catalog: primary flow, annotated wireframe, all 5 states with microcopy, accessibility notes, heuristic check |
| 2026-06-04 | [`deployment-runbook.md`](deployment-runbook.md) | Active | One-time setup (PAT + Pages enable), scan-to-deploy trigger chain, manual run instructions, incident runbook (5 failure modes), observability |
| 2026-06-04 | [`tech-debt.md`](tech-debt.md) | Active | 9 items: TD-001 through TD-009; TD-007/008/009 added post-security review |
| 2026-06-04 | [`test-plan.md`](test-plan.md) | Complete | v1 full test plan — 83 test cases covering all 9 must-haves, 5 UI states, ADR-002 contract, a11y; 61 automated tests run and passed (58 + 3 SEC-001 regression tests); 1 bug filed |
| 2026-06-04 | [`bug-reports/BUG-001.md`](bug-reports/BUG-001.md) | Open (Backlog) | Low: aria-busy missing on list container during loading (TD-007) |
| 2026-06-04 | [`go-no-go.md`](go-no-go.md) | LAUNCHED 2026-06-05 | v1 live; SR-1 ship logged in scope-decision-log.md entry #26 |
| 2026-06-05 | [`requirements-scanned-repos.md`](requirements-scanned-repos.md) | Draft — pending OQ-SR-1 | Delta: non-intrusive scanned-repos indicator in header; surfaces A-vs-B interpretation question; 3 open questions for stakeholder and Architect |
| 2026-06-05 | [`adr-002-data-schema-output-contract.md`](adr-002-data-schema-output-contract.md) | Addendum (2026-06-05) | Resolves OQ-SR-3: `metadata.repos` confirmed additive (no `schemaVersion` bump); exact shape (2-value `status` enum + `skillCount`), sort by `repo`, always-present, presence-based frontend fallback |
| 2026-06-05 | [`requirements-ui-styling.md`](requirements-ui-styling.md) | Approved — UI-1 shipped | Dark-developer restyle with design-token system; CSS-only change; OQ-UI-1 resolved (system fonts); UI-1 ship decision entry #28 |
| 2026-06-05 | [`test-plan.md`](test-plan.md) — UI-1 section | Executed — all pass | Dark-developer restyle QA pass: 90/90 unit PASS, 12/12 e2e PASS (BUG-002 fixed), 0 vulns, all 9 contrast pairings PASS |
| 2026-06-05 | [`bug-reports/BUG-002.md`](bug-reports/BUG-002.md) | CLOSED — fixed | TC-163 e2e test defect (missing waitFor); one-line fix applied; e2e suite now 12/12 |
