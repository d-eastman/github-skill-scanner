/**
 * Unit tests for src/scan/layout.ts
 *
 * Tests all three layout rules (L1/L2/L3) plus rejection of non-matching paths.
 * Pure functions — no I/O, no mocks needed.
 */

import { describe, it, expect } from "vitest";
import { matchSkillPath, deriveSkillName } from "../../src/scan/layout.js";

const REPO_NAME = "skills";

describe("matchSkillPath", () => {
  describe("L1 — root SKILL.md → skillName is repo name", () => {
    it("matches SKILL.md at repo root", () => {
      const result = matchSkillPath("SKILL.md", REPO_NAME);
      expect(result).not.toBeNull();
      expect(result!.layout).toBe("L1");
      expect(result!.skillName).toBe(REPO_NAME);
    });

    it("uses the provided repoName as skillName for L1", () => {
      const result = matchSkillPath("SKILL.md", "my-custom-repo");
      expect(result!.skillName).toBe("my-custom-repo");
    });
  });

  describe("L2 — <skill>/SKILL.md → skillName is directory name", () => {
    it("matches frontend-design/SKILL.md", () => {
      const result = matchSkillPath("frontend-design/SKILL.md", REPO_NAME);
      expect(result).not.toBeNull();
      expect(result!.layout).toBe("L2");
      expect(result!.skillName).toBe("frontend-design");
    });

    it("matches pdf/SKILL.md", () => {
      const result = matchSkillPath("pdf/SKILL.md", REPO_NAME);
      expect(result!.layout).toBe("L2");
      expect(result!.skillName).toBe("pdf");
    });

    it("matches a skill directory with underscores and numbers", () => {
      const result = matchSkillPath("my_skill_v2/SKILL.md", REPO_NAME);
      expect(result!.layout).toBe("L2");
      expect(result!.skillName).toBe("my_skill_v2");
    });
  });

  describe("L3 — skills/<skill>/SKILL.md → skillName is sub-directory", () => {
    it("matches skills/pdf/SKILL.md", () => {
      const result = matchSkillPath("skills/pdf/SKILL.md", REPO_NAME);
      expect(result).not.toBeNull();
      expect(result!.layout).toBe("L3");
      expect(result!.skillName).toBe("pdf");
    });

    it("matches skills/code-review/SKILL.md", () => {
      const result = matchSkillPath("skills/code-review/SKILL.md", REPO_NAME);
      expect(result!.layout).toBe("L3");
      expect(result!.skillName).toBe("code-review");
    });
  });

  describe("Non-matching paths — should return null", () => {
    it("does not match skill.md (wrong case)", () => {
      expect(matchSkillPath("skill.md", REPO_NAME)).toBeNull();
    });

    it("does not match SKILL.MD (uppercase extension)", () => {
      expect(matchSkillPath("SKILL.MD", REPO_NAME)).toBeNull();
    });

    it("does not match a path four segments deep", () => {
      expect(matchSkillPath("docs/examples/x/SKILL.md", REPO_NAME)).toBeNull();
    });

    it("does not match nested/deep/extra/SKILL.md", () => {
      expect(matchSkillPath("nested/deep/extra/SKILL.md", REPO_NAME)).toBeNull();
    });

    it("does not match three segments where prefix is not 'skills'", () => {
      // e.g. tooling/pdf/SKILL.md — this looks like L3 shape but prefix is wrong
      expect(matchSkillPath("tooling/pdf/SKILL.md", REPO_NAME)).toBeNull();
    });

    it("does not match a path that just ends in a directory named SKILL.md", () => {
      // e.g. a directory literally named SKILL.md containing a file
      // We can't distinguish this from a file in this pure-path test, but the
      // scanner pre-filters to type==='blob' before calling matchSkillPath.
      // The path "foo/SKILL.md/bar.txt" should not match since it has 3 segments
      // and the prefix is not "skills".
      expect(matchSkillPath("foo/SKILL.md/bar.txt", REPO_NAME)).toBeNull();
    });

    it("does not match a path with no SKILL.md component", () => {
      expect(matchSkillPath("README.md", REPO_NAME)).toBeNull();
    });
  });

  describe("Edge cases — path normalisation", () => {
    it("strips a leading slash before matching", () => {
      const result = matchSkillPath("/SKILL.md", REPO_NAME);
      expect(result).not.toBeNull();
      expect(result!.layout).toBe("L1");
    });

    it("strips leading slash on L2 path", () => {
      const result = matchSkillPath("/frontend-design/SKILL.md", REPO_NAME);
      expect(result!.layout).toBe("L2");
      expect(result!.skillName).toBe("frontend-design");
    });
  });
});

describe("deriveSkillName", () => {
  it("returns skillName for a matching path", () => {
    expect(deriveSkillName("frontend-design/SKILL.md", REPO_NAME)).toBe("frontend-design");
  });

  it("returns null for a non-matching path", () => {
    expect(deriveSkillName("docs/examples/SKILL.md", REPO_NAME)).toBeNull();
  });

  it("returns repo name for root SKILL.md", () => {
    expect(deriveSkillName("SKILL.md", "my-repo")).toBe("my-repo");
  });
});
