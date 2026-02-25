import { describe, it, expect } from "vitest";
import {
    ExampleUsageStructureRule,
    MarkdownParser,
} from "@code-check/core";

const parser = new MarkdownParser();
const rule = new ExampleUsageStructureRule();

function check(md: string) {
    const ast = parser.parse(md);
    return rule.test(md, ast);
}

function expectPassResult(results: Awaited<ReturnType<typeof check>>) {
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].message).toContain("Example Usage");
}

describe("ExampleUsageStructureRule", () => {
    describe("pass — no Example Usage section", () => {
        it("should pass when there is no Example Usage section", async () => {
            const results = await check([
                "# Resource",
                "",
                "Some description.",
            ].join("\n"));

            expectPassResult(results);
        });
    });

    describe("pass — no code blocks", () => {
        it("should pass when Example Usage has no code blocks", async () => {
            const results = await check([
                "# Resource",
                "",
                "## Example Usage",
                "",
                "No code here.",
            ].join("\n"));

            expectPassResult(results);
        });
    });

    describe("pass — single code block without h3", () => {
        it("should pass with a bare code block", async () => {
            const results = await check([
                "# Resource",
                "",
                "## Example Usage",
                "",
                "```hcl",
                'resource "aws_instance" "example" {}',
                "```",
            ].join("\n"));

            expectPassResult(results);
        });

        it("should pass with a paragraph before the code block", async () => {
            const results = await check([
                "# Resource",
                "",
                "## Example Usage",
                "",
                "Here is an example:",
                "",
                "```hcl",
                'resource "aws_instance" "example" {}',
                "```",
            ].join("\n"));

            expectPassResult(results);
        });
    });

    describe("fail — single code block with h3", () => {
        it("should fail when one code block has a h3 heading", async () => {
            const results = await check([
                "# Resource",
                "",
                "## Example Usage",
                "",
                "### Basic Example",
                "",
                "```hcl",
                'resource "aws_instance" "example" {}',
                "```",
            ].join("\n"));

            expect(results).toHaveLength(1);
            expect(results[0].success).toBe(false);
            expect(results[0].message).toContain("only one example");
        });

        it("should report each unnecessary h3", async () => {
            const results = await check([
                "# Resource",
                "",
                "## Example Usage",
                "",
                "### First Heading",
                "",
                "### Second Heading",
                "",
                "```hcl",
                'resource "aws_instance" "example" {}',
                "```",
            ].join("\n"));

            expect(results).toHaveLength(2);
            results.forEach((r) => {
                expect(r.success).toBe(false);
                expect(r.message).toContain("###");
            });
        });
    });

    describe("pass — multiple code blocks each with h3", () => {
        it("should pass when every code block has its own h3", async () => {
            const results = await check([
                "# Resource",
                "",
                "## Example Usage",
                "",
                "### Basic",
                "",
                "```hcl",
                'resource "aws_instance" "basic" {}',
                "```",
                "",
                "### Advanced",
                "",
                "```hcl",
                'resource "aws_instance" "advanced" {}',
                "```",
            ].join("\n"));

            expectPassResult(results);
        });

        it("should pass with paragraphs between h3 and code block", async () => {
            const results = await check([
                "# Resource",
                "",
                "## Example Usage",
                "",
                "### Basic",
                "",
                "This shows a basic setup.",
                "",
                "```hcl",
                'resource "aws_instance" "basic" {}',
                "```",
                "",
                "### Advanced",
                "",
                "An advanced configuration:",
                "",
                "```hcl",
                'resource "aws_instance" "advanced" {}',
                "```",
            ].join("\n"));

            expectPassResult(results);
        });
    });

    describe("fail — multiple code blocks, some without h3", () => {
        it("should fail for code blocks not preceded by h3", async () => {
            const results = await check([
                "# Resource",
                "",
                "## Example Usage",
                "",
                "```hcl",
                'resource "aws_instance" "first" {}',
                "```",
                "",
                "```hcl",
                'resource "aws_instance" "second" {}',
                "```",
            ].join("\n"));

            expect(results).toHaveLength(2);
            results.forEach((r) => {
                expect(r.success).toBe(false);
                expect(r.message).toContain("not preceded by a ### heading");
            });
        });

        it("should fail only for the unmatched code block", async () => {
            const results = await check([
                "# Resource",
                "",
                "## Example Usage",
                "",
                "### Basic",
                "",
                "```hcl",
                'resource "aws_instance" "basic" {}',
                "```",
                "",
                "```hcl",
                'resource "aws_instance" "orphan" {}',
                "```",
            ].join("\n"));

            expect(results).toHaveLength(1);
            expect(results[0].success).toBe(false);
            expect(results[0].message).toContain("not preceded by a ### heading");
        });
    });

    describe("boundary — section ends at next h2", () => {
        it("should not consider code blocks in other sections", async () => {
            const results = await check([
                "# Resource",
                "",
                "## Example Usage",
                "",
                "```hcl",
                'resource "aws_instance" "example" {}',
                "```",
                "",
                "## Argument Reference",
                "",
                "```hcl",
                "unrelated code",
                "```",
            ].join("\n"));

            expectPassResult(results);
        });
    });

    describe("pass — no ast provided", () => {
        it("should return skipped pass result when ast is undefined", async () => {
            const results = await rule.test("any code");
            expect(results).toHaveLength(1);
            expect(results[0].success).toBe(true);
            expect(results[0].message).toContain("AST is unavailable");
        });
    });
});
