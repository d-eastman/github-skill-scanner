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
import type { SkillEntry, ScannedRepo } from "../../src/types/skills.js";
import { SkillCard } from "../../src/fe/components/SkillCard.js";
import { SkillList } from "../../src/fe/components/SkillList.js";
import { ScannedReposIndicator } from "../../src/fe/components/ScannedReposIndicator.js";
// Test the real shared command builder (used by both SkillCard and CopyButton).
import { buildInstallCommand } from "../../src/fe/installCommand.js";

const buildCommand = buildInstallCommand;

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
      const expected =
        "npx skills add https://github.com/anthropics/skills --skill pdf-generator -a github-copilot -y";

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

// Helper: make a ScannedRepo fixture
function makeScannedRepo(
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

describe("ScannedReposIndicator", () => {
  // TC-114: shown when repos is present and non-empty
  it("TC-114: renders <details> with aria-label when repos are present", () => {
    const repos = [makeScannedRepo("a/b", 1)];
    const { container } = render(<ScannedReposIndicator repos={repos} />);
    const details = container.querySelector("details");
    expect(details).toBeInTheDocument();
    expect(details?.getAttribute("aria-label")).toBe("Scanned repositories");
  });

  // TC-115: singular form
  it("TC-115: shows singular 'Scanning 1 repository' for one repo", () => {
    const repos = [makeScannedRepo("a/b", 1)];
    render(<ScannedReposIndicator repos={repos} />);
    expect(screen.getByText("Scanning 1 repository")).toBeInTheDocument();
    expect(screen.queryByText(/repositories/)).toBeNull();
  });

  // TC-116: plural form
  it("TC-116: shows plural 'Scanning N repositories' for N > 1", () => {
    const repos = [makeScannedRepo("a/a", 1), makeScannedRepo("b/b", 0)];
    render(<ScannedReposIndicator repos={repos} />);
    expect(screen.getByText("Scanning 2 repositories")).toBeInTheDocument();
  });

  // TC-117: repo links have correct href, target, rel
  it("TC-117: each repo renders as a link with correct href, target, rel", () => {
    const repos = [makeScannedRepo("anthropics/skills", 3)];
    render(<ScannedReposIndicator repos={repos} />);
    const link = screen.getByRole("link", { name: /anthropics\/skills/ });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("https://github.com/anthropics/skills");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  // TC-118: list is ul/li
  it("TC-118: repo list is a <ul> of <li> elements", () => {
    const repos = [makeScannedRepo("a/a", 0), makeScannedRepo("b/b", 0)];
    const { container } = render(<ScannedReposIndicator repos={repos} />);
    const ul = container.querySelector("details ul");
    expect(ul).toBeInTheDocument();
    expect(ul?.querySelectorAll("li")).toHaveLength(2);
  });

  // TC-119: failed repo shows "scan failed" tag
  it("TC-119: renders scan failed tag for status: failed repos", () => {
    const repos = [makeScannedRepo("someorg/broken-repo", 0, "failed")];
    render(<ScannedReposIndicator repos={repos} />);
    expect(screen.getByText("scan failed")).toBeInTheDocument();
  });

  // TC-120: succeeded repo with skills shows no "scan failed" tag
  it("TC-120: no scan failed tag for succeeded repos with skills", () => {
    const repos = [makeScannedRepo("a/b", 3, "succeeded")];
    render(<ScannedReposIndicator repos={repos} />);
    expect(screen.queryByText("scan failed")).toBeNull();
  });

  // TC-121: zero-skill succeeded repo shows no "scan failed" tag
  it("TC-121: no scan failed tag for succeeded repos with zero skills", () => {
    const repos = [makeScannedRepo("someorg/empty-repo", 0, "succeeded")];
    render(<ScannedReposIndicator repos={repos} />);
    expect(screen.queryByText("scan failed")).toBeNull();
  });

  // TC-122: mixed-status list — only failed entries get the tag
  it("TC-122: scan failed tag appears only on failed repo in a mixed list", () => {
    const repos = [
      makeScannedRepo("a/succeeded-with-skills", 2, "succeeded"),
      makeScannedRepo("b/succeeded-no-skills", 0, "succeeded"),
      makeScannedRepo("c/failed", 0, "failed"),
    ];
    render(<ScannedReposIndicator repos={repos} />);

    // Exactly one "scan failed" tag
    const tags = screen.getAllByText("scan failed");
    expect(tags).toHaveLength(1);

    // It must be in the list item for "c/failed"
    const failedLink = screen.getByRole("link", { name: /c\/failed/ });
    expect(failedLink.closest("li")?.textContent).toContain("scan failed");

    // The other items must not have it
    const succeededLink = screen.getByRole("link", { name: /a\/succeeded-with-skills/ });
    expect(succeededLink.closest("li")?.textContent).not.toContain("scan failed");
  });

  // TC-124: details has aria-label
  it("TC-124: <details> element has aria-label='Scanned repositories'", () => {
    const repos = [makeScannedRepo("a/b", 1)];
    const { container } = render(<ScannedReposIndicator repos={repos} />);
    const details = container.querySelector("details");
    expect(details?.getAttribute("aria-label")).toBe("Scanned repositories");
  });

  // TC-125: closed by default (no open attribute)
  it("TC-125: <details> is closed by default (no open attribute)", () => {
    const repos = [makeScannedRepo("a/b", 1)];
    const { container } = render(<ScannedReposIndicator repos={repos} />);
    const details = container.querySelector("details");
    expect(details?.hasAttribute("open")).toBe(false);
  });

  // TC-134: no aria-live region added by the indicator
  it("TC-134: ScannedReposIndicator does not add any aria-live regions", () => {
    const repos = [makeScannedRepo("a/b", 1)];
    const { container } = render(<ScannedReposIndicator repos={repos} />);
    const liveRegions = container.querySelectorAll("[aria-live]");
    expect(liveRegions).toHaveLength(0);
  });
});

// ─── GHE frontend regression tests (TC-210, TC-211) ─────────────────────────
// These test that the frontend components are already data-driven on repoUrl —
// no frontend code change is needed for GHES; only the repoUrl value changes.
// ADR-006 Decision 5: no schema change; frontend already reads repoUrl from data.

describe("GHE frontend data-driven tests (TC-210, TC-211)", () => {
  const ghesRepoUrl = "https://github.example.com/team-a/skills";

  // TC-210: install command uses GHES repoUrl without any code change
  it("TC-210: buildInstallCommand uses GHES repoUrl verbatim in the install command", () => {
    const skill: SkillEntry = {
      name: "PDF Tool",
      description: "Makes PDFs",
      skillName: "pdf",
      repo: "team-a/skills",
      repoUrl: ghesRepoUrl,
      path: "skills/pdf/SKILL.md",
    };

    const command = buildInstallCommand(skill);
    expect(command).toBe(
      "npx skills add https://github.example.com/team-a/skills --skill pdf -a github-copilot -y"
    );
    expect(command).not.toContain("github.com/team-a");
  });

  // TC-211: SkillCard repo link uses GHES repoUrl as href
  it("TC-211: SkillCard repo link href is the GHES repoUrl", () => {
    const skill: SkillEntry = {
      name: "PDF Tool",
      description: "Makes PDFs",
      skillName: "pdf",
      repo: "team-a/skills",
      repoUrl: ghesRepoUrl,
      path: "skills/pdf/SKILL.md",
    };

    render(<SkillCard skill={skill} onCopy={() => {}} />);

    const links = screen.getAllByRole("link");
    const repoLink = links.find(
      (l) => l.getAttribute("href") === ghesRepoUrl
    );
    expect(repoLink).toBeDefined();
    expect(repoLink?.getAttribute("href")).toBe(ghesRepoUrl);
    expect(repoLink?.getAttribute("target")).toBe("_blank");
    expect(repoLink?.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
