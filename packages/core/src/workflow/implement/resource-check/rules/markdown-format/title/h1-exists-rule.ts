import type { MarkdownNode } from "../../../../../../tools/ast-parser/markdown";
import { MarkdownParser } from "../../../../../../tools/ast-parser/markdown";
import { bodyCheck } from "../../../../../../tools/section-check";
import { Rule, RuleCheckResult, type RuleMeta } from "../../../../../types/rule/rule";
import type { Context } from "../../../../../context/context";

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
        code: string,
        ast?: unknown,
        _parentCtx?: Context
    ): Promise<RuleCheckResult[]> {
        if (!ast) {
            return [this.fail("missing", "")];
        }

        const doc = ast as MarkdownNode;
        const failures = await bodyCheck()
            .validate(({ nodes, startLine }) => {
                const hasH1 = nodes.some(
                    (node) => node.type === "heading" && (node.level ?? 0) === 1
                );
                if (hasH1) return [];
                return [{ message: this.msg("missing"), line: startLine }];
            })
            .run(doc, code);

        if (failures.length === 0) {
            const headings = this.parser.getHeadings(doc);
            const h1 = headings.find((heading) => heading.level === 1);
            return [
                RuleCheckResult.pass(
                    "Level-1 heading exists",
                    h1?.node.sourceRange ?? undefined
                ),
            ];
        }

        const line = failures[0].line ?? 1;
        return [this.fail("missing", "", undefined, RuleCheckResult.fromLine(line))];
    }
}
