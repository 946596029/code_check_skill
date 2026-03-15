import type { MarkdownNode } from "../../../../../tools/ast-parser/markdown";
import { MarkdownParser } from "../../../../../tools/ast-parser/markdown";
import { Rule, RuleCheckResult, type RuleMeta } from "../../../../types/rule/rule";
import type { Context } from "../../../../context/context";

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
        _code: string,
        ast?: unknown,
        _parentCtx?: Context
    ): Promise<RuleCheckResult[]> {
        if (!ast) {
            return [this.fail("missing", "")];
        }

        const doc = ast as MarkdownNode;
        const section = this.parser.getSection(doc, 2, "Example Usage");

        if (section && section.length > 0) {
            const firstNode = section[0];
            return [
                RuleCheckResult.pass(
                    "Example Usage section exists",
                    firstNode.sourceRange ?? undefined
                ),
            ];
        }

        return [this.fail("missing", "", undefined, RuleCheckResult.fromLine(1))];
    }
}
