import type { MarkdownNode } from "../../../../../../tools/ast-parser/markdown";
import { MarkdownParser } from "../../../../../../tools/ast-parser/markdown";
import { bodyCheck } from "../../../../../../tools/section-check";
import { Rule, RuleCheckResult, type RuleMeta } from "../../../../../types/rule/rule";
import type { Context } from "../../../../../context/context";

const META: RuleMeta = {
    name: "md-example-section-exists",
    description: "Document must contain an 'Example Usage' section",
    messages: {
        missing:
            "Document must contain an 'Example Usage' section (## Example Usage)",
    },
};

export class ExampleSectionExistsRule extends Rule {
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
                const hasExampleSection = nodes.some(
                    (node) =>
                        node.type === "heading" &&
                        (node.level ?? 0) === 2 &&
                        this.parser.getTextContent(node).trim() === "Example Usage"
                );
                if (hasExampleSection) return [];
                return [{ message: this.msg("missing"), line: startLine }];
            })
            .run(doc, code);

        if (failures.length === 0) {
            return [RuleCheckResult.pass("Example Usage section exists")];
        }

        const line = failures[0].line ?? 1;
        return [this.fail("missing", "", undefined, RuleCheckResult.fromLine(line))];
    }
}
