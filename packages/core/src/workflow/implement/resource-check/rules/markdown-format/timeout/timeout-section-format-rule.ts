import type { MarkdownNode } from "../../../../../../tools/ast-parser/markdown";
import { MarkdownParser } from "../../../../../../tools/ast-parser/markdown";
import { LinePattern, backticked, literal, rest, spaces } from "../../../../../../tools/line-pattern";
import { sectionCheck } from "../../../../../../tools/section-check";
import { Rule, RuleCheckResult, type RuleMeta } from "../../../../../types/rule/rule";
import type { Context } from "../../../../../context/context";
import { toSectionRuleResults } from "../shared/section-check-result";

const TIMEOUT_SECTION_TITLES = ["Timeouts", "Timeout"];
const TIMEOUT_SECTION_INTRO =
    "This resource provides the following timeouts configuration options:";
const TIMEOUT_ACTION_PATTERN = /^`(?:create|update|delete)`\s-\s/i;

const TIMEOUT_BULLET_PATTERN = new LinePattern([
    literal("* "),
    backticked("action"),
    spaces(1),
    literal("-"),
    spaces(1),
    rest("description"),
]);

const META: RuleMeta = {
    name: "md-timeout-section-format",
    description: "Validate Timeouts section intro line and bullet item format",
    messages: {
        missingList: "Timeouts section exists but does not contain a bullet list.",
        summary: (count: unknown) =>
            `${String(count)} timeout section format issue(s) found`,
    },
};

export class TimeoutSectionFormatRule extends Rule {
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
        const sectionInfo = getSectionByTitles(this.parser, doc, TIMEOUT_SECTION_TITLES);
        if (!sectionInfo) {
            return [RuleCheckResult.pass("Timeouts section not found, skipped")];
        }

        const failures = await sectionCheck(sectionInfo.title, 2)
            .introLine(TIMEOUT_SECTION_INTRO)
            .requireBulletList({
                includeNestedLists: true,
                message: this.msg("missingList"),
            })
            .eachBulletItem(
                (line) =>
                    line.matches(TIMEOUT_BULLET_PATTERN) &&
                    TIMEOUT_ACTION_PATTERN.test(line.text),
                { includeNestedLists: false },
            )
            .run(doc, code);

        if (failures.length === 1 && failures[0].message === this.msg("missingList")) {
            return [this.fail("missingList", "", undefined, RuleCheckResult.fromLine(1))];
        }

        return toSectionRuleResults(failures, {
            passMessage: "Timeouts section format is valid",
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
