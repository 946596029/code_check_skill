import { RuleCheckResult } from "../../..";
import { Rule } from "../../types/rule/rule";
import { Context } from "../../context/context";
import { MarkdownParser } from "../../../tools/ast-parser/markdown";
import type { MarkdownNode } from "../../../tools/ast-parser/markdown";
import { Workflow, type RuleResult, type OnRuleComplete } from "../../workflow";
import { RESOURCE_DOC_RULES } from "./rules";

export class ResourceDocWorkflow extends Workflow {

    public readonly id = "resource-doc";
    public readonly description = "Validates Terraform resource documentation (Markdown)";

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

    /**
     * Override process to use a shared context for all rules.
     * This allows FrontmatterExistsRule to store parsed frontmatter for
     * downstream rules (e.g. H1StructureRule) to consume.
     */
    public override async process(
        onRuleComplete?: OnRuleComplete
    ): Promise<RuleResult[]> {
        const sharedCtx = this.context.createChild();
        const allRuleResults: RuleResult[] = [];

        for (const rule of this.rules) {
            let results: RuleCheckResult[];
            try {
                results = await this.executeRule(rule, sharedCtx);
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : String(err);
                results = [
                    new RuleCheckResult(false, `Rule execution error: ${message}`, "", ""),
                ];
            }
            const ruleResult: RuleResult = {
                ruleName: rule.name,
                ruleDescription: rule.description,
                ruleType: rule.type,
                results,
            };
            allRuleResults.push(ruleResult);
            onRuleComplete?.(ruleResult);
        }

        return allRuleResults;
    }

    protected override async executeRule(
        rule: Rule,
        ctx?: Context
    ): Promise<RuleCheckResult[]> {
        return rule.test(this.code, this.ast, ctx);
    }

    public postprocess(): void {
        // Reserved for future post-processing of results
    }
}