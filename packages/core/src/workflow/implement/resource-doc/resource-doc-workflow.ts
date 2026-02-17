import { RuleCheckResult } from "../../..";
import { MarkdownParser } from "../../../tools/ast-parser/markdown";
import type { MarkdownNode } from "../../../tools/ast-parser/markdown";
import { Workflow } from "../../workflow";
import { RESOURCE_DOC_RULES } from "./rules";

export class ResourceDocWorkflow extends Workflow {

    protected ast: MarkdownNode | null = null;

    constructor() {
        super();
        this.setRules(RESOURCE_DOC_RULES);
    }

    public preprocess(): void {
        this.code = this.code.trim();
        const parser = new MarkdownParser();
        this.ast = parser.parse(this.code);
    }

    public async process(): Promise<RuleCheckResult[]> {
        const results: RuleCheckResult[] = [];
        for (const rule of this.rules) {
            const ruleResults = await rule.test(this.code, this.ast);
            if (ruleResults.length > 0) {
                results.push(...ruleResults);
            }
        }
        return results;
    }

    public postprocess(): void {
        // Reserved for future post-processing of results
    }
}