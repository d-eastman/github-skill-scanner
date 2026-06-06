# Requirements Delta: GitHub Enterprise Server (GHES) Support
**Project:** GitHub Skill Scanner
**Author:** Priya Nair (Business Analyst)
**Date:** 2026-06-05
**Status:** Draft — pending resolution of OQ-GHE-1 (public exposure) and OQ-GHE-2 (network reachability) before Architect engagement
**Type:** Feature delta — extends `requirements.md` v1; does not restate unchanged requirements

---

## Scope (one line)

Parameterize the scanner to target a single GitHub Enterprise Server (GHES) host instead of github.com, using a dedicated PAT for that host, so internal enterprise repositories are scannable from CI.

---

## Problem Statement

The current scanner hard-codes github.com as its API base, raw-content host, and `repoUrl` template. An enterprise team running their own GHES instance at `https://github.<COMPANY>.com` cannot use the scanner without code changes: the API endpoint differs, raw content is served from the GHES host (not `raw.githubusercontent.com`), the `repoUrl` must point at the GHES host, and authentication requires a PAT issued by the GHES instance (github.com tokens are rejected).

This delta defines what must change to support a single GHES deployment target.

---

## Fixed Inputs (stakeholder decisions — not up for re-litigation)

| Decision | Value |
|----------|-------|
| Deployment mode | Enterprise-only — one GHES host; this is not a mixed github.com + enterprise catalog |
| Host count | Exactly one GHES host per deployment |
| PAT model | One dedicated PAT issued by the GHES instance, stored as a separate Actions secret |
| Network reachability | UNKNOWN — treat as a blocking assumption (see Risk 1 below) |
| github.com backward compatibility | Optional implementation nicety — noted here but not required |

---

## HEADLINE RISKS

These are not ordinary risks. They may change whether this feature can be built as described, or whether the project itself should proceed without resolving them first. Both require a stakeholder decision before the Architect begins design.

### RISK 1 — CI Network Reachability (possibly blocking)

**Severity: Potentially blocking.**

GitHub.com-hosted Actions runners run on Microsoft Azure. If `https://github.<COMPANY>.com` is behind a corporate VPN, firewall, or private network, a github.com runner cannot reach it. The scheduled scanner will fail on every API call — silently appearing to succeed at the workflow level while returning no skills.

The stakeholder has confirmed this is UNKNOWN.

**If the GHES host is NOT publicly reachable from github.com runners:** a self-hosted Actions runner deployed inside the corporate network is required. This changes the CI/CD setup substantially (runner infrastructure, maintenance, security posture). It is not a scanner code change — it is an infrastructure prerequisite.

**This must be confirmed before the Architect designs the CI/CD approach.** See OQ-GHE-2.

### RISK 2 — Public Data Exposure (possibly unacceptable)

**Severity: Potentially a blocker or a redesign trigger. Flag to stakeholder immediately.**

The current deploy target is a PUBLIC GitHub Pages site (confirmed in `team/project-context.md` and `requirements.md`). The scanner commits `data/skills.json` to `main` and the Pages site serves it to the open internet.

If the scanner is pointed at an internal GHES instance, the following data will be published publicly:

- Internal repository names and owners
- Skill names (which may reveal internal tooling, codenames, or projects)
- Skill descriptions (which may contain confidential or proprietary information)
- The GHES host domain itself (`github.<COMPANY>.com`)

This may be unacceptable under enterprise security or compliance policies. It is not a scanner concern — it is a deploy-target and access-model concern.

**Possible mitigations (for stakeholder and Architect to evaluate — not requirements at this time):**

- Deploy to GitHub Enterprise's internal Pages (if the GHES instance supports it) so the site is access-gated
- Deploy to an auth-gated internal host (e.g. an internal static hosting service, Nginx behind SSO)
- Restrict the repo list to skills that are approved for public disclosure and scan only those
- Accept the exposure (if all scanned content is intentionally public)

**The stakeholder must decide whether public exposure of enterprise catalog content is acceptable before this feature is built.** See OQ-GHE-1.

---

## What Changes vs. What Stays the Same

### What changes

