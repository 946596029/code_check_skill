import type { MarkdownNode } from "../../../../../../tools/ast-parser/markdown";
import { MarkdownParser } from "../../../../../../tools/ast-parser/markdown";
import { Rule, RuleCheckResult, type RuleMeta } from "../../../../../types/rule/rule";
import type { Context } from "../../../../../context/context";
import type { SchemaSemanticView } from "../../../types";
import type { DocSemanticView } from "../../../tools/doc-semantic";
import { CTX_SCHEMA_SEMANTIC_VIEW, CTX_DOC_SEMANTIC_VIEW } from "../../../context-keys";

interface SectionExpectation {
    title: string;
    level: number;
    shouldExist: (view: SchemaSemanticView) => boolean;
    reason: (view: SchemaSemanticView) => string;
    schemaFields?: (view: SchemaSemanticView) => string[];
    docFields?: (docView: DocSemanticView) => string[];
    introLine?: string;
}

const SECTION_EXPECTATIONS: SectionExpectation[] = [
    {
        title: "Argument Reference",
        level: 2,
        shouldExist: (v) => v.arguments.size > 0,
        reason: (v) => `schema has ${v.arguments.size} argument(s)`,
        schemaFields: (v) => [...v.arguments.keys()],
        docFields: (d) => d.argumentLists.flatMap((l) => l.arguments.map((a) => a.name)),
        introLine: "The following arguments are supported:",
    },
    {
        title: "Attribute Reference",
        level: 2,
        shouldExist: (v) => v.attributes.size > 0,
        reason: (v) => `schema has ${v.attributes.size} attribute(s)`,
        schemaFields: (v) => [...v.attributes.keys()],
        docFields: (d) => d.attributeLists.flatMap((l) => l.attributes.map((a) => a.name)),
        introLine: "In addition to all arguments above, the following attributes are exported:",
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
        missing: (title: unknown, reason: unknown, fields: unknown) =>
            `Section "## ${title}" is missing but expected: ${reason}.` +
            (fields ? ` Schema fields: [${fields}]` : ""),
        unexpected: (title: unknown, fields: unknown) =>
            `Section "## ${title}" exists but has no corresponding schema data.` +
            (fields ? ` Doc fields to remove: [${fields}]` : ""),
        introMismatch: (title: unknown, expected: unknown, actual: unknown) =>
            `Section "## ${title}" intro line should be "${expected}" but found "${actual}".`,
        introMissing: (title: unknown, expected: unknown) =>
            `Section "## ${title}" is missing the required intro line: "${expected}".`,
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

        const docView = parentCtx.get<DocSemanticView>(CTX_DOC_SEMANTIC_VIEW);
        const doc = ast as MarkdownNode;
        const results: RuleCheckResult[] = [];

        for (const expectation of SECTION_EXPECTATIONS) {
            const section = this.parser.getSection(doc, expectation.level, expectation.title);
            const exists = section !== null && section !== undefined;
            const expected = expectation.shouldExist(view);

            if (expected && !exists) {
                const schemaFieldList = expectation.schemaFields
                    ? expectation.schemaFields(view).join(", ")
                    : "";
                results.push(
                    this.fail(
                        "missing",
                        "",
                        undefined,
                        undefined,
                        expectation.title,
                        expectation.reason(view),
                        schemaFieldList,
                    ),
                );
            } else if (!expected && exists) {
                const startLine = section?.[0]?.sourceRange?.start.line;
                const docFieldList = (expectation.docFields && docView)
                    ? expectation.docFields(docView).join(", ")
                    : "";
                results.push(
                    this.fail(
                        "unexpected",
                        "",
                        undefined,
                        RuleCheckResult.fromLine(startLine),
                        expectation.title,
                        docFieldList,
                    ),
                );
            } else if (expected && exists && expectation.introLine) {
                const introResult = this.checkIntroLine(
                    section!, expectation.title, expectation.introLine,
                );
                results.push(introResult);
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

    private checkIntroLine(
        sectionNodes: MarkdownNode[],
        title: string,
        expectedIntro: string,
    ): RuleCheckResult {
        const firstParagraph = sectionNodes.find((n) => n.type === "paragraph");
        if (!firstParagraph) {
            return this.fail(
                "introMissing",
                "",
                undefined,
                undefined,
                title,
                expectedIntro,
            );
        }

        const actualText = this.parser.getTextContent(firstParagraph).trim();
        if (actualText === expectedIntro) {
            return RuleCheckResult.pass(
                `Section "## ${title}" is present with correct intro line`,
            );
        }

        const startLine = firstParagraph.sourceRange?.start.line;
        return this.fail(
            "introMismatch",
            "",
            undefined,
            RuleCheckResult.fromLine(startLine),
            title,
            expectedIntro,
            actualText,
        );
    }
}
