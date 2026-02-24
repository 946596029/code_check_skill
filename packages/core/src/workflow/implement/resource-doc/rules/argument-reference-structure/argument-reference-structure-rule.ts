import type { MarkdownNode } from "../../../../../tools/ast-parser/markdown";
import {
    NodePattern,
    nodeType,
    list,
    tagged,
    optionalNode,
    oneOrMoreGroup,
} from "../../../../../tools/node-pattern";
import { sectionCheck } from "../../../../../tools/section-check";
import {
    LinePattern,
    literal,
    backticked,
    spaces,
    csvParenthesized,
    keyword,
    rest,
} from "../../../../../tools/line-pattern";
import { Rule, RuleCheckResult, RuleMeta } from "../../../../types/rule/rule";
import { createQwenModel } from "../../../../../llm/model";
import {
    DescriptionIntentDetector,
    getFormatSpec,
} from "../../../../../tools/llm/description-intent";

const SECTION_STRUCTURE = new NodePattern([
    nodeType("paragraph"),
    oneOrMoreGroup([
        tagged("bullets", list("bullet")),
        optionalNode(nodeType("paragraph")),
    ]),
]);

const EXPECTED_INTRO = "The following arguments are supported:";

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
    name: "argument-reference-structure",
    description:
        "Argument Reference section must consist of one or more " +
        "bullet lists, each optionally followed by a paragraph",
    messages: {},
};

export class ArgumentReferenceStructureRule extends Rule {
    private detector: DescriptionIntentDetector | null = null;

    constructor() {
        super(META, "code");
    }

    private getDetector(): DescriptionIntentDetector {
        if (!this.detector) {
            const model = createQwenModel({ streaming: false });
            this.detector = new DescriptionIntentDetector(model);
        }
        return this.detector;
    }

    public async test(
        code: string,
        ast?: unknown,
        _parentCtx?: unknown
    ): Promise<RuleCheckResult[]> {
        if (!ast) return [];

        const doc = ast as MarkdownNode;
        const detector = this.getDetector();

        const failures = await sectionCheck("Argument Reference", 2)
            .structure(SECTION_STRUCTURE)
            .introLine(EXPECTED_INTRO)
            .eachBulletItem((firstLine) => firstLine.matches(ARG_BULLET_PATTERN))
            .eachBulletItemAsync(async (item) => {
                if (!item.descriptionText.trim()) return null;

                const detection = await detector.detect(
                    item.argName,
                    item.descriptionText
                );

                if (detection.status === "none") return null;
                if (detection.status === "suspected-standard-intent") {
                    return {
                        message:
                            `Argument \`${item.argName}\` description appears to use a ` +
                            "standard constraint intent, but the intent cannot be classified. " +
                            "Please rewrite it using a standard sentence template.",
                        line: item.startLine,
                    };
                }

                for (const intentResult of detection.intents) {
                    const spec = getFormatSpec(intentResult.name);
                    if (!spec) continue;

                    const validation = spec.validate(item.descriptionLines);
                    if (validation.ok) continue;

                    return {
                        message:
                            `Argument \`${item.argName}\` description has "${intentResult.name}" ` +
                            "intent but does not follow the expected format. " +
                            `Expected: ${validation.expected}` +
                            (validation.detail ? ` (${validation.detail})` : ""),
                        line: item.startLine,
                    };
                }

                return null;
            })
            .run(doc, code);

        return failures.map(
            (failure) => new RuleCheckResult(false, failure.message, code, code)
        );
    }
}
