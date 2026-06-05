> **EXAMPLE** — a filled-in Requirements Document for a fictional "Export report to CSV" feature
> (stack: Node 20 / TypeScript / Express / PostgreSQL). Not a real project artifact. See
> [`../README.md`](../README.md) for how to read this worked example.

# Requirements Document
**Project:** Acme Admin — Export Orders Report to CSV
**Author:** Priya Nair (Business Analyst)
**Date:** 2026-05-22
**Status:** Final

---

## Problem Statement

Finance and regional-ops users need order data in a spreadsheet to do ad-hoc analysis — pivots, reconciliation, sharing with partners — that the dashboard doesn't support. Today they copy rows out of the HTML table by hand, which is slow, error-prone, and silently breaks past the first page of results. They need to export the report they are already looking at, with the filters they've applied, as a file they can open in Excel or Google Sheets.

---

## Background

The `/reports` page shows a paginated, filterable orders table (filters: date range, status, channel). Data comes from the `orders` table in PostgreSQL and is served by the existing `GET /api/reports/orders`, which already enforces row-level access (regional users see only their region). Typical result sets are 100–20,000 rows; finance occasionally pulls a full quarter (~250,000 rows).

---

## Scope

### In scope
- Export the **current filtered result set** (all matching rows, not just the visible page) as a CSV download
- CSV columns match the visible table columns and their order
- Export respects the requesting user's row-level access scope

### Out of scope
- XLSX or PDF export
- Scheduled or emailed exports
- Choosing/reordering which columns are exported
- Exporting report types other than orders

### Next phase (not now, but documented)
- Column selection
- XLSX format
- Scheduled exports

---

## Must-Haves

1. **Export filtered set** — The system shall export all rows matching the active filters (not just the visible page) as a CSV file when the user clicks Export.
   *Acceptance criteria:* with filters returning N rows, the file contains N data rows + 1 header row; 5 spot-checked rows match the on-screen table.

2. **Column parity** — CSV columns match the table's columns and order.
   *Acceptance criteria:* the header row equals the visible column labels, in order.

3. **Safe field encoding** — Fields containing commas, double-quotes, or newlines are quoted/escaped per RFC 4180.
   *Acceptance criteria:* a customer name `Doe, Jane` appears as a single cell; the file round-trips through Excel, Google Sheets, and a standard CSV parser with no column shift.

4. **Formula-injection neutralized** — Cells beginning with `=`, `+`, `-`, or `@` are neutralized so spreadsheet apps don't execute them.
   *Acceptance criteria:* a note field `=1+1` imports as the literal text `=1+1`, not `2`.

5. **Access scope respected** — Export returns only rows the requesting user is authorized to see.
   *Acceptance criteria:* a regional user's export contains only their region's orders — exactly the rows the API returns on screen.

---

## Nice-to-Haves

1. **Progress indication for large exports** — Description: show a spinner/progress affordance while a large export streams — *Priority: Medium*
2. **Descriptive filename** — Description: filename includes the date and a filter summary — *Priority: Low*

---

## Non-Functional Requirements

- **Performance:** export of 250,000 rows completes without exhausting server memory; first byte reaches the client within 5s; total under 60s at P95.
- **Availability:** an export failure must not degrade `/api/reports/orders` for other users.
- **Security:** no CSV formula injection; export honors row-level access; no PII beyond what the table already shows on screen.
- **Data retention:** exports are generated on demand and not stored server-side.

---

## User Roles

| Role | Goal | Notes |
|------|------|-------|
| Finance analyst | Pull org-wide order data into a spreadsheet for analysis | Sees all regions |
| Regional ops | Export their region's orders for local reconciliation | Row-level access limits visible rows |

---

## User Stories

### Story 1: Export filtered orders
**As a** finance analyst, **I want** to export the orders I've filtered to CSV **so that** I can analyze them in a spreadsheet.

**Acceptance criteria:**
- [ ] An Export button is visible on `/reports`
- [ ] Clicking it downloads a `.csv` file containing all filtered rows
- [ ] Columns match the on-screen table

### Story 2: Trust the exported data
**As a** regional ops user, **I want** the export to contain exactly the rows I can see **so that** I don't accidentally pull data outside my region or miss rows.

**Acceptance criteria:**
- [ ] Row-level scope is identical to the on-screen table
- [ ] Special characters (commas, quotes, accents) are intact and correctly placed

---

## Open Questions

| Question | Owner | Decision by | Notes |
|----------|-------|-------------|-------|
| Is there a maximum row cap for a single export? | PM + Architect | 2026-06-03 | Lean: cap at 250k, show a "narrow your filters" message above it (resolved in ADR-001) |
| Filename convention? | UX | 2026-06-10 | Low priority; `orders-<date>.csv` is fine for v1 |

---

## Assumptions

- `GET /api/reports/orders` already enforces row-level access and accepts the same filters; reusing its query path for export is acceptable.
- The table's visible columns are the correct export columns for v1.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Large exports cause server memory pressure | High | High | Stream rather than buffer — see ADR-001 |
| CSV formula injection from user-entered fields | Medium | High | Must-have #4; verified in test plan |
| Very large pulls time out | Medium | Medium | 250k row cap + streaming |

---

## Stakeholder Sign-Off

| Name | Role | Status | Date |
|------|------|--------|------|
| J. Okonkwo | Finance lead | Approved | 2026-05-23 |
