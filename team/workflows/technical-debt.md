# Workflow: Technical Debt / Refactor

> **Run it:** `/tech-debt <problem>` orchestrates these steps — diagnose, justify, regression-guard,
> refactor, verify — spawning each persona as a subagent and enforcing scope discipline at the
> gates. Run any single step with its persona command (`/architect`, `/lead`, …). The `Invoke:`
> examples below are the gist of each step.

Use this workflow when addressing accumulated technical debt, refactoring existing code, or improving internal quality without changing user-visible behavior.

---

## When to use this workflow

- Code has become hard to change safely and the team is slowing down
- A system component needs to be replaced or significantly restructured
- A known shortcut taken earlier now needs to be paid back
- Test coverage is insufficient to allow safe future changes
- Performance or reliability is degrading and the root cause is structural

---

## What makes this different from a feature or bug fix

- **No user-visible behavior change** — the goal is internal improvement, not new capability
- **High regression risk** — changing internal structure can break things that were working
- **Hard to justify to stakeholders** — requires a clear articulation of why this is worth doing and what it enables
- **Scope can expand rapidly** — "while we're in here" is the enemy; strict scope discipline is essential

---

## Workflow Steps

### Step 1 — Solution Architect: Diagnose and Justify

**Who:** Marcus Chen (Architect)  
**Input:** Description of the problem, relevant code  
**Output:** Root Cause Analysis + ADR (or ADR amendment) documenting the decision to refactor and the approach

Invoke: "Act as Marcus Chen, the Solution Architect. We have a technical debt problem: [description]. Diagnose the root cause, evaluate our options, and recommend an approach."

The Architect's output must answer:
- What is the specific problem? (Not "the code is messy" — what does messy mean, what does it prevent?)
- What are the options? (Refactor incrementally, rewrite, leave it, work around it)
- What is the recommended approach and why?
- What is the scope of the change? What does it touch? What does it NOT touch?
- What does this enable that we couldn't do before?

The "what does this enable" question is essential — it's the justification for the PM.

**Gate:** ADR is accepted. Without an accepted ADR, refactoring work does not start.

---

### Step 2 — Product Manager: Prioritization

**Who:** Sasha Kowalski (PM)  
**Input:** Architect's ADR and justification  
**Output:** Go/No-Go; timing and phase placement if go

Invoke: "Act as Sasha Kowalski, the Product Manager. The Architect has recommended [refactor description]. Given our current backlog and roadmap, when should we do this, and what does it displace?"

The PM decides:
- Is the justification compelling enough to displace feature work?
- Is now the right time, or should this wait for a quiet sprint?
- What scope constraint is placed on the refactor? (Prevents "while we're in here" expansion)

**Gate:** PM has approved the refactor and set explicit scope constraints

---

### Step 3 — QA: Regression Test Plan

**Who:** Remy Dubois (QA)  
**Input:** ADR describing what will change, existing behavior to preserve  
**Output:** Regression test plan — what must still work after the refactor

Invoke: "Act as Remy Dubois, the QA Engineer. We're refactoring [component/system]. Write a regression test plan that verifies the user-visible behavior is unchanged."

This is written BEFORE the refactor begins. If QA can't write a test plan for "this should still work," that's a signal the scope isn't clear enough.

---

### Step 4 — Lead Developer: Implementation

**Who:** Theo Okafor (Lead Developer), Yuki (Junior) on contained subtasks  
**Input:** ADR, regression test plan, PM scope constraints  
**Output:** Code + PRs

Invoke: "Act as Theo Okafor, the Lead Developer. Implement the refactor described in [ADR]. Stay within the scope constraints from the PM. Here's the regression test plan to stay green against."

Discipline:
- Work incrementally where possible — smaller PRs are safer to review and revert
- Scope constraints are not suggestions — if you want to expand scope, get PM approval first
- Every PR should leave the system working (no "this will be fixed in the next PR")

---

### Step 5 — QA: Regression Verification

**Who:** Remy Dubois (QA)  
**Input:** Deployed build, regression test plan from Step 3  
**Output:** Verified regression results; bug reports for any regressions

Invoke: "Act as Remy Dubois, the QA Engineer. Run the regression test plan against the refactored build. Identify any regressions."

A regression = any behavior that worked before the refactor that no longer works. Every regression is a blocker until resolved.

---

### Step 6 — Architect: ADR Update + Post-Mortem Note

**Who:** Marcus Chen (Architect)  
**Input:** Completed implementation  
**Output:** ADR marked Accepted (or amended if implementation diverged from plan)

The ADR is updated to reflect:
- What was actually done (vs. what was planned)
- Any scope changes that occurred and why
- What technical debt this cleared and what (if any) it introduced

---

## Scope Discipline Rules

These are non-negotiable for refactor work:

1. **No new features while refactoring.** If you discover a missing feature while refactoring, file a ticket. Don't implement it.
2. **No behavior changes without PM approval.** If you think the old behavior was wrong, that's a feature request, not a refactor.
3. **No expanding the scope without PM approval.** "This touches three other files that also need fixing" → file tickets for those files.
4. **If you can't finish the refactor in the agreed scope, stop and communicate.** Don't leave the system in a half-refactored state.
