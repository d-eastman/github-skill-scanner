> **EXAMPLE** — a filled-in Architecture Decision Record for the fictional "Export report to CSV"
> feature. Not a real project artifact. See [`../README.md`](../README.md).

# Architecture Decision Record (ADR)
**ADR Number:** ADR-001
**Title:** Stream CSV export from a database cursor rather than buffering in memory
**Author:** Marcus Chen (Solution Architect)
**Date:** 2026-05-24
**Status:** Accepted

---

## Context

We need to export the filtered orders report as CSV (see `requirements.md`). Result sets range from ~100 rows to ~250,000 rows (a full quarter). The decision: how does the server generate and deliver the CSV without exhausting memory or blocking the reports API for other users? Stack is Node 20 / TypeScript / Express, querying PostgreSQL via `pg`. We have no job queue or object storage today.

---

## Decision Drivers

1. Bounded memory regardless of result size (a 250k-row export must not threaten the instance)
2. Simple to build and operate — small team, shipping this sprint
3. Acceptable UX — the download starts promptly and finishes in reasonable time
4. Reuses the existing filtered-query + access-control path rather than duplicating it

---

## Options Considered

### Option 1: Buffer the whole CSV in memory

Run the query, build the entire CSV (string or array of rows), then send it as one response body.

**Pros:**
- Simplest possible implementation
- Can set `Content-Length`, so the browser shows a real progress bar
- Trivial to unit-test (pure function: rows → string)

**Cons:**
- Memory scales with result size — a 250k-row export can blow the heap
- An OOM doesn't just fail the export; it can take down every other request on the instance

**Estimated effort:** Small

---

### Option 2: Stream from a database cursor

Open a server-side cursor (`pg-cursor`), read rows in batches (~1,000), transform each batch to CSV lines, and write to the HTTP response stream with chunked transfer encoding.

**Pros:**
- Bounded memory — only one batch is in memory at a time
- First byte reaches the client early
- Backpressure handles slow clients naturally

**Cons:**
- Slightly more complex than Option 1
- No `Content-Length`, so no precise progress percentage
- A query error *after* headers are sent is awkward — the response is already streaming

**Estimated effort:** Medium

---

### Option 3: Async generate + download link

Enqueue a job, generate the file to object storage, and notify the user with a link when ready.

**Pros:**
- Handles arbitrarily large exports with no request timeout
- Export work is off the request path entirely

**Cons:**
- Requires a job queue, object storage, and a notification mechanism — none of which we have
- Overkill for the common case (small exports), and a worse UX for it (wait + go find a link)

**Estimated effort:** Large

---

## Decision

**We will: Option 2 — stream the CSV from a database cursor**, with a hard cap of **250,000 rows** per export (this resolves the open question in `requirements.md`; agreed with the PM). Beyond the cap, respond `413` with guidance to narrow the filters.

Streaming gives us bounded memory and a prompt first byte for the common case without standing up new infrastructure. We accept the loss of a precise progress indicator as a fair trade for not risking OOM on large pulls.

---

## Consequences

### Positive
- Memory stays flat regardless of export size; the reports API is protected from export-induced OOM
- Reuses the existing filtered query (we add a cursor-based read alongside it)

### Negative
- No `Content-Length`/progress percentage (the "progress indication" nice-to-have becomes spinner-only)
- A failure mid-stream yields a truncated download; we log it and the user retries (richer integrity signaling is out of scope for v1)
- Modestly more code and more test cases than buffering

### Neutral / Watch
- If finance routinely needs exports larger than 250k rows, or a true progress bar becomes important, revisit Option 3

---

## The Road Not Taken

**Option 3 (async + link)** was the runner-up because it scales to any size. We'd reconsider it if the 250k cap proves too low, or if export sizes grow past what a single streamed request should reasonably carry.

---

## Implementation Notes

- Reuse the orders filter builder; add a cursor-based read (`pg-cursor`) batching ~1,000 rows.
- Set response headers **before the first write**: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="orders-<YYYY-MM-DD>.csv"`. Prepend a UTF-8 BOM so Excel detects encoding.
- Quote fields per **RFC 4180** (wrap in `"`, double any internal `"`). This covers commas, quotes, and embedded newlines — see `requirements.md` must-have #3 and `test-plan.md` TC-010.
- **Neutralize formula injection**: for any cell starting with `=`, `+`, `-`, or `@`, prefix a `'` (or leading tab). See must-have #4 / TC-021.
- Enforce the 250k cap (e.g., a `LIMIT 250001` probe; if exceeded, return `413` before streaming).
- Wrap row iteration so a query error after headers are sent is logged and the stream is closed cleanly.

---

## Links

- `requirements.md` (must-haves #3, #4; performance NFR)
- `test-plan.md` (TC-010 encoding, TC-013 cap, TC-021 injection)
