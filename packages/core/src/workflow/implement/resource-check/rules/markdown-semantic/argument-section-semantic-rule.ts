import { Rule, RuleCheckResult, type RuleMeta } from "../../../../types/rule/rule";
import type { Context } from "../../../../context/context";
import type { SchemaSemanticView, DocStructure, DocArgument, SemanticField } from "../../types";
import { CTX_SCHEMA_SEMANTIC_VIEW, CTX_DOC_STRUCTURE } from "../../context-keys";

const META: RuleMeta = {
    name: "argument-section-semantic",
    description:
        "Arguments in the Markdown document must align with the provider schema " +
        "(ordering, modifiers, tags, completeness)",
    messages: {
        regionNotFirst: (line: unknown) =>
            `Argument "region" must be the first argument, but found at line ${line}.`,
        orderViolation: (name: unknown, line: unknown) =>
            `Required argument "${name}" (line ${line}) appears after Optional arguments. ` +
            `All Required arguments must precede Optional ones.`,
        modifierMismatch: (name: unknown, expected: unknown, actual: unknown, line: unknown) =>
            `Argument "${name}" (line ${line}): modifier should be "${expected}" but is "${actual}".`,
        missingTag: (name: unknown, tag: unknown, line: unknown) =>
            `Argument "${name}" (line ${line}): missing expected tag "${tag}".`,
        extraTag: (name: unknown, tag: unknown, line: unknown) =>
            `Argument "${name}" (line ${line}): unexpected tag "${tag}" (not in schema).`,
        descriptionMismatch: (name: unknown, expected: unknown, actual: unknown, line: unknown) =>
            `Argument "${name}" (line ${line}): description should start with "${expected}" ` +
            `but found "${actual}".`,
        missingInDoc: (name: unknown) =>
            `Argument "${name}" is defined in schema but missing from the document.`,
        extraInDoc: (name: unknown, line: unknown) =>
            `Argument "${name}" (line ${line}) is documented but not found in the schema.`,
    },
};

const TAG_SCHEMA_MAP: Record<string, (f: SemanticField) => boolean> = {
    ForceNew: (f) => f.forceNew,
    NonUpdatable: (f) => f.nonUpdatable,
};

export class ArgumentSectionSemanticRule extends Rule {
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
        const doc = parentCtx.get<DocStructure>(CTX_DOC_STRUCTURE);
        if (!view || !doc) {
            return [RuleCheckResult.pass("Schema view or doc structure unavailable, rule skipped")];
        }

        if (view.arguments.size === 0) {
            return [RuleCheckResult.pass("No schema arguments, argument semantic check skipped")];
        }

        const docArgs = doc.arguments;
        if (docArgs.length === 0) {
            return [RuleCheckResult.pass("No doc arguments found, existence checked by SectionExistenceRule")];
        }

        const failures: RuleCheckResult[] = [];

        this.checkOrdering(docArgs, failures);
        this.checkTagAlignment(docArgs, view, failures);
        this.checkDescriptionAlignment(docArgs, view, failures);
        this.checkCompleteness(docArgs, view, failures);

        if (failures.length === 0) {
            return [RuleCheckResult.pass("Argument section semantic checks passed")];
        }

