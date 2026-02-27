import type { MarkdownNode } from "../../../../../tools/ast-parser/markdown";
import { MarkdownParser } from "../../../../../tools/ast-parser/markdown";
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
import { createModel } from "../../../../../tools/llm";
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
    private readonly parser = new MarkdownParser();

    constructor() {
        super(META, "code");
    }

    private getDetector(): DescriptionIntentDetector {
        if (!this.detector) {
            const model = createModel();
            this.detector = new DescriptionIntentDetector(model);
        }
        return this.detector;
    }

    private getLinesForDetection(
        argName: string,
        lines: string[]
    ): string[] {
        return lines
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .filter((line) => !this.isBulletTemplateLine(line, argName));
    }

    private isBulletTemplateLine(line: string, argName: string): boolean {
        const escapedName = argName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(
            `^\\*?\\s*\`${escapedName}\`\\s*-\\s*\\([^)]*\\)\\s*Specifies\\b`,
            "i"
        );
        return pattern.test(line);
    }

    private hasExplicitDefaultValueMarker(lines: string[]): boolean {
        return lines.some((line) =>
            /\bdefault\s+value\b|\bdefaults?\s+to\b/i.test(line)
        );
    }

    public async test(
        code: string,
        ast?: unknown,
        _parentCtx?: unknown
    ): Promise<RuleCheckResult[]> {
        if (!ast) {
            return [RuleCheckResult.pass("AST is unavailable, rule skipped")];
        }

        const doc = ast as MarkdownNode;
        const detector = this.getDetector();
        const sectionText = this.parser.getSectionText(code, 2, "Argument Reference");

        const failures = await sectionCheck("Argument Reference", 2)
            .structure(SECTION_STRUCTURE)
            .introLine(EXPECTED_INTRO)
            .eachBulletItem((firstLine) => firstLine.matches(ARG_BULLET_PATTERN))
            .eachBulletItemAsync(async (item) => {
                const linesForDetection = this.getLinesForDetection(
                    item.argName,
                    item.descriptionLines
                );
                if (linesForDetection.length === 0) return null;

                const textForDetection = linesForDetection.join("\n");
                const detection = await detector.detect(
                    item.argName,
                    textForDetection
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
                    if (
                        intentResult.name === "default-value" &&
                        !this.hasExplicitDefaultValueMarker(linesForDetection)
                    ) {
                        continue;
                    }

                    const spec = getFormatSpec(intentResult.name);
                    if (!spec) continue;

                    const validation = spec.validate(linesForDetection);
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

        if (failures.length === 0) {
            return [
                RuleCheckResult.pass(
                    "Argument Reference section structure is valid",
                    RuleCheckResult.fromLine(sectionText?.startLine)
                ),
            ];
        }

        return failures.map(
            (failure) => new RuleCheckResult(
                false,
                failure.message,
                code,
                code,
                [],
                RuleCheckResult.fromLine(failure.line)
            )
        );
    }
}
