import type { MarkdownNode } from "../../../../../tools/ast-parser/markdown";
import {
    NodePattern,
    nodeType,
    list,
    tagged,
    optionalNode,
    oneOrMoreGroup,
} from "../../../../../tools/node-pattern";
import {
    sectionCheck,
} from "../../../../../tools/section-check";
import {
    LinePattern,
    literal,
    backticked,
    spaces,
    rest,
} from "../../../../../tools/line-pattern";
import { Rule, RuleCheckResult, RuleMeta } from "../../../../types/rule/rule";

const SECTION_STRUCTURE = new NodePattern([
    nodeType("paragraph"),
    oneOrMoreGroup([
        tagged("bullets", list("bullet")),
        optionalNode(nodeType("paragraph")),
    ]),
]);

const ATTR_BULLET_PATTERN = new LinePattern([
    literal("* "),
    backticked("attr_name"),
    spaces(1),
    literal("-"),
    spaces(1),
    rest("description"),
]);

const EXPECTED_INTRO =
    "In addition to all arguments above, the following attributes are exported:";

const META: RuleMeta = {
    name: "attributes-reference-structure",
    description:
        "Attributes Reference section must consist of one or more " +
        "bullet lists, each optionally followed by a paragraph",
    messages: {},
};

export class AttributesReferenceStructureRule extends Rule {
    constructor() {
        super(META, "code");
    }

    public async test(
        code: string,
        ast?: unknown,
        _parentCtx?: unknown
    ): Promise<RuleCheckResult[]> {
        if (!ast) return [];

        const doc = ast as MarkdownNode;
        const failures = await sectionCheck("Attributes Reference", 2)
            .structure(SECTION_STRUCTURE)
            .introLine(EXPECTED_INTRO)
            .eachBulletItem((firstLine) => firstLine.matches(ATTR_BULLET_PATTERN))
            .run(doc, code);

        return failures.map(
            (failure) => new RuleCheckResult(false, failure.message, code, code)
        );
    }
}
