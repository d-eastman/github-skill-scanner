# Workflow: Feature Request

> **Run it:** `/feature-request <ask>` orchestrates these steps — spawning each persona as a
> subagent, carrying artifacts forward, and pausing at the gates. Run any single step with its
> persona command (`/ba`, `/pm`, …). The `Invoke:` examples below are the gist of each step.

Use this workflow when adding a new capability to an existing system — whether from a stakeholder request, backlog item, or user feedback.

---

## When to use this workflow

- A new feature is being added to an existing product
- A backlog item is being pulled into a sprint
- A stakeholder request needs to be evaluated and scoped

---

## Workflow Steps

### Step 1 — Business Analyst: Clarify Scope

**Who:** Priya Nair (BA)  
**Input:** Feature request (however vague), existing requirements context, existing codebase context  
**Output:** Requirements Delta — what changes, not a full requirements document

Invoke: "Act as Priya Nair, the Business Analyst. We've received a request to [feature description]. Interview me to understand what's actually needed and produce a requirements delta."

The BA's job here is tighter than a new project:
- What is the exact new behavior being requested?
- What does it replace or extend?
- What are the acceptance criteria?
- What's explicitly out of scope for this request?

A requirements delta is not a full document — it's the diff from what exists.

**Gate:** Acceptance criteria are written and agreed before Step 2

---

### Step 2 — Product Manager: Fit and Priority

**Who:** Sasha Kowalski (PM)  
**Input:** Requirements Delta  
**Output:** Go/No-Go to build; backlog position if go; updated phase plan if significant

Invoke: "Act as Sasha Kowalski, the Product Manager. Given this feature request [paste requirements delta], does this fit the current phase? How does it fit in the backlog? What do we deprioritize to make room?"

The PM decides:
- Is this in scope for the current phase or does it go to backlog?
- What gets deprioritized if this is added?
- Is this a small extension or does it need its own phase planning?

Skip to Step 5 if the PM says "backlog it."

**Gate:** PM has made an explicit go/no-go and backlog position decision

---

### Step 3 — Solution Architect: Fit and Approach (if significant)

**Who:** Marcus Chen (Architect) — only if the feature touches existing architecture  
**Input:** Requirements Delta, relevant existing ADRs  
**Output:** Brief feasibility note OR a new/amended ADR if the feature requires architectural change

Invoke: "Act as Marcus Chen, the Solution Architect. Read this feature request and tell me whether it fits the existing architecture or requires architectural changes."

Skip this step if:
- The feature is a straightforward addition within existing patterns
- The Lead Developer already has a clear implementation path

Use this step if:
- The feature touches data models, API contracts, or integration points
- It could conflict with an existing architectural decision
- Multiple implementation approaches exist with meaningfully different trade-offs

---

### Step 4 — UX Designer: Flow and Interaction (if user-facing)

**Who:** Lena Vasquez (UX Designer) — only if the feature has a user interface  
**Input:** Requirements Delta, existing product flows  
**Output:** Updated or new user flow + annotated wireframes for the new feature

Invoke: "Act as Lena Vasquez, the UX Designer. Given this feature request, design the user flow and wireframes."

Skip this step if:
- The feature is entirely backend / API / non-user-facing
- The interaction pattern is already established and this is just extending it

---

### Step 5 — QA: Test Plan Update

**Who:** Remy Dubois (QA)  
**Input:** Requirements Delta, existing test plan (if any)  
**Output:** New test cases for the feature; regression cases for affected existing behavior

Invoke: "Act as Remy Dubois, the QA Engineer. Given this feature request and its acceptance criteria, write test cases for the new behavior and identify what regression testing is needed."

Write the test cases BEFORE implementation begins, not after.

---

### Step 6 — Lead Developer: Technical Spec + Implementation

**Who:** Theo Okafor (Lead Developer), Yuki Tanaka (Junior Developer) as assigned  
**Input:** Requirements Delta, ADR/feasibility note (if applicable), UX flows (if applicable), Test Plan  
**Output:** Code + PR

Invoke: "Act as Theo Okafor, the Lead Developer. Given the requirements and architectural context, implement [feature]."

---

### Step 7 — QA: Verification

**Who:** Remy Dubois (QA)  
**Input:** Deployed build, test cases from Step 5  
**Output:** Verified test plan; bug reports if issues found

Invoke: "Act as Remy Dubois, the QA Engineer. Test the [feature] implementation against the test plan."

---

### Step 8 — PM: Ship Decision

**Who:** Sasha (PM)  
**Input:** QA quality risk assessment  
**Output:** Ship or not; scope decision log updated

---

## Skipping Steps

Not every feature request needs every step. Use judgment:

| Feature size | Steps to skip |
|-------------|---------------|
| Trivial (copy change, config change) | Steps 1, 3, 4 — Lead Dev implements directly |
| Small (localized UI or API change) | Step 3 (Architect) if patterns are clear |
| Medium (new screen, new endpoint) | Full workflow |
| Large (new user journey, new subsystem) | Consider using the New Project workflow instead |

When in doubt: more process for more risk, less process for less risk. The PM decides.
