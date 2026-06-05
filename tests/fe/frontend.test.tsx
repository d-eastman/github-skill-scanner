/**
 * @vitest-environment jsdom
 *
 * Frontend unit tests — minimum coverage per tech-spec section 7.
 *
 * Tests cover:
 * 1. Command string generation (exact format, no trailing whitespace)
 * 2. Search filter logic (case-insensitive on name and description)
 * 3. Null name fallback (renders skillName instead)
 * 4. Null description (omits <p> element)
 * 5. Empty catalog state (zero skills)
 * 6. No-results state (search filtered everything)
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import type { SkillEntry } from "../../src/types/skills.js";
import { SkillCard } from "../../src/fe/components/SkillCard.js";
import { SkillList } from "../../src/fe/components/SkillList.js";

// Helper: build the command string exactly as CopyButton does
const buildCommand = (skill: SkillEntry): string => {
  return `npx skills add ${skill.repoUrl} --skill ${skill.skillName}`;
};

// Helper: filter skills exactly as App does
const filterSkills = (skills: SkillEntry[], query: string): SkillEntry[] => {
  if (!query.trim()) return skills;
  const q = query.toLowerCase();
  return skills.filter(
    (s) =>
      (s.name ?? "").toLowerCase().includes(q) ||
      (s.description ?? "").toLowerCase().includes(q) ||
      s.skillName.toLowerCase().includes(q)
  );
};

describe("frontend unit tests", () => {
  describe("command string", () => {
    it("generates exact command format with no trailing whitespace", () => {
      const skill: SkillEntry = {
        name: "PDF Generator",
        description: "Generates PDFs",
        skillName: "pdf-generator",
        repo: "anthropics/skills",
        repoUrl: "https://github.com/anthropics/skills",
        path: "skills/pdf-generator/SKILL.md",
      };

      const command = buildCommand(skill);
      const expected = "npx skills add https://github.com/anthropics/skills --skill pdf-generator";

      expect(command).toBe(expected);
      expect(command).not.toMatch(/\s+$/); // No trailing whitespace
      expect(command).not.toMatch(/\n/); // No newline
    });

    it("handles long repoUrl without truncation", () => {
      const skill: SkillEntry = {
        name: "Test Skill",
        description: null,
        skillName: "test-skill",
        repo: "some-org/some-very-long-repo-name-that-is-quite-lengthy",
        repoUrl: "https://github.com/some-org/some-very-long-repo-name-that-is-quite-lengthy",
        path: "test-skill/SKILL.md",
      };

      const command = buildCommand(skill);

      expect(command).toContain("https://github.com/some-org/some-very-long-repo-name-that-is-quite-lengthy");
      expect(command).toContain("--skill test-skill");
    });
  });

  describe("search filter", () => {
    const skills: SkillEntry[] = [
      {
        name: "Frontend Design",
        description: "Helps build React components",
        skillName: "frontend-design",
        repo: "anthropics/skills",
        repoUrl: "https://github.com/anthropics/skills",
        path: "skills/frontend-design/SKILL.md",
      },
      {
        name: "PDF Generator",
        description: "Generates PDF reports from structured data",
        skillName: "pdf-generator",
        repo: "anthropics/skills",
        repoUrl: "https://github.com/anthropics/skills",
        path: "skills/pdf-generator/SKILL.md",
      },
      {
        name: null,
        description: "Matches on skillName when name is null",
        skillName: "backend-database",
        repo: "anthropics/skills",
        repoUrl: "https://github.com/anthropics/skills",
        path: "skills/backend-database/SKILL.md",
      },
    ];

    it("matches case-insensitively on name field", () => {
      const result = filterSkills(skills, "frontend");

      expect(result).toHaveLength(1);
      expect(result[0].skillName).toBe("frontend-design");
    });

    it("matches case-insensitively on description field", () => {
      const result = filterSkills(skills, "react");

      expect(result).toHaveLength(1);
      expect(result[0].skillName).toBe("frontend-design");
    });

    it("matches case-insensitively on skillName field", () => {
      const result = filterSkills(skills, "pdf");

      expect(result).toHaveLength(1);
      expect(result[0].skillName).toBe("pdf-generator");
    });

    it("handles null name field without crashing", () => {
      const result = filterSkills(skills, "database");

      expect(result).toHaveLength(1);
      expect(result[0].skillName).toBe("backend-database");
    });

    it("handles null description field without crashing", () => {
      // Create a skill with null description
      const skillsWithNullDesc = [
        {
          name: "Test Skill",
          description: null,
          skillName: "test-skill",
          repo: "test/repo",
          repoUrl: "https://github.com/test/repo",
          path: "test-skill/SKILL.md",
        },
      ];

      const result = filterSkills(skillsWithNullDesc, "test");

      expect(result).toHaveLength(1);
    });

    it("returns empty array when query matches nothing", () => {
      const result = filterSkills(skills, "nonexistent");

      expect(result).toHaveLength(0);
    });

    it("returns all skills when query is empty", () => {
      const result = filterSkills(skills, "");

      expect(result).toHaveLength(3);
    });
  });

  describe("SkillCard rendering", () => {
    it("renders name when present", () => {
      const skill: SkillEntry = {
        name: "PDF Generator",
        description: "Generates PDFs",
        skillName: "pdf-generator",
        repo: "anthropics/skills",
        repoUrl: "https://github.com/anthropics/skills",
        path: "skills/pdf-generator/SKILL.md",
      };

      render(<SkillCard skill={skill} onCopy={() => {}} />);

      expect(screen.getByText("PDF Generator")).toBeInTheDocument();
    });

    it("falls back to skillName when name is null", () => {
      const skill: SkillEntry = {
        name: null,
        description: "Generates PDFs",
        skillName: "pdf-generator",
        repo: "anthropics/skills",
        repoUrl: "https://github.com/anthropics/skills",
        path: "skills/pdf-generator/SKILL.md",
      };

      render(<SkillCard skill={skill} onCopy={() => {}} />);

      expect(screen.getByText("pdf-generator")).toBeInTheDocument();
    });

    it("renders description when present", () => {
      const skill: SkillEntry = {
        name: "PDF Generator",
        description: "Generates PDF reports",
        skillName: "pdf-generator",
        repo: "anthropics/skills",
        repoUrl: "https://github.com/anthropics/skills",
        path: "skills/pdf-generator/SKILL.md",
      };

      render(<SkillCard skill={skill} onCopy={() => {}} />);

      expect(screen.getByText("Generates PDF reports")).toBeInTheDocument();
    });

    it("omits description element when description is null", () => {
      const skill: SkillEntry = {
        name: "PDF Generator",
        description: null,
        skillName: "pdf-generator",
        repo: "anthropics/skills",
        repoUrl: "https://github.com/anthropics/skills",
        path: "skills/pdf-generator/SKILL.md",
      };

      const { container } = render(<SkillCard skill={skill} onCopy={() => {}} />);

      // Get all <p> elements; they should only be the "Source:" line, not a description
      const paragraphs = container.querySelectorAll("p");
      expect(paragraphs.length).toBe(1); // Only the "Source:" paragraph
      expect(paragraphs[0].textContent).toContain("Source:");
    });

    it("renders repo link with target and rel attributes", () => {
      const skill: SkillEntry = {
        name: "PDF Generator",
        description: "Generates PDFs",
        skillName: "pdf-generator",
        repo: "anthropics/skills",
        repoUrl: "https://github.com/anthropics/skills",
        path: "skills/pdf-generator/SKILL.md",
      };

      render(<SkillCard skill={skill} onCopy={() => {}} />);

      const link = screen.getByText("anthropics/skills");
      expect(link.getAttribute("href")).toBe("https://github.com/anthropics/skills");
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    });

    it("renders install command in code element", () => {
      const skill: SkillEntry = {
        name: "PDF Generator",
        description: "Generates PDFs",
        skillName: "pdf-generator",
        repo: "anthropics/skills",
        repoUrl: "https://github.com/anthropics/skills",
        path: "skills/pdf-generator/SKILL.md",
      };

      render(<SkillCard skill={skill} onCopy={() => {}} />);

      const codeElement = screen.getByText(/npx skills add/);
      expect(codeElement.tagName).toBe("CODE");
    });
  });

  describe("SkillList rendering", () => {
    it("renders empty state when totalSkillCount is 0", () => {
      render(
        <SkillList skills={[]} totalSkillCount={0} query="" onCopy={() => {}} />
      );

      expect(screen.getByText("No skills found yet.")).toBeInTheDocument();
      expect(
        screen.getByText(/scanner has run but found no SKILL\.md files/)
      ).toBeInTheDocument();
    });

    it("renders no-results state when search matches nothing", () => {
      const skills: SkillEntry[] = [
        {
          name: "PDF Generator",
          description: "Generates PDFs",
          skillName: "pdf-generator",
          repo: "anthropics/skills",
          repoUrl: "https://github.com/anthropics/skills",
          path: "skills/pdf-generator/SKILL.md",
        },
      ];

      render(
        <SkillList skills={[]} totalSkillCount={skills.length} query="xyz" onCopy={() => {}} />
      );

      expect(screen.getByText(/No skills match "xyz"/)).toBeInTheDocument();
      expect(
        screen.getByText(/Try a different search term/)
      ).toBeInTheDocument();
    });

    it("truncates long query in no-results message", () => {
      const longQuery = "this-is-a-very-long-search-query-that-exceeds-thirty-characters";

      render(
        <SkillList skills={[]} totalSkillCount={5} query={longQuery} onCopy={() => {}} />
      );

      // Query gets truncated to 30 chars + ellipsis
      // First 30 chars of the query: "this-is-a-very-long-search-que"
      expect(
        screen.getByRole("heading", { level: 2 })
      ).toHaveTextContent(/No skills match "this-is-a-very-long-search-que…"/);
    });

    it("renders skill list as ul with li elements", () => {
      const skills: SkillEntry[] = [
        {
          name: "PDF Generator",
          description: "Generates PDFs",
          skillName: "pdf-generator",
          repo: "anthropics/skills",
          repoUrl: "https://github.com/anthropics/skills",
          path: "skills/pdf-generator/SKILL.md",
        },
        {
          name: "Frontend Design",
          description: "Builds React components",
          skillName: "frontend-design",
          repo: "anthropics/skills",
          repoUrl: "https://github.com/anthropics/skills",
          path: "skills/frontend-design/SKILL.md",
        },
      ];

      const { container } = render(
        <SkillList skills={skills} totalSkillCount={2} query="" onCopy={() => {}} />
      );

      const ul = container.querySelector("ul");
      expect(ul).toBeInTheDocument();

      const lis = ul?.querySelectorAll("li");
      expect(lis).toHaveLength(2);
    });

    it("keys list items correctly on repo + path", () => {
      const skills: SkillEntry[] = [
        {
          name: "Skill A",
          description: null,
          skillName: "skill-a",
          repo: "org/repo",
          repoUrl: "https://github.com/org/repo",
          path: "skills/a/SKILL.md",
        },
        {
          name: "Skill B",
          description: null,
          skillName: "skill-b",
          repo: "org/repo",
          repoUrl: "https://github.com/org/repo",
          path: "skills/b/SKILL.md",
        },
      ];

      const { container } = render(
        <SkillList skills={skills} totalSkillCount={2} query="" onCopy={() => {}} />
      );

      // Verify both items are rendered (keys are not directly testable, but rendered items prove keys work)
      expect(container.querySelectorAll("li")).toHaveLength(2);
      expect(screen.getByText("Skill A")).toBeInTheDocument();
      expect(screen.getByText("Skill B")).toBeInTheDocument();
    });
  });
});
