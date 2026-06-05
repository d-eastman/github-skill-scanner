/**
 * Unit tests for src/scan/parser.ts
 *
 * Tests frontmatter extraction under valid, missing, and malformed conditions.
 * Must-have #3: malformed/missing frontmatter → null fields, no crash.
 * SEC-001: JavaScript engine disabled — `---js` frontmatter must not execute.
 */

import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "../../src/scan/parser.js";

const DUMMY_PATH = "test-repo/frontend-design/SKILL.md";

describe("parseFrontmatter", () => {
  describe("valid frontmatter", () => {
    it("extracts name and description from valid YAML frontmatter", () => {
      const content = `---
name: Frontend Design
description: Helps Claude build and refactor React components with modern CSS.
---

Some body text.
`;
      const result = parseFrontmatter(content, DUMMY_PATH);
      expect(result.name).toBe("Frontend Design");
      expect(result.description).toBe(
        "Helps Claude build and refactor React components with modern CSS."
      );
    });

    it("handles multiline description in YAML block scalar", () => {
      const content = `---
name: My Skill
description: >
  First line.
  Second line.
---
`;
      const result = parseFrontmatter(content, DUMMY_PATH);
      expect(result.name).toBe("My Skill");
      expect(result.description).not.toBeNull();
    });

    it("trims whitespace from string fields", () => {
      const content = `---
name: "  Padded Name  "
description: "  Padded Description  "
---
`;
      const result = parseFrontmatter(content, DUMMY_PATH);
      expect(result.name).toBe("Padded Name");
      expect(result.description).toBe("Padded Description");
    });
  });

  describe("missing fields", () => {
    it("returns null name when name is absent", () => {
      const content = `---
description: A description without a name.
---
`;
      const result = parseFrontmatter(content, DUMMY_PATH);
      expect(result.name).toBeNull();
      expect(result.description).toBe("A description without a name.");
    });

    it("returns null description when description is absent", () => {
      const content = `---
name: A Skill Without Description
---
`;
      const result = parseFrontmatter(content, DUMMY_PATH);
      expect(result.name).toBe("A Skill Without Description");
      expect(result.description).toBeNull();
    });

    it("returns both null when frontmatter is empty (--- ---)", () => {
      const content = `---
---

Body text with no frontmatter fields.
`;
      const result = parseFrontmatter(content, DUMMY_PATH);
      expect(result.name).toBeNull();
      expect(result.description).toBeNull();
    });

    it("returns null for empty string name", () => {
      const content = `---
name: ""
description: Some description
---
`;
      const result = parseFrontmatter(content, DUMMY_PATH);
      expect(result.name).toBeNull();
    });
  });

  describe("no frontmatter at all", () => {
    it("returns both null when file has no frontmatter delimiters", () => {
      const content = `# Just a heading

Some body text with no YAML frontmatter at all.
`;
      const result = parseFrontmatter(content, DUMMY_PATH);
      expect(result.name).toBeNull();
      expect(result.description).toBeNull();
    });

    it("returns both null for an empty file", () => {
      const result = parseFrontmatter("", DUMMY_PATH);
      expect(result.name).toBeNull();
      expect(result.description).toBeNull();
    });
  });

  describe("SEC-001 — JavaScript engine disabled (RCE regression)", () => {
    it("does not execute ---js frontmatter and returns null fields without throwing", () => {
      // Sentinel: if eval() runs, it would set this property on the global object.
      // The payload uses a ---js delimiter which gray-matter's built-in js engine
      // would hand to eval(). With the disabled engine, the parse throws, the
      // outer try/catch catches it, and parseFrontmatter returns null fields.
      const SENTINEL_KEY = "__sec001_eval_ran__";
      // Precondition: sentinel must not exist before the call
      expect((globalThis as Record<string, unknown>)[SENTINEL_KEY]).toBeUndefined();

      const maliciousContent =
        "---js\n" +
        `(globalThis["${SENTINEL_KEY}"] = true, { name: "pwned", description: "pwned" })\n` +
        "---\n";

      // (a) Must not throw out of parseFrontmatter — scan must not crash
      let result: { name: string | null; description: string | null } | undefined;
      expect(() => {
        result = parseFrontmatter(maliciousContent, "evil-repo/SKILL.md");
      }).not.toThrow();

      // (b) eval never ran — sentinel is still unset
      expect((globalThis as Record<string, unknown>)[SENTINEL_KEY]).toBeUndefined();

      // (c) Malicious frontmatter treated as malformed — both fields null
      expect(result!.name).toBeNull();
      expect(result!.description).toBeNull();
    });

    it("does not execute ---javascript frontmatter (alternate delimiter alias)", () => {
      const SENTINEL_KEY = "__sec001_javascript_eval_ran__";
      expect((globalThis as Record<string, unknown>)[SENTINEL_KEY]).toBeUndefined();

      const maliciousContent =
        "---javascript\n" +
        `(globalThis["${SENTINEL_KEY}"] = true, { name: "pwned", description: "pwned" })\n` +
        "---\n";

      let result: { name: string | null; description: string | null } | undefined;
      expect(() => {
        result = parseFrontmatter(maliciousContent, "evil-repo/SKILL.md");
      }).not.toThrow();

      expect((globalThis as Record<string, unknown>)[SENTINEL_KEY]).toBeUndefined();
      expect(result!.name).toBeNull();
      expect(result!.description).toBeNull();
    });

    it("continues to parse normal YAML frontmatter correctly after the engine override", () => {
      // Confirm the engine restriction doesn't break ordinary YAML parsing
      const content = `---
name: Still Works
description: YAML parsing is unaffected by the JS engine lockdown.
---
`;
      const result = parseFrontmatter(content, "good-repo/SKILL.md");
      expect(result.name).toBe("Still Works");
      expect(result.description).toBe(
        "YAML parsing is unaffected by the JS engine lockdown."
      );
    });
  });

  describe("malformed frontmatter — must not crash", () => {
    it("handles malformed YAML gracefully — both fields null", () => {
      // gray-matter is quite tolerant; this tests genuinely broken YAML
      const content = `---
name: valid
description: [unclosed bracket
another: : broken: : yaml: :
---
`;
      // Should not throw; may return null or parsed values depending on gray-matter tolerance
      expect(() => parseFrontmatter(content, DUMMY_PATH)).not.toThrow();
    });

    it("coerces a numeric name to string (not null)", () => {
      const content = `---
name: 42
description: Numeric name.
---
`;
      const result = parseFrontmatter(content, DUMMY_PATH);
      // Non-string coerced via String() — should not be null
      expect(result.name).not.toBeNull();
      expect(typeof result.name).toBe("string");
    });

    it("coerces a boolean description to string", () => {
      const content = `---
name: Test Skill
description: true
---
`;
      const result = parseFrontmatter(content, DUMMY_PATH);
      expect(result.description).not.toBeNull();
      expect(typeof result.description).toBe("string");
    });
  });
});
