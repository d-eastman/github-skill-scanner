/**
 * Unit tests for src/scan/writer.ts — envelope assembly logic.
 *
 * Tests sort order, metadata counts, valid ISO timestamp, and the
 * ADR-002 addendum repos[] invariants.
 * The actual file write is tested indirectly via writeCatalog — we verify the
 * written file content by reading it back in integration-style tests.
 * For pure logic (sort, counts), we test the inputs/outputs without touching disk.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeCatalog } from "../../src/scan/writer.js";
import type { SkillEntry, ScannedRepo } from "../../src/types/skills.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../");
const OUTPUT_PATH = path.join(REPO_ROOT, "data", "skills.json");

// Save and restore the original data/skills.json around each test
let originalContent: string | null = null;

beforeEach(() => {
  if (fs.existsSync(OUTPUT_PATH)) {
    originalContent = fs.readFileSync(OUTPUT_PATH, "utf-8");
  } else {
    originalContent = null;
  }
});

afterEach(() => {
  if (originalContent !== null) {
    fs.writeFileSync(OUTPUT_PATH, originalContent, "utf-8");
  }
});

function makeSkill(repo: string, skillName: string): SkillEntry {
  return {
    name: `${skillName} Name`,
    description: `${skillName} description`,
    skillName,
    repo,
    repoUrl: `https://github.com/${repo}`,
    path: `${skillName}/SKILL.md`,
  };
}

function makeRepo(
  repo: string,
  skillCount: number,
  status: "succeeded" | "failed" = "succeeded"
): ScannedRepo {
  return {
    repo,
    repoUrl: `https://github.com/${repo}`,
    skillCount,
    status,
  };
}

describe("writeCatalog", () => {
  describe("sort order", () => {
    it("sorts skills by repo ascending, then by skillName ascending", () => {
      const skills: SkillEntry[] = [
        makeSkill("z-org/z-repo", "zebra"),
        makeSkill("a-org/a-repo", "omega"),
        makeSkill("a-org/a-repo", "alpha"),
        makeSkill("m-org/m-repo", "middle"),
      ];

      const repos: ScannedRepo[] = [
        makeRepo("z-org/z-repo", 1),
        makeRepo("a-org/a-repo", 2),
        makeRepo("m-org/m-repo", 1),
      ];

      writeCatalog({ skills, repos, repoCount: 3, reposSucceeded: 3, reposFailed: 0 });

      const written = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
      const names = written.skills.map(
        (s: SkillEntry) => `${s.repo}/${s.skillName}`
      );

      expect(names).toEqual([
        "a-org/a-repo/alpha",
        "a-org/a-repo/omega",
        "m-org/m-repo/middle",
        "z-org/z-repo/zebra",
      ]);
    });
  });

  describe("metadata counts", () => {
    it("sets skillCount to match skills.length", () => {
      const skills = [makeSkill("a/b", "skill1"), makeSkill("a/b", "skill2")];
      const repos = [makeRepo("a/b", 2)];
      writeCatalog({ skills, repos, repoCount: 1, reposSucceeded: 1, reposFailed: 0 });

      const written = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
      expect(written.metadata.skillCount).toBe(2);
      expect(written.skills.length).toBe(2);
    });

    it("sets repoCount, reposSucceeded, reposFailed from input", () => {
      const repos: ScannedRepo[] = [
        makeRepo("a/a", 0),
        makeRepo("b/b", 0),
        makeRepo("c/c", 0),
        makeRepo("d/d", 0),
        makeRepo("e/e", 0, "failed"),
      ];
      writeCatalog({
        skills: [],
        repos,
        repoCount: 5,
        reposSucceeded: 4,
        reposFailed: 1,
      });

      const written = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
      expect(written.metadata.repoCount).toBe(5);
      expect(written.metadata.reposSucceeded).toBe(4);
      expect(written.metadata.reposFailed).toBe(1);
    });

    it("sets schemaVersion to 1", () => {
      writeCatalog({ skills: [], repos: [], repoCount: 0, reposSucceeded: 0, reposFailed: 0 });
      const written = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
      expect(written.metadata.schemaVersion).toBe(1);
    });
  });

  describe("lastScanned timestamp", () => {
    it("writes a valid ISO 8601 UTC timestamp", () => {
      const before = new Date().toISOString();
      writeCatalog({ skills: [], repos: [], repoCount: 0, reposSucceeded: 0, reposFailed: 0 });
      const after = new Date().toISOString();

      const written = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
      const ts = written.metadata.lastScanned;

      // Must be parseable as a valid date
      const parsed = new Date(ts);
      expect(parsed.toString()).not.toBe("Invalid Date");

      // Must be within the test execution window
      expect(ts >= before).toBe(true);
      expect(ts <= after).toBe(true);
    });
  });

  describe("empty catalog", () => {
    it("writes a valid envelope with empty skills array when no skills found", () => {
      writeCatalog({ skills: [], repos: [makeRepo("a/b", 0)], repoCount: 1, reposSucceeded: 1, reposFailed: 0 });

      const content = fs.readFileSync(OUTPUT_PATH, "utf-8");
      // Must be valid JSON
      expect(() => JSON.parse(content)).not.toThrow();

      const written = JSON.parse(content);
      expect(Array.isArray(written.skills)).toBe(true);
      expect(written.skills.length).toBe(0);
      expect(written.metadata.skillCount).toBe(0);
    });

    it("produces valid JSON — parseable without error", () => {
      const skills = [makeSkill("a/b", "test-skill")];
      const repos = [makeRepo("a/b", 1)];
      writeCatalog({ skills, repos, repoCount: 1, reposSucceeded: 1, reposFailed: 0 });

      const content = fs.readFileSync(OUTPUT_PATH, "utf-8");
      expect(() => JSON.parse(content)).not.toThrow();
    });
  });

  // --- ADR-002 addendum: metadata.repos invariants ---

  describe("TC-100: metadata.repos is always an array in output", () => {
    it("writes metadata.repos as an array when one repo succeeds", () => {
      const repos = [makeRepo("a/b", 2)];
      const skills = [makeSkill("a/b", "skill1"), makeSkill("a/b", "skill2")];
      writeCatalog({ skills, repos, repoCount: 1, reposSucceeded: 1, reposFailed: 0 });

      const written = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
      expect(Array.isArray(written.metadata.repos)).toBe(true);
      expect(written.metadata.repos.length).toBe(1);
    });
  });

  describe("TC-101: repo with skills → skillCount: N, status: succeeded", () => {
    it("writes correct entry for a succeeded repo with N skills", () => {
      const skills = [makeSkill("a/b", "s1"), makeSkill("a/b", "s2")];
      const repos: ScannedRepo[] = [
        { repo: "a/b", repoUrl: "https://github.com/a/b", skillCount: 2, status: "succeeded" },
      ];
      writeCatalog({ skills, repos, repoCount: 1, reposSucceeded: 1, reposFailed: 0 });

      const written = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
      expect(written.metadata.repos[0]).toEqual({
        repo: "a/b",
        repoUrl: "https://github.com/a/b",
        skillCount: 2,
        status: "succeeded",
      });
    });
  });

  describe("TC-102: repo succeeded with zero skills → skillCount: 0, status: succeeded", () => {
    it("writes correct entry for a succeeded repo with zero skills", () => {
      const repos: ScannedRepo[] = [
        { repo: "a/b", repoUrl: "https://github.com/a/b", skillCount: 0, status: "succeeded" },
      ];
      writeCatalog({ skills: [], repos, repoCount: 1, reposSucceeded: 1, reposFailed: 0 });

      const written = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
      expect(written.metadata.repos[0].skillCount).toBe(0);
      expect(written.metadata.repos[0].status).toBe("succeeded");
      expect(written.metadata.reposSucceeded).toBe(1);
      expect(written.metadata.reposFailed).toBe(0);
    });
  });

  describe("TC-103: failed repo → status: failed, skillCount: 0", () => {
    it("writes correct entry for a failed repo", () => {
      const repos: ScannedRepo[] = [
        { repo: "broken/repo", repoUrl: "https://github.com/broken/repo", skillCount: 0, status: "failed" },
      ];
      writeCatalog({ skills: [], repos, repoCount: 1, reposSucceeded: 0, reposFailed: 1 });

      const written = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
      expect(written.metadata.repos[0].status).toBe("failed");
      expect(written.metadata.repos[0].skillCount).toBe(0);
      expect(written.metadata.reposFailed).toBe(1);
    });
  });

  describe("TC-104: repos sorted ascending by repo string", () => {
    it("sorts metadata.repos by repo ascending regardless of input order", () => {
      const repos: ScannedRepo[] = [
        { repo: "z-org/z-repo", repoUrl: "https://github.com/z-org/z-repo", skillCount: 0, status: "succeeded" },
        { repo: "a-org/a-repo", repoUrl: "https://github.com/a-org/a-repo", skillCount: 0, status: "succeeded" },
        { repo: "m-org/m-repo", repoUrl: "https://github.com/m-org/m-repo", skillCount: 0, status: "succeeded" },
      ];
      writeCatalog({ skills: [], repos, repoCount: 3, reposSucceeded: 3, reposFailed: 0 });

      const written = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
      const repoNames = written.metadata.repos.map((r: ScannedRepo) => r.repo);
      expect(repoNames).toEqual(["a-org/a-repo", "m-org/m-repo", "z-org/z-repo"]);
    });
  });

  describe("TC-105: invariant repos.length === metadata.repoCount", () => {
    it("repos.length matches repoCount for a mixed-status list", () => {
      const repos: ScannedRepo[] = [
        makeRepo("a/a", 1),
        makeRepo("b/b", 0),
        makeRepo("c/c", 0, "failed"),
      ];
      const skills = [makeSkill("a/a", "skill1")];
      writeCatalog({ skills, repos, repoCount: 3, reposSucceeded: 2, reposFailed: 1 });

      const written = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
      expect(written.metadata.repos.length).toBe(written.metadata.repoCount);
      expect(written.metadata.repos.length).toBe(3);
    });
  });

  describe("TC-106: invariant succeeded/failed counts match reposSucceeded/reposFailed", () => {
    it("reposSucceeded and reposFailed match the repo status counts", () => {
      const repos: ScannedRepo[] = [
        makeRepo("a/a", 0),
        makeRepo("b/b", 0),
        makeRepo("c/c", 0, "failed"),
      ];
      writeCatalog({ skills: [], repos, repoCount: 3, reposSucceeded: 2, reposFailed: 1 });

      const written = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
      const succeededInRepos = written.metadata.repos.filter(
        (r: ScannedRepo) => r.status === "succeeded"
      ).length;
      const failedInRepos = written.metadata.repos.filter(
        (r: ScannedRepo) => r.status === "failed"
      ).length;
      expect(succeededInRepos).toBe(written.metadata.reposSucceeded);
      expect(failedInRepos).toBe(written.metadata.reposFailed);
    });
  });

  describe("TC-107: invariant sum(repos[].skillCount) === metadata.skillCount === skills.length", () => {
    it("sum of per-repo skillCounts equals metadata.skillCount and skills.length", () => {
      const repos: ScannedRepo[] = [
        makeRepo("a/a", 3),
        makeRepo("b/b", 0),
        makeRepo("c/c", 0, "failed"),
      ];
      const skills = [
        makeSkill("a/a", "s1"),
        makeSkill("a/a", "s2"),
        makeSkill("a/a", "s3"),
      ];
      writeCatalog({ skills, repos, repoCount: 3, reposSucceeded: 2, reposFailed: 1 });

      const written = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
      const sumSkillCount = written.metadata.repos.reduce(
        (acc: number, r: ScannedRepo) => acc + r.skillCount,
        0
      );
      expect(sumSkillCount).toBe(3);
      expect(written.metadata.skillCount).toBe(3);
      expect(written.skills.length).toBe(3);
    });
  });

  describe("TC-108: invariant status === failed implies skillCount === 0 — throws on violation", () => {
    it("throws when a failed repo entry has skillCount > 0", () => {
      const repos: ScannedRepo[] = [
        { repo: "broken/repo", repoUrl: "https://github.com/broken/repo", skillCount: 5, status: "failed" },
      ];
      expect(() =>
        writeCatalog({ skills: [], repos, repoCount: 1, reposSucceeded: 0, reposFailed: 1 })
      ).toThrow(/Bug.*failed.*skillCount/);
    });
  });
});
