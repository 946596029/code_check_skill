import { Rule, RuleCheckResult, RuleMeta } from "../../../../../types/rule/rule";
import { Context } from "../../../../../context/context";
import { CTX_ARG_REF_BULLET_LISTS } from "../../../context-keys";
import type { MarkdownNode } from "../../../../../../tools/ast-parser/markdown";
import { MarkdownParser } from "../../../../../../tools/ast-parser/markdown";
import {
    LinePattern,
    literal,
    backticked,
    spaces,
    csvParenthesized,
    keyword,
    rest,
} from "../../../../../../tools/line-pattern";

const MODIFIERS = ["Required", "Optional"];

const TYPES = ["String", "Int", "Bool", "List", "Map", "Float", "Set"];

const TAGS = [
    "ForceNew",
    "NonUpdatable",
    "Deprecated",
    "Computed",
    "Sensitive",
];

const ARG_BULLET_PATTERN = new LinePattern([
    literal("* "),
    backticked("arg_name"),
    spaces(1),
    literal("-"),
    spaces(1),
    csvParenthesized([
        { name: "Modifier", values: MODIFIERS },
        { name: "Type", values: TYPES },
        { name: "Tag", values: TAGS, zeroOrMore: true },
    ]),
    spaces(1),
    keyword("Specifies"),
    spaces(1),
    rest("description"),
]);

const META: RuleMeta = {
    name: "argument-bullet-format",
    description:
        `Each argument bullet must follow: ${ARG_BULLET_PATTERN.toDisplayFormat()}`,
    messages: {
        invalidFormat: (line: unknown) =>
            `Invalid Argument Reference bullet format at line ${line}. ` +
            `Expected: ${ARG_BULLET_PATTERN.toDisplayFormat()}`,
    },
};

export class ArgumentBulletFormatRule extends Rule {
    private readonly parser = new MarkdownParser();

    constructor() {
        super(META, "code");
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

        for (const listNode of bulletLists) {
            for (const item of listNode.children) {
                if (item.type !== "item") continue;

                const nodeText = this.parser.getNodeText(code, item);
                if (!nodeText || nodeText.lines.length === 0) continue;

                const line = nodeText.lines[0].trim();
                if (!line) continue;

                const bulletLine = line.startsWith("* ") ? line : `* ${line}`;
                if (!ARG_BULLET_PATTERN.test(bulletLine)) {
                    failures.push(
                        this.fail(
                            "invalidFormat",
                            code,
                            undefined,
                            nodeText.startLine
                        )
                    );
                }
            }
        }

        return failures;
    }
}
