import type { MarkdownNode } from "../../../../../../tools/ast-parser/markdown";
import { MarkdownParser } from "../../../../../../tools/ast-parser/markdown";
import { sectionCheck } from "../../../../../../tools/section-check";
import { Rule, RuleCheckResult, type RuleMeta } from "../../../../../types/rule/rule";
import type { Context } from "../../../../../context/context";
import { ARG_BULLET_PATTERN } from "../../../tools/doc-semantic/builder";
import { toSectionRuleResults } from "../shared/section-check-result";

const META: RuleMeta = {
    name: "md-argument-section-format",
    description: "Validate Argument Reference section list structure and bullet style",
    messages: {
        missingList:
            "Argument Reference section exists but does not contain a bullet list.",
        invalidItem: (line: unknown, reason: unknown) =>
            `Invalid argument bullet format at line ${String(line)}: ${String(reason)}`,
        summary: (count: unknown) =>
            `${String(count)} argument bullet format issue(s) found`,
    },
};

export class ArgumentSectionFormatRule extends Rule {
    private readonly parser = new MarkdownParser();

    constructor() {
        super(META, "markdown");
    }

    public async test(
        code: string,
        ast?: unknown,
        _parentCtx?: Context,
    ): Promise<RuleCheckResult[]> {
        if (!ast) {
            return [RuleCheckResult.pass("AST unavailable, rule skipped")];
        }

        const doc = ast as MarkdownNode;
        const section = this.parser.getSection(doc, 2, "Argument Reference");
        if (!section) {
            return [RuleCheckResult.pass("Argument Reference section not found, skipped")];
        }

        const failures = await sectionCheck("Argument Reference", 2)
            .requireBulletList({
                includeNestedLists: true,
                message: this.msg("missingList"),
            })
            .eachBulletItem((line) => line.matches(ARG_BULLET_PATTERN), {
                includeNestedLists: true,
            })
            .run(doc, code);

        if (failures.length === 1 && failures[0].message === this.msg("missingList")) {
            return [this.fail("missingList", "", undefined, RuleCheckResult.fromLine(1))];
        }

        return toSectionRuleResults(failures, {
            passMessage: "Argument Reference section format is valid",
            summaryMessage: (count) => this.msg("summary", count),
        });
    }
}