| Area | Current behavior | Required behavior |
|------|-----------------|------------------|
| API base URL | Hard-coded `https://api.github.com` in `src/scan/client.ts` | Configurable; for GHES must be `https://github.<COMPANY>.com/api/v3` |
| Raw content URL | Hard-coded `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>` in `src/scan/index.ts` | For GHES: `https://github.<COMPANY>.com/raw/<owner>/<repo>/<branch>/<path>` (or via the Contents API on the api/v3 base — Architect to confirm exact path) |
| `repoUrl` construction | Hard-coded `https://github.com/<owner>/<repo>` in `src/scan/index.ts` | Must use the configured GHES host: `https://github.<COMPANY>.com/<owner>/<repo>` |
| Token source | `process.env.GITHUB_TOKEN` | A separate env var for the GHES PAT (e.g. `process.env.GHES_TOKEN` or a configurable name — Architect to decide) |
| Actions secret | `SCAN_PAT` | A new dedicated secret for the GHES PAT (e.g. `GHES_SCAN_PAT`) — the github.com PAT and GHES PAT must not be conflated |
| Config file (`repos.json`) | `{owner, repo}` pairs implicitly targeting github.com | Must carry the GHES host so the scanner knows which API base, raw URL, and token to use. The exact shape is the Architect's decision; the requirement is that the config is the source of truth for the host |
| `repoUrl` in `data/skills.json` | Always `https://github.com/<owner>/<repo>` | Must be `https://github.<COMPANY>.com/<owner>/<repo>` for GHES-sourced skills |
| Install command in frontend | `npx skills add https://github.com/<owner>/<repo> --skill <name> ...` | Must use the GHES `repoUrl` — the install command points at the GHES host, not github.com |
| `deploy.yml` / `scan.yml` | Single PAT secret (`SCAN_PAT`) | Scan workflow must inject the GHES PAT into the scanner process; the git-commit/push step continues to use the existing repo write PAT |

### What stays the same

| Area | Notes |
|------|-------|
| Discovery algorithm | The Git Trees API is a standard GitHub REST API endpoint; GHES exposes the same endpoint at `/api/v3`. No change to the L1/L2/L3 layout matching rules, `matchSkillPath`, or `parseFrontmatter`. ADR-001 is unaffected. |
| Data schema | `data/skills.json` envelope (`{metadata, skills}`) is unchanged. `SkillEntry`, `ScannedRepo`, `SkillsMetadata`, `SkillsCatalog` types are unchanged. ADR-002 is unaffected. |
| Frontend behavior | Search, copy-install-command, card display, empty/error states are unchanged. The `repoUrl` field already drives the install command — no frontend logic change is needed if `repoUrl` is correct in the data. |
| Frontmatter parsing | Unchanged. |
| Error handling model | Per-repo fail-soft behavior, exit-nonzero-only-if-all-fail policy, and rate-limit logging are unchanged. |
| `data/` output path and deploy to Pages | Unchanged — unless Risk 2 (public exposure) forces a different deploy target, which is a stakeholder decision outside this delta. |
| Scanner 60-second performance target | Unchanged. |

---

## Must-Haves (delta only)

**GHE-1 — Host-parameterized API base**
The scanner must derive its API base URL from configuration rather than hard-coding github.com. For a GHES deployment, all GitHub REST API calls must go to `https://github.<COMPANY>.com/api/v3/...`.

Acceptance criteria:
- Given a configured GHES host `github.<COMPANY>.com`, every call the scanner makes to the GitHub REST API uses `https://github.<COMPANY>.com/api/v3/` as the base.
- No API calls go to `https://api.github.com` when the scanner is configured for a GHES host.
- The API base URL is derived from the configured host, not duplicated or independently set.

**GHE-2 — Host-parameterized raw content URL**
The scanner must fetch raw SKILL.md content from the GHES host, not from `raw.githubusercontent.com`.

Acceptance criteria:
- Given a configured GHES host, raw content fetches use `https://github.<COMPANY>.com/raw/<owner>/<repo>/<branch>/<path>` (or the equivalent Contents API endpoint on the GHES api/v3 base — Architect to confirm the exact raw URL for GHES; this requirement is for the outcome, not the exact URL form).
- No raw content requests go to `raw.githubusercontent.com` when the scanner is configured for a GHES host.

