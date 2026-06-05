# Phase Plan
**Project:** [Project name]  
**Phase:** [Phase number and name — e.g., "Phase 1: Core Authentication"]  
**Author:** Sasha Kowalski (Product Manager)  
**Date:** [Date]  
**Target duration:** [e.g., "3 weeks — [Start date] to [End date]"]

---

## Phase Goal

[One clear sentence: what does it mean for this phase to be done? Not a list of features — a state of the world.]

---

## Non-Negotiables (The Hills)

[What each persona is willing to fight for in this phase. Named in advance so the team can push back when pressure comes. These are the things that won't be cut without a team conversation.]

- **PM:** [e.g., "Ships by [date] — runway doesn't allow slippage"]
- **Architect:** [e.g., "Auth tokens are never stored in localStorage — this is a security line"]
- **Lead Dev:** [e.g., "No merge without passing CI — we don't ship broken builds"]
- **QA:** [e.g., "Happy path must be tested before any merge to main"]
- **[Other persona]:** [Their hill]

---

## Must-Do Work (Priority Order)

[Ordered list. Higher = more critical to the phase goal. If time runs out, items at the bottom are cut first.]

1. **[Work item]** — Owner: [Persona] — Depends on: [Work item N if applicable]
2. **[Work item]** — Owner: [Persona] — Depends on: [Work item N if applicable]
3. **[Work item]** — Owner: [Persona] — Depends on: [Work item N if applicable]
4. **[Work item]** — Owner: [Persona]
5. **[Work item]** — Owner: [Persona]

---

## Nice-to-Have Work

[Work that would improve the phase outcome but won't be cut if time is tight. Explicitly labeled so the team doesn't treat them as commitments.]

- **[Work item]** — Owner: [Persona]
- **[Work item]** — Owner: [Persona]

---

## Cross-Team Dependencies

[Explicit handoff points. Both parties should know the dependency exists and the expected date.]

| From | To | What | By when |
|------|----|------|---------|
| [Persona] | [Persona] | [What is handed off] | [Date or milestone] |
| [Persona] | [Persona] | [What is handed off] | [Date or milestone] |

---

## Phase Gates

[Pre-defined checkpoints where the team evaluates whether to proceed, cut, or stop. Decisions are made at gates — not under pressure mid-sprint.]

### Gate 1 — [Date or milestone name]
**Condition to proceed:** [What must be true]  
**If condition is not met:** [Pre-agreed fallback — decided now, not when it's stressful]  
**Owner of go/no-go call:** [Usually PM]

---

### Gate 2 — [Date or milestone name]
**Condition to proceed:** [What must be true]  
**If condition is not met:** [Pre-agreed fallback]  
**Owner of go/no-go call:** [Usually PM]

---

### Final gate — [Date]
**Ship criteria:**
- [ ] All must-do work complete
- [ ] QA has signed off (or PM has accepted known issues in writing)
- [ ] DevOps deployment runbook is ready
- [ ] [Any other specific criterion]

**If ship criteria are not met:** [What happens — delay? cut scope? ship with known issues?]

---

## Cut Line

[If we have to cut something to hit the date, what goes first? Decided now, not when the deadline is tomorrow.]

**If time runs out, we cut in this order:**
1. [First thing to cut] — [Why this is lowest risk to cut]
2. [Second thing to cut]
3. [Third thing to cut]

**We will NOT cut:** [Things from the Non-Negotiables list]

---

## Fractional Engagements

[When do specialists (DevOps, UX, Security, Data) engage this phase? Quiet between gates — don't treat them as always-on.]

| Persona | Engagement | When |
|---------|-----------|------|
| DevOps | [e.g., CI/CD setup] | [e.g., Week 1] |
| UX Designer | [e.g., Flow review for onboarding] | [e.g., Before Gate 1] |
| Security Reviewer | [e.g., Auth implementation review] | [e.g., Before final gate] |
| Data Analyst | [e.g., Define success metrics] | [e.g., Week 1 kickoff] |

---

## Tensions to Resolve

[Named conflicts or trade-offs that need a decision before or during this phase. Each has an owner and a resolution deadline.]

| Tension | Owner | Resolve by | Notes |
|---------|-------|------------|-------|
| [e.g., "Build custom auth vs. use Auth0"] | Architect + PM | [Date] | [Current lean] |
| [e.g., "Ship mobile-first or desktop-first"] | UX + PM | [Date] | [Context] |

---

## Success Criteria

[How will we know this phase achieved its goal? Measurable where possible.]

- [Criterion — e.g., "User can register, log in, and log out without errors in the staging environment"]
- [Criterion]
- [Criterion]

---

## Post-Phase Retrospective

*Filled in at end of phase.*

**What went well:**

**What didn't go well:**

**What we'd do differently:**

**What carries into the next phase:**
