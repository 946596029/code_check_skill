import { describe, it, expect } from "vitest";
import {
    FrontmatterCheckRule,
    LineLengthRule,
    NumberFormatRule,
    H1ExistsRule,
    ExampleSectionExistsRule,
    MarkdownParser,
} from "@code-check/core";

const parser = new MarkdownParser();

// ─── Helpers ────────────────────────────────────────────────

function check(rule: InstanceType<typeof FrontmatterCheckRule>, md: string) {
    const ast = parser.parse(md);
    return rule.test(md, ast);
}

// ─── FrontmatterCheckRule ───────────────────────────────────

describe("FrontmatterCheckRule", () => {
    const rule = new FrontmatterCheckRule();

    it("should pass when frontmatter exists", async () => {
        const md = [
            "---",
            "title: Test",
            "---",
            "",
            "# Hello",
        ].join("\n");

        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
    });

    it("should fail when frontmatter is missing", async () => {
        const md = "# Hello\n\nSome text.";

        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(false);
        expect(results[0].message).toContain("front matter");
    });

    it("should fail when AST is not provided", async () => {
        const results = await rule.test("# Hello");
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(false);
    });
});

// ─── H1ExistsRule ───────────────────────────────────────────

describe("H1ExistsRule", () => {
    const rule = new H1ExistsRule();

    it("should pass when H1 heading exists", async () => {
        const md = "# My Resource\n\nSome description.";
        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
    });

    it("should fail when no H1 heading exists", async () => {
        const md = "## Section\n\nSome description.";
        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(false);
        expect(results[0].message).toContain("level-1 heading");
    });

    it("should pass with frontmatter and H1", async () => {
        const md = [
            "---",
            "title: Test",
            "---",
            "",
            "# Resource Name",
            "",
            "Description.",
        ].join("\n");

        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
    });
});

// ─── ExampleSectionExistsRule ───────────────────────────────

describe("ExampleSectionExistsRule", () => {
    const rule = new ExampleSectionExistsRule();

    it("should pass when Example Usage section exists", async () => {
        const md = [
            "# Resource",
            "",
            "## Example Usage",
            "",
            "```hcl",
            "resource \"test\" {}",
            "```",
        ].join("\n");

        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
    });

    it("should fail when Example Usage section is missing", async () => {
        const md = [
            "# Resource",
            "",
            "## Argument Reference",
            "",
            "Some args.",
        ].join("\n");

        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(false);
        expect(results[0].message).toContain("Example Usage");
    });
});

// ─── LineLengthRule ─────────────────────────────────────────

describe("LineLengthRule", () => {
    const rule = new LineLengthRule();

    it("should pass when all lines are within limit", async () => {
        const md = [
            "# Resource",
            "",
            "Short line of text.",
        ].join("\n");

        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
    });

    it("should fail when a line exceeds 120 columns", async () => {
        const longLine = "* `field` - (Required, String) " + "A".repeat(100);
        const md = [
            "# Resource",
            "",
            longLine,
        ].join("\n");

        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(false);
        expect(results[0].children.length).toBeGreaterThan(0);
        expect(results[0].children[0].message).toContain("exceeds 120 columns");
    });

    it("should skip lines inside code blocks", async () => {
        const longCodeLine = "resource \"very_long_resource_name\" \"example\" { this_is_a_very_long_attribute = \"" + "x".repeat(100) + "\" }";
        const md = [
            "# Resource",
            "",
            "```hcl",
            longCodeLine,
            "```",
        ].join("\n");

        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
    });

    it("should skip lines inside frontmatter", async () => {
        const longFmLine = "description: " + "A".repeat(120);
        const md = [
            "---",
            longFmLine,
            "---",
            "",
            "# Resource",
        ].join("\n");

        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
    });

    it("should skip HTML anchor lines", async () => {
        const longAnchor = `<a name="very_long_anchor_name_that_exceeds_limit_${"x".repeat(100)}">`;
        const md = [
            "# Resource",
            "",
            longAnchor,
        ].join("\n");

        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
    });

    it("should report multiple violations as children", async () => {
        const longLine = "A".repeat(121);
        const md = [
            "# Resource",
            "",
            longLine,
            "",
            longLine,
        ].join("\n");

        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(false);
        expect(results[0].children).toHaveLength(2);
    });
});

// ─── NumberFormatRule ───────────────────────────────────────

describe("NumberFormatRule", () => {
    const rule = new NumberFormatRule();

    it("should pass when numbers are properly wrapped", async () => {
        const md = [
            "# Resource",
            "",
            "The valid value is range from `0` to `65,535`.",
        ].join("\n");

        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
    });

    it("should pass when numbers are bold-wrapped", async () => {
        const md = [
            "# Resource",
            "",
            "The status code is **200**.",
        ].join("\n");

        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
    });

    it("should fail for bare numbers in prose", async () => {
        const md = [
            "# Resource",
            "",
            "The maximum value is 65535.",
        ].join("\n");

        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(false);
        expect(results[0].children.length).toBeGreaterThan(0);
    });

    it("should suggest thousands separator for large numbers", async () => {
        const md = [
            "# Resource",
            "",
            "The maximum value is 65535.",
        ].join("\n");

        const results = await check(rule, md);
        const violation = results[0].children[0];
        expect(violation.message).toContain("65,535");
    });

    it("should skip numbers inside code blocks", async () => {
        const md = [
            "# Resource",
            "",
            "```hcl",
            "port = 65535",
            "```",
        ].join("\n");

        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
    });

    it("should skip numbers inside frontmatter", async () => {
        const md = [
            "---",
            "version: 12345",
            "---",
            "",
            "# Resource",
        ].join("\n");

        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
    });

    it("should skip single-digit numbers", async () => {
        const md = [
            "# Resource",
            "",
            "This has 2 items.",
        ].join("\n");

        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
    });

    it("should skip numbers in headings", async () => {
        const md = [
            "# Resource 123",
            "",
            "Description.",
        ].join("\n");

        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
    });

    it("should detect bare number that needs wrapping", async () => {
        const md = [
            "# Resource",
            "",
            "The port ranges from 10 to 99.",
        ].join("\n");

        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(false);
        expect(results[0].children.length).toBeGreaterThanOrEqual(1);
    });

    it("should accept already-formatted thousands", async () => {
        const md = [
            "# Resource",
            "",
            "The limit is `65,535` items.",
        ].join("\n");

        const results = await check(rule, md);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
    });
});