        return [
            new RuleCheckResult(
                false,
                `Argument section has ${failures.length} semantic issue(s)`,
                "",
                "",
                failures,
            ),
        ];
    }

    private checkOrdering(docArgs: DocArgument[], failures: RuleCheckResult[]): void {
        if (docArgs.length === 0) return;

        const regionIndex = docArgs.findIndex((a) => a.name === "region");
        if (regionIndex > 0) {
            failures.push(
                this.fail(
                    "regionNotFirst",
                    "",
                    undefined,
                    RuleCheckResult.fromLine(docArgs[regionIndex].startLine),
                    docArgs[regionIndex].startLine,
                ),
            );
        }

        let lastRequiredIndex = -1;
        let firstOptionalIndex = -1;

        for (let i = 0; i < docArgs.length; i++) {
            const arg = docArgs[i];
            if (arg.name === "region") continue;

            if (arg.modifier === "Required") {
                lastRequiredIndex = i;
                if (firstOptionalIndex >= 0) {
                    failures.push(
                        this.fail(
                            "orderViolation",
                            "",
                            undefined,
                            RuleCheckResult.fromLine(arg.startLine),
                            arg.name,
                            arg.startLine,
                        ),
                    );
                }
            } else if (arg.modifier === "Optional") {
                if (firstOptionalIndex < 0) {
                    firstOptionalIndex = i;
                }
            }
        }
    }

    private checkTagAlignment(
        docArgs: DocArgument[],
        view: SchemaSemanticView,
        failures: RuleCheckResult[],
    ): void {
        for (const arg of docArgs) {
            const field = view.arguments.get(arg.name);
            if (!field) continue;

            const expectedModifier = field.required ? "Required" : "Optional";
            if (arg.modifier !== expectedModifier) {
                failures.push(
                    this.fail(
                        "modifierMismatch",
                        "",
                        undefined,
                        RuleCheckResult.fromLine(arg.startLine),
                        arg.name,
                        expectedModifier,
                        arg.modifier,
                        arg.startLine,
                    ),
                );
            }

            const docTagSet = new Set(arg.tags);
            for (const [tag, predicate] of Object.entries(TAG_SCHEMA_MAP)) {
                if (predicate(field) && !docTagSet.has(tag)) {
                    failures.push(
                        this.fail(
                            "missingTag",
                            "",
                            undefined,
                            RuleCheckResult.fromLine(arg.startLine),
                            arg.name,
                            tag,
                            arg.startLine,
                        ),
                    );
                }
                if (!predicate(field) && docTagSet.has(tag)) {
                    failures.push(
                        this.fail(
                            "extraTag",
                            "",
                            undefined,
                            RuleCheckResult.fromLine(arg.startLine),
                            arg.name,
                            tag,
                            arg.startLine,
                        ),
                    );
                }
            }
        }
    }

    private checkDescriptionAlignment(
        docArgs: DocArgument[],
        view: SchemaSemanticView,
        failures: RuleCheckResult[],
    ): void {
        for (const arg of docArgs) {
            const field = view.arguments.get(arg.name);
            if (!field || !field.description) continue;

            const expectedPrefix = lowercaseFirst(field.description);
            const docDesc = arg.descriptionText;
            if (!docDesc.startsWith(expectedPrefix)) {
                const previewLen = expectedPrefix.length + 20;
                const actualPreview = docDesc.length > previewLen
                    ? docDesc.slice(0, previewLen) + "..."
                    : docDesc;
                failures.push(
                    this.fail(
                        "descriptionMismatch",
                        "",
                        undefined,
                        RuleCheckResult.fromLine(arg.startLine),
                        arg.name,
                        "Specifies " + expectedPrefix,
                        "Specifies " + actualPreview,
                        arg.startLine,
                    ),
                );
            }
        }
    }

    private checkCompleteness(
        docArgs: DocArgument[],
        view: SchemaSemanticView,
        failures: RuleCheckResult[],
    ): void {
        const docArgNames = new Set(docArgs.map((a) => a.name));

        for (const [name] of view.arguments) {
            if (!docArgNames.has(name)) {
                failures.push(
                    this.fail("missingInDoc", "", undefined, undefined, name),
                );
            }
        }

        for (const arg of docArgs) {
            if (!view.arguments.has(arg.name)) {
                failures.push(
                    this.fail(
                        "extraInDoc",
                        "",
                        undefined,
                        RuleCheckResult.fromLine(arg.startLine),
                        arg.name,
                        arg.startLine,
                    ),
                );
            }
        }
    }
}

function lowercaseFirst(s: string): string {
    if (s.length === 0) return s;
    return s[0].toLowerCase() + s.slice(1);
}
