import type { MarkdownNode } from "../../../../../../tools/ast-parser/markdown";
import { MarkdownParser } from "../../../../../../tools/ast-parser/markdown";
import { sectionCheck } from "../../../../../../tools/section-check";
import { Rule, RuleCheckResult, type RuleMeta } from "../../../../../types/rule/rule";
import type { Context } from "../../../../../context/context";
import { ATTR_BULLET_PATTERN } from "../../../tools/doc-semantic/builder";
import { toSectionRuleResults } from "../shared/section-check-result";

const ATTRIBUTE_SECTION_TITLES = ["Attributes Reference", "Attribute Reference"];

const META: RuleMeta = {
    name: "md-attribute-section-format",
    description: "Validate Attribute Reference section list structure and bullet style",
    messages: {
        missingList:
            "Attribute Reference section exists but does not contain a bullet list.",
        invalidItem: (line: unknown, reason: unknown) =>
            `Invalid attribute bullet format at line ${String(line)}: ${String(reason)}`,
        summary: (count: unknown) =>
            `${String(count)} attribute bullet format issue(s) found`,
    },
};

export class AttributeSectionFormatRule extends Rule {
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
        const sectionInfo = getSectionByTitles(this.parser, doc, ATTRIBUTE_SECTION_TITLES);
        if (!sectionInfo) {
            return [RuleCheckResult.pass("Attribute Reference section not found, skipped")];
        }

        const failures = await sectionCheck(sectionInfo.title, 2)
            .requireBulletList({
                includeNestedLists: true,
                message: this.msg("missingList"),
            })
            .eachBulletItem((line) => line.matches(ATTR_BULLET_PATTERN), {
                includeNestedLists: true,
            })
            .run(doc, code);

        if (failures.length === 1 && failures[0].message === this.msg("missingList")) {
            return [this.fail("missingList", "", undefined, RuleCheckResult.fromLine(1))];
        }

        return toSectionRuleResults(failures, {
            passMessage: "Attribute Reference section format is valid",
            summaryMessage: (count) => this.msg("summary", count),
        });
    }
}

function getSectionByTitles(
    parser: MarkdownParser,
    doc: MarkdownNode,
    titles: string[],
): { title: string; nodes: MarkdownNode[] } | null {
    for (const title of titles) {
        const section = parser.getSection(doc, 2, title);
        if (section) return { title, nodes: section };
    }
    return null;
}
