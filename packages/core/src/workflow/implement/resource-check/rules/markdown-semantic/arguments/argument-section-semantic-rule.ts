import { Rule, RuleCheckResult, type RuleMeta } from "../../../../../types/rule/rule";
import type { Context } from "../../../../../context/context";
import type { SchemaSemanticView, SemanticField } from "../../../types";
import type { Argument, DocSemanticView } from "../../../tools/doc-semantic";
import { CTX_SCHEMA_SEMANTIC_VIEW, CTX_DOC_SEMANTIC_VIEW } from "../../../context-keys";

const META: RuleMeta = {
    name: "argument-section-semantic",
    description:
        "Arguments in the Markdown document must align with the provider schema " +
        "(ordering, tags, completeness)",
    messages: {
        regionNotFirst: (line: unknown) =>
            `Argument "region" must be the first argument, but found at line ${line}.`,
        orderViolation: (name: unknown, line: unknown) =>
            `Required argument "${name}" (line ${line}) appears after Optional arguments. ` +
            `All Required arguments must precede Optional ones.`,
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
        nestedMissingInDoc: (name: unknown, path: unknown) =>
            `Nested argument "${name}" (under "${path}") is defined in schema but missing from the document.`,
        nestedExtraInDoc: (name: unknown, path: unknown, line: unknown) =>
            `Nested argument "${name}" (under "${path}", line ${line}) is documented but not found in the schema.`,
        nestedDescriptionMismatch: (
            name: unknown,
            path: unknown,
            expected: unknown,
            actual: unknown,
            line: unknown,
        ) =>
            `Nested argument "${name}" (under "${path}", line ${line}): ` +
            `description should start with "${expected}" but found "${actual}".`,
    },
};