**GHE-3 — Host-parameterized `repoUrl`**
The scanner must construct `repoUrl` using the configured GHES host.

Acceptance criteria:
- For a skill discovered in repo `<owner>/<repo>` on a GHES host `github.<COMPANY>.com`, the emitted `repoUrl` in `data/skills.json` is exactly `https://github.<COMPANY>.com/<owner>/<repo>` (no trailing slash).
- The frontend's copy-to-clipboard install command reads `npx skills add https://github.<COMPANY>.com/<owner>/<repo> --skill <skillName> -a github-copilot -y` — i.e., the install command points at the GHES host.
- Repo links on skill cards in the frontend open `https://github.<COMPANY>.com/<owner>/<repo>`.

**GHE-4 — Per-host PAT, separate from the github.com PAT**
The scanner must authenticate to the GHES instance using a PAT issued by that GHES instance, stored as a dedicated Actions secret distinct from the existing `SCAN_PAT`.

Acceptance criteria:
- The GHES PAT is read from a separate environment variable / Actions secret (not `GITHUB_TOKEN` or `SCAN_PAT`).
- A github.com token is never sent to the GHES API endpoint, and the GHES token is never sent to `api.github.com`.
- If the GHES PAT is absent, the scanner logs a warning (matching the existing unauthenticated-fallback behavior in `client.ts`) and proceeds without auth. This mirrors current behavior and does not introduce a new hard failure mode.
- The Actions secret name is documented in the runbook.

**GHE-5 — Host carried in config**
The scanner configuration must carry the GHES host so that the scanner can construct all URLs (API base, raw content, `repoUrl`) from a single source of truth.

Acceptance criteria:
- Adding repos to the config for scanning does not require editing scanner source code — only the config file changes.
- The config is the single place where the GHES host is specified. No second place in the codebase holds the host independently.
- The exact config shape (whether a top-level `host` field in `repos.json`, a separate env var, or another mechanism) is the Architect's decision. This requirement fixes the outcome: one place to change the host.

---

## Nice-to-Haves (delta only)

**GHE-N1 — github.com backward compatibility**
The scanner could retain github.com as the default when no GHES host is configured, so the same codebase serves both deployment modes. This is an implementation nicety — it is not required for the enterprise-only deployment target.

Notes: if implemented, this requires the Architect to ensure the token routing is unambiguous (a GHES PAT must never be sent to github.com). Route to Architect for feasibility.

---

## Out of Scope

- Multi-host mixed catalog — scanning both github.com repos and GHES repos in a single scan run is explicitly out of scope. One host per deployment.
- SSO/SAML authentication flows — PAT-based auth only. GHES SSO (OAuth app authorization) is not addressed.
- Changing the discovery algorithm — L1/L2/L3 layout matching, the Git Trees API approach, and per-repo fail-soft behavior are unchanged.
- Self-hosted runner provisioning — if the GHES host requires a self-hosted runner (Risk 1), runner infrastructure setup is a separate concern outside this requirements delta.
- Changes to the deploy target or access model — if Risk 2 (public exposure) forces a move away from public GitHub Pages, that is a separate stakeholder and architecture decision not scoped here.

---

## Acceptance Criteria (end-to-end)

Given a scanner configured for GHES host `github.<COMPANY>.com`:

1. The scanner calls `https://github.<COMPANY>.com/api/v3/repos/<owner>/<repo>` to get the default branch — not `https://api.github.com`.
2. The scanner calls `https://github.<COMPANY>.com/api/v3/repos/<owner>/<repo>/git/trees/<branch>?recursive=1` to get the repo tree.
3. Raw SKILL.md content is fetched from `https://github.<COMPANY>.com/raw/<owner>/<repo>/<branch>/<path>` (or equivalent GHES raw endpoint).
4. Each skill entry in `data/skills.json` has `repoUrl: "https://github.<COMPANY>.com/<owner>/<repo>"`.
5. The copy-install-command on the frontend reads `npx skills add https://github.<COMPANY>.com/<owner>/<repo> --skill <skillName> -a github-copilot -y`.
6. Repo links on skill cards open `https://github.<COMPANY>.com/<owner>/<repo>`.
7. No API request is sent to `api.github.com` during a GHES-configured scan run.
8. No request carrying the GHES PAT is sent to any host other than `github.<COMPANY>.com`.
9. The GHES PAT is sourced from a dedicated Actions secret, distinct from `SCAN_PAT`.
10. All existing behavior for error handling (fail-soft per repo, exit non-zero only if all repos fail, rate-limit logging) is preserved unchanged.

