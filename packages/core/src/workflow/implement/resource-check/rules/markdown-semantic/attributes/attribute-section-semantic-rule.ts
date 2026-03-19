import { Rule, RuleCheckResult, type RuleMeta } from "../../../../../types/rule/rule";
import type { Context } from "../../../../../context/context";
import type { SchemaSemanticView } from "../../../types";
import type { Attribute, DocSemanticView } from "../../../tools/doc-semantic";
import { CTX_SCHEMA_SEMANTIC_VIEW, CTX_DOC_SEMANTIC_VIEW } from "../../../context-keys";

const META: RuleMeta = {
    name: "attribute-section-semantic",
    description:
        "Attributes in the Markdown document must align with the provider schema " +
        "(completeness and consistency)",
    messages: {
        missingInDoc: (name: unknown) =>
            `Attribute "${name}" is defined in schema but missing from the document.`,
        extraInDoc: (name: unknown, line: unknown) =>
            `Attribute "${name}" (line ${line}) is documented but not found in the schema.`,
        descriptionMismatch: (name: unknown, expected: unknown, actual: unknown, line: unknown) =>
            `Attribute "${name}" (line ${line}): description should be "${expected}" ` +
            `but found "${actual}".`,
    },
};

export class AttributeSectionSemanticRule extends Rule {
    constructor() {
        super(META, "markdown");
    }

    public async test(
        _code: string,
        _ast?: unknown,
        parentCtx?: Context,
    ): Promise<RuleCheckResult[]> {
        if (!parentCtx) {
            return [RuleCheckResult.pass("Context unavailable, rule skipped")];
        }

        const view = parentCtx.get<SchemaSemanticView>(CTX_SCHEMA_SEMANTIC_VIEW);
        const docView = parentCtx.get<DocSemanticView>(CTX_DOC_SEMANTIC_VIEW);
        if (!view || !docView) {
            return [RuleCheckResult.pass("Schema view or doc semantic view unavailable, rule skipped")];
        }

        if (view.attributes.size === 0) {
            return [RuleCheckResult.pass("No schema attributes, attribute semantic check skipped")];
        }

        const docAttrs = docView.attributeLists.flatMap((list) => list.attributes);
        if (docAttrs.length === 0) {
            return [RuleCheckResult.pass(
                "No doc attributes found, existence checked by SectionExistenceRule",
            )];
        }

        const failures: RuleCheckResult[] = [];

        this.checkCompleteness(docAttrs, view, failures);
        this.checkDescriptionAlignment(docAttrs, view, failures);

        if (failures.length === 0) {
            return [RuleCheckResult.pass("Attribute section semantic checks passed")];
        }

        return [
            new RuleCheckResult(
                false,
                `Attribute section has ${failures.length} semantic issue(s)`,
                "",
                "",
                failures,
            ),
        ];
    }

    private checkCompleteness(
        docAttrs: Attribute[],
        view: SchemaSemanticView,
        failures: RuleCheckResult[],
    ): void {
        const docAttrNames = new Set(docAttrs.map((a) => a.name));

        for (const [name] of view.attributes) {
            if (!docAttrNames.has(name)) {
                failures.push(
                    this.fail("missingInDoc", "", undefined, undefined, name),
                );
            }
        }

        for (const attr of docAttrs) {
            if (!view.attributes.has(attr.name)) {
                const line = getStartLine(attr);
                failures.push(
                    this.fail(
                        "extraInDoc",
                        "",
                        undefined,
                        RuleCheckResult.fromLine(line),
                        attr.name,
                        line,
                    ),
                );
            }
        }
    }

    private checkDescriptionAlignment(
        docAttrs: Attribute[],
        view: SchemaSemanticView,
        failures: RuleCheckResult[],
    ): void {
        for (const attr of docAttrs) {
            const field = view.attributes.get(attr.name);
            if (!field || !field.description) continue;

            const expected = field.description.trim();
            const actual = attr.description.trim();
            if (expected && actual !== expected) {
                const previewLen = Math.min(expected.length + 20, 80);
                const actualPreview = actual.length > previewLen
                    ? actual.slice(0, previewLen) + "..."
                    : actual;
                const line = getStartLine(attr);
                failures.push(
                    this.fail(
                        "descriptionMismatch",
                        "",
                        undefined,
                        RuleCheckResult.fromLine(line),
                        attr.name,
                        expected,
                        actualPreview,
                        line,
                    ),
                );
            }
        }
    }
}

function getStartLine(attr: Attribute): number | undefined {
    return attr.sourceRange?.start.line;
}
