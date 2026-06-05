/**
 * Unit tests for src/scan/writer.ts — envelope assembly logic.
 *
 * Tests sort order, metadata counts, and valid ISO timestamp.
 * The actual file write is tested indirectly via writeCatalog — we verify the
 * written file content by reading it back in integration-style tests.
 * For pure logic (sort, counts), we test the inputs/outputs without touching disk.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeCatalog } from "../../src/scan/writer.js";
import type { SkillEntry } from "../../src/types/skills.js";

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

describe("writeCatalog", () => {
  describe("sort order", () => {
    it("sorts skills by repo ascending, then by skillName ascending", () => {
      const skills: SkillEntry[] = [
        makeSkill("z-org/z-repo", "zebra"),
        makeSkill("a-org/a-repo", "omega"),
        makeSkill("a-org/a-repo", "alpha"),
        makeSkill("m-org/m-repo", "middle"),
      ];

      writeCatalog({ skills, repoCount: 3, reposSucceeded: 3, reposFailed: 0 });

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
      writeCatalog({ skills, repoCount: 1, reposSucceeded: 1, reposFailed: 0 });

      const written = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
      expect(written.metadata.skillCount).toBe(2);
      expect(written.skills.length).toBe(2);
    });

    it("sets repoCount, reposSucceeded, reposFailed from input", () => {
      writeCatalog({
        skills: [],
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
      writeCatalog({ skills: [], repoCount: 0, reposSucceeded: 0, reposFailed: 0 });
      const written = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
      expect(written.metadata.schemaVersion).toBe(1);
    });
  });

  describe("lastScanned timestamp", () => {
    it("writes a valid ISO 8601 UTC timestamp", () => {
      const before = new Date().toISOString();
      writeCatalog({ skills: [], repoCount: 0, reposSucceeded: 0, reposFailed: 0 });
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
      writeCatalog({ skills: [], repoCount: 1, reposSucceeded: 1, reposFailed: 0 });

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
      writeCatalog({ skills, repoCount: 1, reposSucceeded: 1, reposFailed: 0 });

      const content = fs.readFileSync(OUTPUT_PATH, "utf-8");
      expect(() => JSON.parse(content)).not.toThrow();
    });
  });
});
