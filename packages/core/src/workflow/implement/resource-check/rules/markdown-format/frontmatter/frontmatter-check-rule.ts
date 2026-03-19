import type { MarkdownNode } from "../../../../../../tools/ast-parser/markdown";
import { MarkdownParser } from "../../../../../../tools/ast-parser/markdown";
import { Rule, RuleCheckResult, type RuleMeta } from "../../../../../types/rule/rule";
import type { Context } from "../../../../../context/context";

const META: RuleMeta = {
    name: "md-frontmatter-check",
    description:
        "Front matter block must exist at the start of the document",
    messages: {
        missing: "Missing front matter block at the start of the document",
    },
};

export class FrontmatterCheckRule extends Rule {
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
        const fm = this.parser.findFirst(doc, (n) => n.type === "frontmatter");

        if (fm) {
            return [
                RuleCheckResult.pass(
                    "Front matter block exists",
                    fm.sourceRange ?? undefined
                ),
            ];
        }

        return [this.fail("missing", "", undefined, RuleCheckResult.fromLine(1))];
    }
}
