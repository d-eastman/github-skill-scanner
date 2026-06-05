# Workflow: New Project

> **Run it:** `/new-project <idea>` orchestrates these steps automatically — spawning each persona
> as a subagent, carrying artifacts between them, and pausing at each gate for your go/no-go. Run
> any single step with its persona command (`/ba`, `/architect`, …). The `Invoke:` examples below
> are the gist of what each step sends; all artifacts land in `docs/dev-team/`.

Use this workflow when starting a project from scratch or when beginning work on a significant new product or system.

---

## When to use this workflow

- Greenfield project with no existing codebase
- Significant new product area with its own data model, architecture, or user surface
- A rebuild or replacement of a major system component

---

## Workflow Steps

### Step 1 — Business Analyst: Stakeholder Interview + Requirements

**Who:** Priya Nair (BA)  
**Input:** Stakeholder (you), any existing documents, briefs, or prior art  
**Output:** Requirements Document + User Story Map

Invoke: "Act as Priya Nair, the Business Analyst. I want to build [description]. Interview me to understand what I actually need, then produce a Requirements Document."

The BA will:
- Ask structured questions to draw out the problem, goals, must-haves, nice-to-haves, constraints
- Synthesize existing documents if provided
- Produce a Requirements Document using the template in `team/templates/requirements.md`
- Flag open questions that block the next step

**Gate:** Requirements Document is final (or in Review with open questions documented)

---

### Step 2 — Solution Architect: Architecture Decision(s)

**Who:** Marcus Chen (Architect)  
**Input:** Requirements Document  
**Output:** One or more ADRs; System Diagram if warranted

Invoke: "Act as Marcus Chen, the Solution Architect. Read the requirements document and evaluate the architectural approaches for this system. Produce ADRs for the significant decisions."

The Architect will:
- Identify the significant architectural decisions (data storage, API design, integration points, deployment model)
- For each decision: evaluate options, name trade-offs, make a recommendation
- Produce ADRs using the template in `team/templates/adr.md`
- Flag any requirements that have unclear technical feasibility

**Gate:** ADRs are accepted by PM and Lead Developer

---

### Step 3 — Data Analyst: Define Success Metrics

**Who:** Ori Shapiro (Data Analyst)  
**Input:** Requirements Document, ADRs  
**Output:** Success Metrics Definition + Instrumentation Requirements

Invoke: "Act as Ori Shapiro, the Data Analyst. Read the requirements and tell me what success looks like in measurable terms, and what instrumentation we need before we ship."

Do this NOW — instrumentation defined after launch is mostly useless.

**Gate:** Success metrics and instrumentation requirements documented before Step 4

---

### Step 4 — Product Manager: Phase Plan + Backlog

**Who:** Sasha Kowalski (PM)  
**Input:** Requirements Document, ADRs, Success Metrics  
**Output:** Prioritized Backlog + Phase Plan

Invoke: "Act as Sasha Kowalski, the Product Manager. Given the requirements and architectural decisions, create a phase plan and prioritized backlog for building this system."

The PM will:
- Break the scope into phases with explicit gates and cut lines
- Prioritize the backlog
- Pre-agree on what gets cut if time runs out
- Document scope decisions in writing

**Gate:** Phase plan is agreed by team (or by you, acting as the team)

---

### Step 5 — UX Designer: User Flows (if user-facing)

**Who:** Lena Vasquez (UX Designer)  
**Input:** Requirements Document, User Story Map  
**Output:** User Flow Diagram + Annotated Wireframes

Invoke: "Act as Lena Vasquez, the UX Designer. Given these user stories, design the user flows and annotated wireframes for the primary features."

Skip this step if there is no user-facing interface.

**Gate:** Flows reviewed by Lead Developer for implementation feasibility

---

### Step 6 — Lead Developer: Technical Spec + Task Breakdown

**Who:** Theo Okafor (Lead Developer)  
**Input:** ADRs, Phase Plan, User Flows (if applicable)  
**Output:** Technical Spec + Task Breakdown

Invoke: "Act as Theo Okafor, the Lead Developer. Given the architectural decisions and phase plan, write a technical spec and break down the Phase 1 work into implementation tasks."

**Gate:** Technical spec is complete; Junior Developer (if involved) has reviewed tasks assigned to them

---

### Step 7 — DevOps: Infrastructure + CI/CD Setup

**Who:** Fia Magnusson (DevOps)  
**Input:** ADRs, Technical Spec  
**Output:** CI/CD Pipeline, Infrastructure as Code, Deployment Runbook

Invoke: "Act as Fia Magnusson, the DevOps Engineer. Given the architecture, set up the infrastructure and CI/CD pipeline for this project."

Do this early — don't build without a deploy path.

---

### Step 8 — QA: Test Plan

**Who:** Remy Dubois (QA)  
**Input:** Requirements Document, Technical Spec  
**Output:** Test Plan

Invoke: "Act as Remy Dubois, the QA Engineer. Given the requirements and technical spec, write a test plan for Phase 1."

The QA writes the test plan BEFORE the feature is built, not after. This surfaces ambiguities in the spec before they become bugs.

---

### Step 9 — Lead Developer + Junior Developer: Build

**Who:** Theo (Lead), Yuki (Junior)  
**Input:** Technical Spec, Task Breakdown, Test Plan  
**Output:** Code + PRs

Build in priority order. Lead reviews all PRs. Junior flags blockers early.

---

### Step 10 — QA: Testing + Bug Reports

**Who:** Remy (QA)  
**Input:** Deployed build, Test Plan  
**Output:** Completed Test Plan, Bug Reports

QA tests against the plan. Files bug reports using `team/templates/bug-report.md`. Provides quality risk assessment to PM.

---

### Step 11 — Security Reviewer: Security Audit (for auth / data handling)

**Who:** Dario Ferretti (Security)  
**Input:** Code, ADRs, Technical Spec  
**Output:** Security Review Report

Invoke when: auth is implemented, user data is stored, external API surfaces exist.

---

### Step 12 — Product Manager: Go/No-Go

**Who:** Sasha (PM)  
**Input:** QA quality risk assessment, Security review (if applicable)  
**Output:** Go/No-Go decision + Scope Decision Log

PM makes the call. Scope cuts are documented. Ship or delay is explicit.

---

## Persona Quick Reference

| Task | Command |
|------|---------|
| Requirements | `/ba` |
| Architecture | `/architect` |
| Scope + Backlog | `/pm` |
| Technical Spec | `/lead` |
| Implementation | `/lead` or `/junior` |
| Testing | `/qa` |
| Infrastructure | `/devops` |
| UX Flows | `/ux` |
| Security | `/security` |
| Metrics | `/data` |
| Everything, orchestrated | `/new-project` |
