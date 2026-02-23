import type { MarkdownNode } from "../../../../../tools/ast-parser/markdown";
import { MarkdownParser } from "../../../../../tools/ast-parser/markdown";
import {
    NodePattern,
    heading,
    nodeType,
    optionalNode,
    tagged,
} from "../../../../../tools/node-pattern";
import { Rule, RuleCheckResult, RuleMeta } from "../../../../types/rule/rule";
import { Context } from "../../../../context/context";
import {
    CTX_EXPECTED_DESCRIPTION,
    CTX_RESOURCE_NAME,
    CTX_H1_TITLE,
    CTX_H1_DESC_TEXT,
    CTX_H1_SECTION_LINES,
    CTX_H1_SECTION_START_LINE,
} from "../../context-keys";
import { H1TitleMatchesResourceRule } from "./h1-title-matches-resource-rule";
import { H1DescriptionMatchesRule } from "./h1-description-matches-rule";
import { SpecialNotesFormatRule } from "./special-notes-format-rule";

const H1_SECTION_OPENING = new NodePattern([
    tagged("h1", heading(1)),
    tagged("desc", optionalNode(nodeType("paragraph"))),
]);

const META: RuleMeta = {
    name: "h1-structure",
    description:
        "First-level heading section must match frontmatter " +
        "(title, description) and use proper -> format for special notes",
    messages: {
        badStructure: (detail: unknown) =>
            `H1 section structure mismatch: ${detail}. ` +
            `Expected: ${H1_SECTION_OPENING.toDisplayFormat()}`,
    },
};

export class H1StructureRule extends Rule {
    private readonly parser = new MarkdownParser();

    constructor() {
        super(META, "code");
        this.addChild(new H1TitleMatchesResourceRule());
        this.addChild(new H1DescriptionMatchesRule());
        this.addChild(new SpecialNotesFormatRule());
    }

    public async test(
        code: string,
        ast?: unknown,
        parentCtx?: Context
    ): Promise<RuleCheckResult[]> {
        if (!ast || !parentCtx) return [];

        const resourceName = parentCtx.get<string>(CTX_RESOURCE_NAME);
        if (!resourceName) return [];

        const doc = ast as MarkdownNode;
        const body = this.parser.getBodyChildren(doc);

        const result = H1_SECTION_OPENING.match(body);
        if (!result.ok) {
            const detail = H1_SECTION_OPENING.describeFailure(body);
            return [this.fail("badStructure", code, undefined, detail)];
        }

        const h1Node = result.value.tagged["h1"][0];
        const descNodes = result.value.tagged["desc"] ?? [];

        const ctx = parentCtx.createChild();
        ctx.set(CTX_RESOURCE_NAME, resourceName);
        ctx.set(
            CTX_EXPECTED_DESCRIPTION,
            parentCtx.get<string>(CTX_EXPECTED_DESCRIPTION) ?? ""
        );
        ctx.set(CTX_H1_TITLE, this.parser.getTextContent(h1Node).trim());

        if (descNodes.length > 0) {
            ctx.set(
                CTX_H1_DESC_TEXT,
                this.parser.getTextContent(descNodes[0])
            );
        }

        const section = this.extractH1SectionText(code, body);
        if (section) {
            ctx.set(CTX_H1_SECTION_LINES, section.lines);
            ctx.set(CTX_H1_SECTION_START_LINE, section.startLine);
        }

        return [RuleCheckResult.aggregate(
            await this.executeChildren(code, ast, ctx)
        )];
    }

    private extractH1SectionText(
        code: string,
        body: MarkdownNode[]
    ): { lines: string[]; startLine: number } | null {
        const h1Node = body[0];
        if (!h1Node?.sourceRange) return null;

        const allLines = code.split(/\r?\n/);
        const contentStart = h1Node.sourceRange.start.line;

        let endLine = allLines.length;
        for (let i = 1; i < body.length; i++) {
            if (body[i].type === "heading" && body[i].sourceRange) {
                endLine = body[i].sourceRange!.start.line - 1;
                break;
            }
        }

        return {
            lines: allLines.slice(contentStart, endLine),
            startLine: contentStart + 1,
        };
    }
}
