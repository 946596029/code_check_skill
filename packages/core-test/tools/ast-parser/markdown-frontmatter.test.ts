import { describe, it, expect } from "vitest";
import { MarkdownParser } from "@code-check/core";
import type { MarkdownNode } from "@code-check/core";

describe("MarkdownParser - Frontmatter Support", () => {
  describe("parse() with front-matter", () => {
    it("should parse front-matter and insert it as the first child node", () => {
      const md = [
        "---",
        "title: Hello World",
        "version: 1.0",
        "---",
        "",
        "# Heading",
        "",
        "Some text.",
      ].join("\n");

      const parser = new MarkdownParser();
      const ast = parser.parse(md);

      expect(ast.type).toBe("document");
      expect(ast.children.length).toBeGreaterThanOrEqual(2);

      const fm = ast.children[0];
      expect(fm.type).toBe("frontmatter");
      expect(fm.literal).toBe("title: Hello World\nversion: 1.0");
      expect(fm.data).toEqual({ title: "Hello World", version: 1.0 });
      expect(fm.children).toEqual([]);
    });

    it("should compute correct sourceRange for the front-matter node", () => {
      const md = "---\nkey: value\n---\n\n# Title\n";

      const parser = new MarkdownParser();
      const ast = parser.parse(md);
      const fm = ast.children[0];

      expect(fm.type).toBe("frontmatter");
      expect(fm.sourceRange).not.toBeNull();
      expect(fm.sourceRange!.start).toEqual({ line: 1, column: 1 });
      expect(fm.sourceRange!.end.line).toBe(3);
    });

    it("should parse complex YAML data in front-matter", () => {
      const md = [
        "---",
        "title: Test",
        "tags:",
        "  - alpha",
        "  - beta",
        "nested:",
        "  key: value",
        "---",
        "",
        "Body text.",
      ].join("\n");

      const parser = new MarkdownParser();
      const ast = parser.parse(md);
      const fm = ast.children[0];

      expect(fm.type).toBe("frontmatter");
      expect(fm.data).toEqual({
        title: "Test",
        tags: ["alpha", "beta"],
        nested: { key: "value" },
      });
    });

    it("should handle CRLF line endings", () => {
      const md = "---\r\ntitle: CRLF\r\n---\r\n\r\n# Title\r\n";

      const parser = new MarkdownParser();
      const ast = parser.parse(md);
      const fm = ast.children[0];

      expect(fm.type).toBe("frontmatter");
      expect(fm.data).toEqual({ title: "CRLF" });
    });
  });

  describe("parse() without front-matter", () => {
    it("should produce no frontmatter node for plain markdown", () => {
      const md = "# Just a heading\n\nSome body text.";

      const parser = new MarkdownParser();
      const ast = parser.parse(md);

      const hasFm = ast.children.some((c) => c.type === "frontmatter");
      expect(hasFm).toBe(false);
    });

    it("should not treat a thematic break in the middle as front-matter", () => {
      const md = "# Title\n\n---\n\nParagraph after break.";

      const parser = new MarkdownParser();
      const ast = parser.parse(md);

      const hasFm = ast.children.some((c) => c.type === "frontmatter");
      expect(hasFm).toBe(false);
    });
  });

  describe("parse() with invalid YAML in front-matter", () => {
    it("should still create a frontmatter node with null data on YAML parse error", () => {
      const md = [
        "---",
        "invalid: yaml: content: [broken",
        "---",
        "",
        "# Title",
      ].join("\n");

      const parser = new MarkdownParser();
      const ast = parser.parse(md);
      const fm = ast.children[0];

      expect(fm.type).toBe("frontmatter");
      expect(fm.literal).toBe("invalid: yaml: content: [broken");
      expect(fm.data).toBeNull();
    });

    it("should set data to null when YAML evaluates to a non-object", () => {
      const md = "---\njust a string\n---\n\n# Title\n";

      const parser = new MarkdownParser();
      const ast = parser.parse(md);
      const fm = ast.children[0];

      expect(fm.type).toBe("frontmatter");
      expect(fm.data).toBeNull();
    });
  });

  describe("enableFrontmatter option", () => {
    it("should skip front-matter extraction when enableFrontmatter is false", () => {
      const md = "---\ntitle: Ignored\n---\n\n# Heading\n";

      const parser = new MarkdownParser({ enableFrontmatter: false });
      const ast = parser.parse(md);

      const hasFm = ast.children.some((c) => c.type === "frontmatter");
      expect(hasFm).toBe(false);
    });

    it("should extract front-matter by default (enableFrontmatter defaults to true)", () => {
      const md = "---\ntitle: Default\n---\n\n# Heading\n";

      const parser = new MarkdownParser();
      const ast = parser.parse(md);

      const fm = ast.children[0];
      expect(fm.type).toBe("frontmatter");
      expect(fm.data).toEqual({ title: "Default" });
    });
  });

  describe("getFrontmatter() convenience method", () => {
    it("should return parsed data when front-matter is present", () => {
      const md = "---\nauthor: Alice\nyear: 2025\n---\n\n# Doc\n";

      const parser = new MarkdownParser();
      const ast = parser.parse(md);
      const data = parser.getFrontmatter(ast);

      expect(data).toEqual({ author: "Alice", year: 2025 });
    });

    it("should return null when no front-matter is present", () => {
      const md = "# No front matter here\n";

      const parser = new MarkdownParser();
      const ast = parser.parse(md);
      const data = parser.getFrontmatter(ast);

      expect(data).toBeNull();
    });
  });

  describe("findByType() integration", () => {
    it("should find frontmatter node via findByType", () => {
      const md = "---\nkey: val\n---\n\n# Heading\n";

      const parser = new MarkdownParser();
      const ast = parser.parse(md);
      const nodes = parser.findByType(ast, "frontmatter");

      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe("frontmatter");
      expect(nodes[0].data).toEqual({ key: "val" });
    });
  });

  describe("walk() integration", () => {
    it("should visit the frontmatter node during walk", () => {
      const md = "---\nfoo: bar\n---\n\n# Title\n";

      const parser = new MarkdownParser();
      const ast = parser.parse(md);

      const visited: string[] = [];
      parser.walk(ast, (node, entering) => {
        if (entering) {
          visited.push(node.type);
        }
      });

      expect(visited[0]).toBe("document");
      expect(visited[1]).toBe("frontmatter");
    });
  });
});