const TAG_SCHEMA_MAP: Record<string, (f: SemanticField) => boolean> = {
    ForceNew: (f) => f.forceNew && !f.nonUpdatable,
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
        const docView = parentCtx.get<DocSemanticView>(CTX_DOC_SEMANTIC_VIEW);

        if (!view || !docView) {
            return [RuleCheckResult.pass("Schema view or doc semantic view unavailable, rule skipped")];
        }

        if (view.arguments.size === 0) {
            return [RuleCheckResult.pass("No schema arguments, argument semantic check skipped")];
        }

        const docArgs = docView.argumentLists.flatMap((list) => list.arguments);
        if (docArgs.length === 0) {
            return [RuleCheckResult.pass("No doc arguments found, existence checked by SectionExistenceRule")];
        }

        const failures: RuleCheckResult[] = [];

        this.checkOrdering(docArgs, view, failures);
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

    private checkOrdering(
        docArgs: Argument[],
        view: SchemaSemanticView,
        failures: RuleCheckResult[],
    ): void {
        if (docArgs.length === 0) return;

        const regionIndex = docArgs.findIndex((a) => a.name === "region");
        if (regionIndex > 0) {
            const line = getStartLine(docArgs[regionIndex]);
            failures.push(
                this.fail(
                    "regionNotFirst",
                    "",
                    undefined,
                    RuleCheckResult.fromLine(line),
                    line,
                ),
            );
        }

        let firstOptionalIndex = -1;

        for (let i = 0; i < docArgs.length; i++) {
            const arg = docArgs[i];
            if (arg.name === "region") continue;
            const field = view.arguments.get(arg.name);
            if (!field) continue;

            if (field.required) {
                if (firstOptionalIndex >= 0) {
                    const line = getStartLine(arg);
                    failures.push(
                        this.fail(
                            "orderViolation",
                            "",
                            undefined,
                            RuleCheckResult.fromLine(line),
                            arg.name,
                            line,
                        ),
                    );
                }
            } else if (field.optional) {
                if (firstOptionalIndex < 0) {
                    firstOptionalIndex = i;
                }
            }
        }
    }

    private checkTagAlignment(
        docArgs: Argument[],
        view: SchemaSemanticView,
        failures: RuleCheckResult[],
    ): void {
        for (const arg of docArgs) {
            const field = view.arguments.get(arg.name);
            if (!field) continue;

            const docTagSet = new Set(arg.tags);
            for (const [tag, predicate] of Object.entries(TAG_SCHEMA_MAP)) {
                const line = getStartLine(arg);
                if (predicate(field) && !docTagSet.has(tag)) {
                    failures.push(
                        this.fail(
                            "missingTag",
                            "",
                            undefined,
                            RuleCheckResult.fromLine(line),
                            arg.name,
                            tag,
                            line,
                        ),
                    );
                }
                if (!predicate(field) && docTagSet.has(tag)) {
                    failures.push(
                        this.fail(
                            "extraTag",
                            "",
                            undefined,
                            RuleCheckResult.fromLine(line),
                            arg.name,
                            tag,
                            line,
                        ),
                    );
                }
            }
        }
    }

    private checkDescriptionAlignment(
        docArgs: Argument[],
        view: SchemaSemanticView,
        failures: RuleCheckResult[],
    ): void {
        for (const arg of docArgs) {
            const field = view.arguments.get(arg.name);
            if (!field || !field.description) continue;

            const expectedPrefix = "Specifies " + lowercaseFirst(field.description);
            const docDesc = arg.description;
            if (!docDesc.startsWith(expectedPrefix)) {
                const previewLen = expectedPrefix.length + 20;
                const actualPreview = docDesc.length > previewLen
                    ? docDesc.slice(0, previewLen) + "..."
                    : docDesc;
                const line = getStartLine(arg);
                failures.push(
                    this.fail(
                        "descriptionMismatch",
                        "",
                        undefined,
                        RuleCheckResult.fromLine(line),
                        arg.name,
                        expectedPrefix,
                        actualPreview,
                        line,
                    ),
                );
            }

            this.checkNestedDescriptionAlignment(
                arg.arguments,
                field.subFields ?? [],
                arg.name,
                failures,
            );
        }
    }

    private checkCompleteness(
        docArgs: Argument[],
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
                const line = getStartLine(arg);
                failures.push(
                    this.fail(
                        "extraInDoc",
                        "",
                        undefined,
                        RuleCheckResult.fromLine(line),
                        arg.name,
                        line,
                    ),
                );
                continue;
            }

            const schemaField = view.arguments.get(arg.name);
            if (schemaField) {
                this.checkNestedCompleteness(
                    arg.arguments,
                    schemaField.subFields ?? [],
                    arg.name,
                    failures,
                );
            }
        }
    }

    private checkNestedCompleteness(
        docArgs: Argument[],
        schemaSubFields: SemanticField[],
        path: string,
        failures: RuleCheckResult[],
    ): void {
        const schemaFieldMap = new Map(schemaSubFields.map((field) => [field.name, field]));
        const docArgNames = new Set(docArgs.map((a) => a.name));

        for (const [name] of schemaFieldMap) {
            if (!docArgNames.has(name)) {
                failures.push(
                    this.fail("nestedMissingInDoc", "", undefined, undefined, name, path),
                );
            }
        }

        for (const arg of docArgs) {
            const schemaField = schemaFieldMap.get(arg.name);
            if (!schemaField) {
                const line = getStartLine(arg);
                failures.push(
                    this.fail(
                        "nestedExtraInDoc",
                        "",
                        undefined,
                        RuleCheckResult.fromLine(line),
                        arg.name,
                        path,
                        line,
                    ),
                );
                continue;
            }

            this.checkNestedCompleteness(
                arg.arguments,
                schemaField.subFields ?? [],
                `${path} > ${arg.name}`,
                failures,
            );
        }
    }

    private checkNestedDescriptionAlignment(
        docArgs: Argument[],
        schemaSubFields: SemanticField[],
        path: string,
        failures: RuleCheckResult[],
    ): void {
        const schemaFieldMap = new Map(schemaSubFields.map((field) => [field.name, field]));
        for (const arg of docArgs) {
            const schemaField = schemaFieldMap.get(arg.name);
            if (!schemaField || !schemaField.description) continue;

            const expectedPrefix = "Specifies " + lowercaseFirst(schemaField.description);
            const docDesc = arg.description;
            if (!docDesc.startsWith(expectedPrefix)) {
                const previewLen = expectedPrefix.length + 20;
                const actualPreview = docDesc.length > previewLen
                    ? docDesc.slice(0, previewLen) + "..."
                    : docDesc;
                const line = getStartLine(arg);
                failures.push(
                    this.fail(
                        "nestedDescriptionMismatch",
                        "",
                        undefined,
                        RuleCheckResult.fromLine(line),
                        arg.name,
                        path,
                        expectedPrefix,
                        actualPreview,
                        line,
                    ),
                );
            }

            this.checkNestedDescriptionAlignment(
                arg.arguments,
                schemaField.subFields ?? [],
                `${path} > ${arg.name}`,
                failures,
            );
        }
    }
}

function lowercaseFirst(s: string): string {
    if (s.length === 0) return s;
    return s[0].toLowerCase() + s.slice(1);
}

function getStartLine(arg: Argument): number | undefined {
    return arg.sourceRange?.start.line;
}