---

## Open Questions (blocking — for orchestrator to take to stakeholder and Architect)

| # | Question | Who must decide | Why it blocks | Best guess / context |
|---|----------|-----------------|---------------|----------------------|
| OQ-GHE-1 | **Is publishing enterprise SKILL.md content (repo names, skill names, descriptions) on a public GitHub Pages site acceptable?** The current deploy target is public. GHES-sourced content is likely internal. This may violate security or compliance requirements. If not acceptable, a different deploy target (internal Pages, auth-gated host) must be defined — which may be a larger project change than the scanner code itself. | Stakeholder (with input from enterprise security policy) | Determines whether the current deploy pipeline can be used at all, or whether a parallel deploy redesign is required before a single line of scanner code changes | No best guess. This is a policy question. High probability it is unacceptable for most enterprise environments. |
| OQ-GHE-2 | **Is `https://github.<COMPANY>.com` reachable from GitHub.com-hosted Actions runners?** If yes, the existing runner infrastructure works. If no, a self-hosted runner inside the corporate network is required before any scan can succeed. | Stakeholder (must test or confirm with their network/security team) | If a self-hosted runner is needed, the CI/CD design changes substantially. The Architect cannot finalize the pipeline design without this answer. | Stakeholder is unsure. Network reachability from public cloud (Azure) to an enterprise host is frequently blocked. Assume not reachable until confirmed otherwise. |
| OQ-GHE-3 | **What is the exact raw file URL format on this GHES instance?** The current scanner uses `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>`. GHES typically serves raw content at `https://github.<COMPANY>.com/raw/<owner>/<repo>/<branch>/<path>` but this can vary by GHES version and configuration. Alternatively, raw content can be fetched via the Contents API (`/api/v3/repos/<owner>/<repo>/contents/<path>`), which avoids the raw URL question. | Architect (to validate against GHES documentation for the target version, and/or stakeholder to test against their instance) | Determines GHE-2 implementation approach. Wrong URL = silent empty scan (fetch fails, scanner skips file). | Contents API is a safe fallback if the raw URL is uncertain — it is on the same api/v3 base as the other calls and requires no separate URL template. Flag to Architect. |
| OQ-GHE-4 | **What Actions secret name should the GHES PAT use, and does the GHES PAT also serve as the git-commit/push credential, or is a separate write token needed?** In the current setup, `SCAN_PAT` does double duty: GitHub API reads AND git push to this repo. If the GHES PAT is read-only (scoped to the GHES instance only), a separate write credential for pushing `data/skills.json` to this repo may still be needed. | Architect (pipeline design) with stakeholder confirmation on secret naming | Affects both the Actions workflow design and the runbook instructions. Cannot finalize `scan.yml` GHES changes without this answer. | Likely: GHES PAT = read-only on the GHES instance; existing `SCAN_PAT` = write on this repo. Two secrets, different scopes. But the Architect should confirm and document. |

---

## Assumptions (this delta)

- SKILL.md layout conventions (L1/L2/L3) and frontmatter format are the same on GHES as on github.com. (No evidence to the contrary; confirm with stakeholder if GHES-hosted repos use non-standard layouts.)
- The GHES instance exposes the same GitHub REST API v3 surface used by the scanner (Git Trees API, Repo info endpoint). This is standard for GHES but should be verified against the actual GHES version in use.
- The existing `data/skills.json` schema (ADR-002) requires no changes for GHES-sourced content. `repoUrl` is already a full URL string — pointing it at the GHES host is a value change, not a type or schema change.
- The frontend's install command and repo links are already driven by `repoUrl` from the data — no frontend logic changes are needed beyond ensuring `repoUrl` is correctly populated.

---

## Stakeholder Sign-Off

| Name | Role | Status | Date |
|------|------|--------|------|
| — | — | Pending — OQ-GHE-1 and OQ-GHE-2 must be resolved first | — |
