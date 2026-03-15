import type { MarkdownNode } from "../../../../../tools/ast-parser/markdown";
import { MarkdownParser } from "../../../../../tools/ast-parser/markdown";
import { Rule, RuleCheckResult, type RuleMeta } from "../../../../types/rule/rule";
import type { Context } from "../../../../context/context";
import type { SchemaSemanticView } from "../../types";
import { CTX_SCHEMA_SEMANTIC_VIEW } from "../../context-keys";

interface SectionExpectation {
    title: string;
    level: number;
    shouldExist: (view: SchemaSemanticView) => boolean;
    reason: (view: SchemaSemanticView) => string;
}

const SECTION_EXPECTATIONS: SectionExpectation[] = [
    {
        title: "Argument Reference",
        level: 2,
        shouldExist: (v) => v.arguments.size > 0,
        reason: (v) => `schema has ${v.arguments.size} argument(s)`,
    },
    {
        title: "Attribute Reference",
        level: 2,
        shouldExist: (v) => v.attributes.size > 0,
        reason: (v) => `schema has ${v.attributes.size} attribute(s)`,
    },
    {
        title: "Timeouts",
        level: 2,
        shouldExist: (v) => v.timeouts !== null,
        reason: () => "schema defines timeouts",
    },
    {
        title: "Import",
        level: 2,
        shouldExist: (v) => v.importInfo.importable,
        reason: () => "schema is importable",
    },
];

const META: RuleMeta = {
    name: "section-existence",
    description:
        "Markdown sections must exist if and only if the schema has corresponding data",
    messages: {
        missing: (title: unknown, reason: unknown) =>
            `Section "## ${title}" is missing but expected: ${reason}.`,
        unexpected: (title: unknown) =>
            `Section "## ${title}" exists but has no corresponding schema data.`,
    },
};

export class SectionExistenceRule extends Rule {
    private readonly parser = new MarkdownParser();

    constructor() {
        super(META, "markdown");
    }

    public async test(
        _code: string,
        ast?: unknown,
        parentCtx?: Context,
    ): Promise<RuleCheckResult[]> {
        if (!ast || !parentCtx) {
            return [RuleCheckResult.pass("AST or context unavailable, rule skipped")];
        }

        const view = parentCtx.get<SchemaSemanticView>(CTX_SCHEMA_SEMANTIC_VIEW);
        if (!view) {
            return [RuleCheckResult.pass("Schema semantic view unavailable, rule skipped")];
        }

        const doc = ast as MarkdownNode;
        const results: RuleCheckResult[] = [];

        for (const expectation of SECTION_EXPECTATIONS) {
            const section = this.parser.getSection(doc, expectation.level, expectation.title);
            const exists = section !== null && section !== undefined;
            const expected = expectation.shouldExist(view);

            if (expected && !exists) {
                results.push(
                    this.fail(
                        "missing",
                        "",
                        undefined,
                        undefined,
                        expectation.title,
                        expectation.reason(view),
                    ),
                );
            } else if (!expected && exists) {
                const startLine = section?.[0]?.sourceRange?.start.line;
                results.push(
                    this.fail(
                        "unexpected",
                        "",
                        undefined,
                        RuleCheckResult.fromLine(startLine),
                        expectation.title,
                    ),
                );
            } else {
                const label = expected ? "present as expected" : "absent as expected";
                results.push(
                    RuleCheckResult.pass(
                        `Section "## ${expectation.title}" is ${label}`,
                    ),
                );
            }
        }

        return results;
    }
}
