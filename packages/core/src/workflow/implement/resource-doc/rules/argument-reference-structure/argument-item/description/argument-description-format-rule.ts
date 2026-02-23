import { Rule, RuleCheckResult, RuleMeta } from "../../../../../../types/rule/rule";
import { Context } from "../../../../../../context/context";
import { CTX_ARG_REF_BULLET_LISTS } from "../../../../context-keys";
import type { MarkdownNode } from "../../../../../../../tools/ast-parser/markdown";
import { MarkdownParser } from "../../../../../../../tools/ast-parser/markdown";
import { createQwenModel } from "../../../../../../../llm/model";
import { DescriptionIntentClassifier } from "./description-intent-classifier";
import { getFormatSpec } from "./description-format-spec";

const META: RuleMeta = {
    name: "argument-description-format",
    description:
        "Argument description sub-lines with fixed-format semantics " +
        "(value range, enum values, char restriction, etc.) must follow " +
        "the standard text format",
    messages: {
        formatMismatch: (argName: unknown, intent: unknown, expected: unknown, detail: unknown) =>
            `Argument \`${argName}\` description has "${intent}" intent ` +
            `but does not follow the expected format. ` +
            `Expected: ${expected}` +
            (detail ? ` (${detail})` : ""),
    },
};

export class ArgumentDescriptionFormatRule extends Rule {
    private readonly parser = new MarkdownParser();
    private classifier: DescriptionIntentClassifier | null = null;

    constructor() {
        super(META, "code");
    }

    private getClassifier(): DescriptionIntentClassifier {
        if (!this.classifier) {
            const model = createQwenModel({ streaming: false });
            this.classifier = new DescriptionIntentClassifier(model);
        }
        return this.classifier;
    }

    public async test(
        code: string,
        _ast?: unknown,
        parentCtx?: Context
    ): Promise<RuleCheckResult[]> {
        const bulletLists =
            parentCtx?.get<MarkdownNode[]>(CTX_ARG_REF_BULLET_LISTS);
        if (!bulletLists || bulletLists.length === 0) return [];

        const failures: RuleCheckResult[] = [];
        const classifier = this.getClassifier();

        for (const listNode of bulletLists) {
            for (const item of listNode.children) {
                if (item.type !== "item") continue;

                const result = await this.checkItem(code, item, classifier);
                if (result) {
                    failures.push(result);
                }
            }
        }

        return failures;
    }

    private async checkItem(
        code: string,
        item: MarkdownNode,
        classifier: DescriptionIntentClassifier
    ): Promise<RuleCheckResult | null> {
        const logicalLines = this.parser.getLogicalLines(code, item);
        if (!logicalLines || logicalLines.lines.length <= 1) return null;

        const firstLine = logicalLines.lines[0];
        const argNameMatch = firstLine.match(/`([^`]+)`/);
        const argName = argNameMatch ? argNameMatch[1] : "unknown";

        const descLines = logicalLines.lines.slice(1);
        if (descLines.length === 0) return null;

        const descText = descLines.join("\n");
        if (!descText.trim()) return null;

        const intent = await classifier.classify(argName, descText);
        if (intent === "none") return null;

        const spec = getFormatSpec(intent);
        if (!spec) return null;

        const validation = spec.validate(descLines);
        if (validation.ok) return null;

        return this.fail(
            "formatMismatch",
            code,
            undefined,
            argName,
            intent,
            validation.expected,
            validation.detail
        );
    }
}
