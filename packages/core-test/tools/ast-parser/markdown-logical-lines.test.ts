import { describe, it, expect } from "vitest";
import { MarkdownParser } from "@code-check/core";

describe("MarkdownParser - getLogicalLines()", () => {
    const parser = new MarkdownParser();

    describe("paragraph with soft breaks", () => {
        const MD = [
            "This is a long line that exceeds the column limit so the author",
            "wrapped it to the next line for readability.",
        ].join("\n");

        it("should merge soft-wrapped lines into a single logical line", () => {
            const ast = parser.parse(MD);
            const paragraphs = parser.findByType(ast, "paragraph");
            const result = parser.getLogicalLines(MD, paragraphs[0]);

            expect(result).not.toBeNull();
            expect(result!.lines).toEqual([
                "This is a long line that exceeds the column limit so the author " +
                    "wrapped it to the next line for readability.",
            ]);
            expect(result!.startLine).toBe(1);
        });
    });

    describe("paragraph with hard breaks", () => {
        const MD = [
            "First logical line.  ",
            "Second logical line after hard break.",
        ].join("\n");

        it("should split at hard line breaks (trailing double-space)", () => {
            const ast = parser.parse(MD);
            const paragraphs = parser.findByType(ast, "paragraph");
            const result = parser.getLogicalLines(MD, paragraphs[0]);

            expect(result).not.toBeNull();
            expect(result!.lines).toEqual([
                "First logical line.",
                "Second logical line after hard break.",
            ]);
        });
    });

    describe("paragraph with backslash hard break", () => {
        const MD = "Line one.\\\nLine two.";

        it("should split at backslash hard break", () => {
            const ast = parser.parse(MD);
            const paragraphs = parser.findByType(ast, "paragraph");
            const result = parser.getLogicalLines(MD, paragraphs[0]);

            expect(result).not.toBeNull();
            expect(result!.lines).toEqual([
                "Line one.",
                "Line two.",
            ]);
        });
    });

    describe("paragraph with mixed hard and soft breaks", () => {
        const MD = [
            "* `region` - (Optional, String, ForceNew) Specifies the region.  ",
            "  If omitted, the provider-level region will be used.",
            "  Changing this parameter will create a new resource.",
        ].join("\n");

        it("should split at hard break and merge soft-wrapped continuation", () => {
            const ast = parser.parse(MD);
            const items = parser.findByType(ast, "item");
            const result = parser.getLogicalLines(MD, items[0]);

            expect(result).not.toBeNull();
            expect(result!.lines).toEqual([
                "* `region` - (Optional, String, ForceNew) Specifies the region.",
                "If omitted, the provider-level region will be used. " +
                    "Changing this parameter will create a new resource.",
            ]);
        });
    });

    describe("list with multiple items", () => {
        const MD = [
            "* `instance_id` - (Required, String, NonUpdatable) Specifies the ID of the dedicated instance to which the channel",
            "  member belongs.",
            "",
            "* `vpc_channel_id` - (Required, String, NonUpdatable) Specifies the ID of the VPC channel.",
        ].join("\n");

        it("should produce one logical line per item, merging wrapped items", () => {
            const ast = parser.parse(MD);
            const lists = parser.findByType(ast, "list");
            const result = parser.getLogicalLines(MD, lists[0]);

            expect(result).not.toBeNull();
            expect(result!.lines).toEqual([
                "* `instance_id` - (Required, String, NonUpdatable) Specifies the ID of the dedicated instance to which the channel " +
                    "member belongs.",
                "* `vpc_channel_id` - (Required, String, NonUpdatable) Specifies the ID of the VPC channel.",
            ]);
            expect(result!.startLine).toBe(1);
        });
    });

    describe("heading node", () => {
        const MD = "## Argument Reference\n\nSome text.";

        it("should return the heading as a single logical line", () => {
            const ast = parser.parse(MD);
            const headings = parser.findByType(ast, "heading");
            const result = parser.getLogicalLines(MD, headings[0]);

            expect(result).not.toBeNull();
            expect(result!.lines).toEqual(["## Argument Reference"]);
        });
    });

    describe("single-line paragraph (no wrapping)", () => {
        const MD = "Just a short paragraph.";

        it("should return the line unchanged", () => {
            const ast = parser.parse(MD);
            const paragraphs = parser.findByType(ast, "paragraph");
            const result = parser.getLogicalLines(MD, paragraphs[0]);

            expect(result).not.toBeNull();
            expect(result!.lines).toEqual(["Just a short paragraph."]);
        });
    });

    describe("code block", () => {
        const MD = "```hcl\nresource \"test\" {\n  name = \"foo\"\n}\n```";

        it("should return source lines unchanged for code blocks", () => {
            const ast = parser.parse(MD);
            const codeBlocks = parser.findByType(ast, "code_block");
            const result = parser.getLogicalLines(MD, codeBlocks[0]);

            expect(result).not.toBeNull();
            expect(result!.lines[0]).toBe("```hcl");
        });
    });

    describe("node without sourceRange", () => {
        it("should return null", () => {
            const MD = "text";
            const node = {
                type: "text" as const,
                literal: "hello",
                destination: null,
                title: null,
                info: null,
                level: null,
                listType: null,
                listTight: null,
                listStart: null,
                listDelimiter: null,
                data: null,
                sourceRange: null,
                children: [],
            };
            expect(parser.getLogicalLines(MD, node)).toBeNull();
        });
    });

    describe("thematic_break and frontmatter", () => {
        it("should return null for thematic_break", () => {
            const MD = "text\n\n---\n\nmore text";
            const ast = parser.parse(MD);
            const breaks = parser.findByType(ast, "thematic_break");
            if (breaks.length > 0) {
                expect(parser.getLogicalLines(MD, breaks[0])).toBeNull();
            }
        });

        it("should return null for frontmatter", () => {
            const MD = "---\ntitle: Test\n---\n\n# Heading";
            const ast = parser.parse(MD);
            const fm = parser.findByType(ast, "frontmatter");
            expect(fm.length).toBe(1);
            expect(parser.getLogicalLines(MD, fm[0])).toBeNull();
        });
    });

    describe("document-level with frontmatter", () => {
        const MD = [
            "---",
            "title: Demo",
            "---",
            "",
            "# Title",
            "",
            "A long paragraph that wraps because the author set a column",
            "limit of 80 characters in their editor.",
        ].join("\n");

        it("should return logical lines for the whole document body", () => {
            const ast = parser.parse(MD);
            const result = parser.getLogicalLines(MD, ast);

            expect(result).not.toBeNull();
            expect(result!.lines).toEqual([
                "# Title",
                "A long paragraph that wraps because the author set a column " +
                    "limit of 80 characters in their editor.",
            ]);
        });
    });

    describe("comparison with getNodeText (source lines)", () => {
        const MD = [
            "* `port` - (Required, Int, NonUpdatable) Specifies the port number of the channel member.  ",
            "  The valid value is range from `0` to `65,535`.",
        ].join("\n");

        it("getNodeText should return raw source lines with wrapping", () => {
            const ast = parser.parse(MD);
            const items = parser.findByType(ast, "item");
            const result = parser.getNodeText(MD, items[0]);

            expect(result).not.toBeNull();
            expect(result!.lines).toHaveLength(2);
            expect(result!.lines[0]).toContain("channel member.  ");
            expect(result!.lines[1]).toContain("  The valid value");
        });

        it("getLogicalLines should merge into logical lines", () => {
            const ast = parser.parse(MD);
            const items = parser.findByType(ast, "item");
            const result = parser.getLogicalLines(MD, items[0]);

            expect(result).not.toBeNull();
            expect(result!.lines).toEqual([
                "* `port` - (Required, Int, NonUpdatable) Specifies the port number of the channel member.",
                "The valid value is range from `0` to `65,535`.",
            ]);
        });
    });
});
