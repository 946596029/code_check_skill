import type { MarkdownNode } from "../../../../../tools/ast-parser/markdown";
import { MarkdownParser } from "../../../../../tools/ast-parser/markdown";
import { Rule, RuleCheckResult, type RuleMeta } from "../../../../types/rule/rule";
import type { Context } from "../../../../context/context";

const META: RuleMeta = {
    name: "md-h1-exists",
    description: "Document must contain at least one level-1 heading",
    messages: {
        missing: "Document must contain a level-1 heading (# Title)",
    },
};

export class H1ExistsRule extends Rule {
    private readonly parser = new MarkdownParser();

    constructor() {
        super(META, "markdown");
    }

    public async test(
        _code: string,
        ast?: unknown,
        _parentCtx?: Context
    ): Promise<RuleCheckResult[]> {
        if (!ast) {
            return [this.fail("missing", "")];
        }

        const doc = ast as MarkdownNode;
        const headings = this.parser.getHeadings(doc);
        const h1 = headings.find((h) => h.level === 1);

        if (h1) {
            return [
                RuleCheckResult.pass(
                    "Level-1 heading exists",
                    h1.node.sourceRange ?? undefined
                ),
            ];
        }

        return [this.fail("missing", "", undefined, RuleCheckResult.fromLine(1))];
    }
}
