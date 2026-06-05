/**
 * Unit tests for src/scan/limits.ts
 *
 * SEC-003 / TD-008: the scanner must reject oversized SKILL.md files to avoid
 * unbounded memory use on the Actions runner.
 */

import { describe, it, expect } from "vitest";
import { MAX_CONTENT_BYTES, exceedsSizeLimit } from "../../src/scan/limits.js";

describe("exceedsSizeLimit", () => {
  it("returns false for a small declared size", () => {
    expect(exceedsSizeLimit("2048")).toBe(false);
  });

  it("returns false at exactly the limit", () => {
    expect(exceedsSizeLimit(String(MAX_CONTENT_BYTES))).toBe(false);
  });

  it("returns true one byte over the limit", () => {
    expect(exceedsSizeLimit(String(MAX_CONTENT_BYTES + 1))).toBe(true);
  });

  it("returns true for a clearly oversized file", () => {
    expect(exceedsSizeLimit(String(50 * 1024 * 1024))).toBe(true);
  });

  it("returns false when the header is absent (defer to post-read check)", () => {
    expect(exceedsSizeLimit(null)).toBe(false);
  });

  it("returns false when the header is not a number", () => {
    expect(exceedsSizeLimit("not-a-number")).toBe(false);
  });

  it("honors a custom maxBytes argument", () => {
    expect(exceedsSizeLimit("100", 50)).toBe(true);
    expect(exceedsSizeLimit("40", 50)).toBe(false);
  });

  it("uses a 1 MB default limit", () => {
    expect(MAX_CONTENT_BYTES).toBe(1024 * 1024);
  });
});
