/**
 * Unit tests for src/scan/host.ts — URL derivation from a host string.
 *
 * ADR-006 Decision 2: all scanner URLs are pure functions of the `host` field
 * from repos.json. github.com is special-cased with an exact equality check;
 * every other host is treated as GHES.
 *
 * TC-200–TC-214 (GHE test plan section: URL Derivation)
 * No mocks needed — all functions are pure.
 */

import { describe, it, expect } from "vitest";
import {
  apiBase,
  repoUrl,
  contentsUrl,
  repoInfoUrl,
  treeUrl,
} from "../../src/scan/host.js";

const GHES_HOST = "github.example.com";
const GITHUB_COM = "github.com";

describe("host URL derivation — GHES host", () => {
  // TC-200: GHES host → API base is https://<host>/api/v3
  it("TC-200: GHES host → apiBase is https://<host>/api/v3", () => {
    expect(apiBase(GHES_HOST)).toBe("https://github.example.com/api/v3");
  });

  it("TC-200: apiBase has no trailing slash", () => {
    expect(apiBase(GHES_HOST)).not.toMatch(/\/$/);
  });

  // TC-201: GHES host → Git Trees URL on GHES api/v3 base
  it("TC-201: GHES host → treeUrl is on GHES api/v3 base, not api.github.com", () => {
    const url = treeUrl(GHES_HOST, "team-a", "skills", "main");
    expect(url).toBe(
      "https://github.example.com/api/v3/repos/team-a/skills/git/trees/main?recursive=1"
    );
    expect(url).not.toContain("api.github.com");
  });

  // TC-202: GHES host → repo info URL on GHES api/v3 base
  it("TC-202: GHES host → repoInfoUrl is on GHES api/v3 base", () => {
    expect(repoInfoUrl(GHES_HOST, "team-a", "skills")).toBe(
      "https://github.example.com/api/v3/repos/team-a/skills"
    );
  });

  // TC-205: GHES host → Contents API URL built correctly
  it("TC-205: GHES host → contentsUrl on GHES api/v3 base with ?ref= param", () => {
    const url = contentsUrl(GHES_HOST, "team-a", "skills", "skills/pdf/SKILL.md", "main");
    expect(url).toBe(
      "https://github.example.com/api/v3/repos/team-a/skills/contents/skills/pdf/SKILL.md?ref=main"
    );
    expect(url).toContain("?ref=main");
    expect(url).not.toContain("raw.githubusercontent.com");
  });

  // TC-207: GHES host → repoUrl is browser-navigable, no /api/v3, no trailing slash
  it("TC-207: GHES host → repoUrl is https://<host>/<owner>/<repo> with no trailing slash", () => {
    const url = repoUrl(GHES_HOST, "team-a", "skills");
    expect(url).toBe("https://github.example.com/team-a/skills");
    expect(url).not.toMatch(/\/$/);
    expect(url).not.toContain("/api/v3");
    expect(url).not.toContain("/raw/");
  });

  // TC-209: repoUrl must NOT contain /api/v3 for GHES host (anti-regression)
  it("TC-209: GHES repoUrl never contains /api/v3", () => {
    const url = repoUrl(GHES_HOST, "team-a", "skills");
    expect(url).not.toContain("/api/v3");
    expect(url).toBe("https://github.example.com/team-a/skills");
  });
});

describe("host URL derivation — github.com backward compat (Decision 4)", () => {
  // TC-203: github.com host → API base is https://api.github.com (NOT https://github.com/api/v3)
  it("TC-203: github.com host → apiBase is https://api.github.com (not the /api/v3 form)", () => {
    expect(apiBase(GITHUB_COM)).toBe("https://api.github.com");
    expect(apiBase(GITHUB_COM)).not.toBe("https://github.com/api/v3");
  });

  // TC-204: github.com host → repo info and trees URLs use api.github.com
  it("TC-204: github.com host → repoInfoUrl uses api.github.com base", () => {
    expect(repoInfoUrl(GITHUB_COM, "anthropics", "skills")).toBe(
      "https://api.github.com/repos/anthropics/skills"
    );
  });

  it("TC-204: github.com host → treeUrl uses api.github.com base", () => {
    expect(treeUrl(GITHUB_COM, "anthropics", "skills", "main")).toBe(
      "https://api.github.com/repos/anthropics/skills/git/trees/main?recursive=1"
    );
  });

  // TC-206: github.com host → Contents API URL uses api.github.com (not raw.githubusercontent.com)
  it("TC-206: github.com host → contentsUrl uses api.github.com, not raw.githubusercontent.com", () => {
    const url = contentsUrl(GITHUB_COM, "anthropics", "skills", "frontend-design/SKILL.md", "main");
    expect(url).toBe(
      "https://api.github.com/repos/anthropics/skills/contents/frontend-design/SKILL.md?ref=main"
    );
    expect(url).not.toContain("raw.githubusercontent.com");
  });

  // TC-208: github.com host → repoUrl is byte-identical to current production output
  it("TC-208: github.com host → repoUrl is https://github.com/<owner>/<repo> (backward compat)", () => {
    expect(repoUrl(GITHUB_COM, "anthropics", "skills")).toBe(
      "https://github.com/anthropics/skills"
    );
  });
});

describe("host URL derivation — edge cases", () => {
  // TC-212: bare hostname only (no scheme) — correct output, no double-scheme
  it("TC-212: bare hostname input produces correctly prefixed URLs (no double-scheme)", () => {
    const base = apiBase("github.example.com");
    // Must start with exactly one https://
    expect(base).toBe("https://github.example.com/api/v3");
    expect(base.startsWith("https://")).toBe(true);
    expect(base).not.toContain("https://https://");
  });

  // TC-213: structural — apiBase and repoUrl both derive from the same host
  it("TC-213: apiBase and repoUrl both use the same host without independent constants", () => {
    // Both functions accept the same host string. Calling each with "github.com"
    // produces the github.com variants; any other host produces GHES variants.
    // This is a derived correctness check — if both derive from host, changing host
    // changes both consistently.
    const ghesBase = apiBase("github.acme.com");
    const ghesRepo = repoUrl("github.acme.com", "team", "repo");
    expect(ghesBase).toContain("github.acme.com");
    expect(ghesRepo).toContain("github.acme.com");
    expect(ghesBase).not.toContain("api.github.com");
    expect(ghesRepo).not.toContain("api.github.com");
  });

  // TC-227 (URL-level): a hostname that contains "github.com" as a substring is still GHES
  it("TC-227 (URL-level): xgithub.com is treated as GHES, not github.com", () => {
    // Substring match would wrongly classify this as github.com
    expect(apiBase("xgithub.com")).toBe("https://xgithub.com/api/v3");
    expect(apiBase("xgithub.com")).not.toBe("https://api.github.com");
  });

  it("TC-227 (URL-level): github.acmecorp.com is treated as GHES", () => {
    expect(apiBase("github.acmecorp.com")).toBe("https://github.acmecorp.com/api/v3");
  });

  it("TC-227 (URL-level): my-ghes.internal is treated as GHES", () => {
    expect(apiBase("my-ghes.internal")).toBe("https://my-ghes.internal/api/v3");
  });
});
