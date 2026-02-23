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
import { Rule, RuleCheckResult, RuleMeta } from "../../../../types/rule/rule";
import { Context } from "../../../../context/context";
import {
    CTX_ARG_REF_LINES,
    CTX_ARG_REF_START_LINE,
    CTX_ARG_REF_BULLET_LISTS,
} from "../../context-keys";
import { ArgumentIntroMatchesRule } from "./argument-intro-matches-rule";
import { ArgumentBulletFormatRule } from "./argument-item/argument-bullet-format-rule";
import { ArgumentDescriptionFormatRule } from "./argument-item/description/argument-description-format-rule";

const SECTION_STRUCTURE = new NodePattern([
    nodeType("paragraph"),
    oneOrMoreGroup([
        tagged("bullets", list("bullet")),
        optionalNode(nodeType("paragraph")),
    ]),
]);

const META: RuleMeta = {
    name: "argument-reference-structure",
    description:
        "Argument Reference section must consist of one or more " +
        "bullet lists, each optionally followed by a paragraph",
    messages: {
        badStructure: (detail: unknown) =>
            `Argument Reference section structure mismatch: ${detail}. ` +
            `Expected: ${SECTION_STRUCTURE.toDisplayFormat()}`,
    },
};

export class ArgumentReferenceStructureRule extends Rule {
    private readonly parser = new MarkdownParser();

    constructor() {
        super(META, "code");
        this.addChild(new ArgumentIntroMatchesRule());
        this.addChild(new ArgumentBulletFormatRule());
        this.addChild(new ArgumentDescriptionFormatRule());
    }

    public async test(
        code: string,
        ast?: unknown,
        parentCtx?: Context
    ): Promise<RuleCheckResult[]> {
        if (!ast) return [];

        const doc = ast as MarkdownNode;
        const nodes = this.parser.getSection(doc, 2, "Argument Reference");
        if (!nodes) return [];

        const result = SECTION_STRUCTURE.match(nodes);
        if (!result.ok) {
            const detail = SECTION_STRUCTURE.describeFailure(nodes);
            return [this.fail("badStructure", code, undefined, detail)];
        }

        const bulletLists = result.value.tagged["bullets"] ?? [];

        const section = this.parser.getSectionText(code, 2, "Argument Reference");
        if (!section) return [];

        const ctx = parentCtx ? parentCtx.createChild() : new Context();
        ctx.set(CTX_ARG_REF_LINES, section.lines);
        ctx.set(CTX_ARG_REF_START_LINE, section.startLine);
        ctx.set(CTX_ARG_REF_BULLET_LISTS, bulletLists);

        return [RuleCheckResult.aggregate(
            await this.executeChildren(code, ast, ctx)
        )];
    }
}
