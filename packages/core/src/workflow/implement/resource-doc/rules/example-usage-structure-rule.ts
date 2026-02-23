import type { MarkdownNode } from "../../../../tools/ast-parser/markdown";
import { MarkdownParser } from "../../../../tools/ast-parser/markdown";
import {
    NodePattern,
    heading,
    codeBlock,
    nodeWhere,
    zeroOrMore,
    tagged,
    group,
    oneOrMoreGroup,
} from "../../../../tools/node-pattern";
import { Rule, RuleCheckResult, RuleMeta } from "../../../types/rule/rule";
import { Context } from "../../../context/context";

const META: RuleMeta = {
    name: "example-usage-structure",
    description:
        "Example Usage section: multiple examples require each to have " +
        "a ### heading; single example must not have a heading",
    messages: {
        missingH3: (line: unknown) =>
            `Example Usage has multiple examples but a code block ` +
            `at line ${line} is not preceded by a ### heading. ` +
            `Each example must have its own ### title.`,
        unnecessaryH3: (line: unknown) =>
            `Example Usage has only one example but includes a ### ` +
            `heading at line ${line}. ` +
            `Single examples should not have a ### heading.`,
    },
};

const notCodeNotH3 = nodeWhere(
    (n) => n.type !== "code_block" &&
        !(n.type === "heading" && n.level === 3),
    "non-code, non-h3"
);

/** Single example: one bare code block, no ### headings. */
const SINGLE_EXAMPLE = new NodePattern([
    codeBlock(),
]);

/** Multiple examples: 2+ groups of (### heading → content → code block). */
const MULTI_EXAMPLE = new NodePattern([
    group([
        heading(3),
        zeroOrMore(notCodeNotH3),
        codeBlock(),
    ]),
    oneOrMoreGroup([
        zeroOrMore(notCodeNotH3),
        heading(3),
        zeroOrMore(notCodeNotH3),
        codeBlock(),
    ]),
]);

/** Diagnostic helper: locate (h3 → code) pairs via findAll. */
const H3_THEN_CODE = new NodePattern([
    tagged("title", heading(3)),
    zeroOrMore(notCodeNotH3),
    tagged("code", codeBlock()),
]);

function matchesFully(
    pattern: NodePattern, nodes: MarkdownNode[]
): boolean {
    const result = pattern.match(nodes);
    return result.ok && result.value.length === nodes.length;
}

export class ExampleUsageStructureRule extends Rule {
    private readonly parser = new MarkdownParser();

    constructor() {
        super(META, "code");
    }

    public async test(
        code: string,
        ast?: unknown,
        _parentCtx?: Context
    ): Promise<RuleCheckResult[]> {
        if (!ast) return [];

        const doc = ast as MarkdownNode;
        const nodes = this.parser.getSection(doc, 2, "Example Usage");
        if (!nodes) return [];

        const codeBlocks = this.parser.filterByType(nodes, "code_block");
        if (codeBlocks.length === 0) return [];

        if (matchesFully(SINGLE_EXAMPLE, nodes) ||
            matchesFully(MULTI_EXAMPLE, nodes)) {
            return [];
        }

        if (codeBlocks.length === 1) {
            const h3Headings = nodes.filter(
                (n) => n.type === "heading" && n.level === 3
            );
            return h3Headings.map((n) =>
                this.fail("unnecessaryH3", code, undefined,
                    n.sourceRange?.start.line ?? 0)
            );
        }

        const matches = H3_THEN_CODE.findAll(nodes);
        const matchedCodes = new Set(
            matches.flatMap((m) => m.tagged["code"])
        );

        return codeBlocks
            .filter((n) => !matchedCodes.has(n))
            .map((n) =>
                this.fail("missingH3", code, undefined,
                    n.sourceRange?.start.line ?? 0)
            );
    }
}
