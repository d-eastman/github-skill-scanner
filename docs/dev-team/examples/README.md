# Worked Example — "Export report to CSV"

A complete, filled-in set of artifacts for one small, realistic feature, so you can see what
"good" looks like and how the personas hand off to each other. These are **examples, not live
project artifacts** — every file carries an `EXAMPLE` banner, and the personas will not read or
overwrite them as if they were this project's real requirements/ADR/test plan.

**Fictional scenario:** an internal admin dashboard ("Acme Admin", Node/TypeScript/Express +
PostgreSQL) needs an Export-to-CSV button on its filterable orders report.

## Read it in handoff order

| # | File | Persona | What it shows |
|---|------|---------|---------------|
| 1 | [`requirements.md`](requirements.md) | `/ba` Priya Nair | Problem → scope → testable must-haves & acceptance criteria; flags CSV-injection and large-export risks |
| 2 | [`adr-001-streaming-vs-buffering.md`](adr-001-streaming-vs-buffering.md) | `/architect` Marcus Chen | Three options weighed (buffer / stream / async), a decision with the trade-off named, and the road not taken |
| 3 | [`test-plan.md`](test-plan.md) | `/qa` Remy Dubois | Hypothesis-driven cases run for real — happy path, edge, error, security, regression — with a "do not ship" risk call |
| 4 | [`BUG-001.md`](BUG-001.md) | `/qa` Remy Dubois | An actionable bug report for the one case that failed (TC-010) |

## The thread that ties them together

The BA writes must-have #3 ("fields with commas/quotes are safely encoded"). The Architect's ADR
records RFC-4180 quoting as an implementation note. QA turns that into test case **TC-010** — which
**fails**, producing **BUG-001** (the serializer joined columns with `,` and never quoted them).
The test plan's quality-risk assessment recommends *not shipping* until it's fixed. That chain —
a requirement becoming a decision becoming a test becoming a caught bug — is the whole point of the
team, and what these four files demonstrate.

> Want a different example? Copy this folder, swap in your feature, and keep the cross-references
> (each artifact points back to the one before it).
