import { RuleCheckResult } from "../../..";
import { Rule } from "../../types/rule/rule";
import { Context } from "../../context/context";
import { MarkdownParser } from "../../../tools/ast-parser/markdown";
import type { MarkdownNode } from "../../../tools/ast-parser/markdown";
import { Workflow, type WorkflowStage } from "../../workflow";
import { RESOURCE_DOC_RULES } from "./rules";
import {
    CTX_EXPECTED_DESCRIPTION,
    CTX_FRONTMATTER,
    CTX_MARKDOWN_AST,
    CTX_RESOURCE_NAME,
} from "./context-keys";

export class ResourceDocWorkflow extends Workflow {

    public readonly id = "resource-doc";
    public readonly description = "Validates Terraform resource documentation (Markdown)";

    private readonly parser = new MarkdownParser();

    constructor() {
        super();
        this.setRules(RESOURCE_DOC_RULES);
    }

    protected defineStages(): WorkflowStage[] {
        return [
            {
                id: "parse-markdown",
                description: "Normalize input and parse markdown AST",
                execute: async (runtime) => {
                    runtime.updateCode(runtime.code.trim());
                    const ast = this.parser.parse(runtime.code);
                    runtime.setArtifact(CTX_MARKDOWN_AST, ast);
                },
            },
            {
                id: "seed-artifacts",
                description: "Derive frontmatter artifacts into context",
                execute: async (runtime) => {
                    const ast = runtime.getArtifact<MarkdownNode>(CTX_MARKDOWN_AST);
                    if (!ast) {
                        return;
                    }
                    this.seedFrontmatterArtifacts(ast, runtime.context);
                },
            },
            {
                id: "run-rules",
                description: "Execute resource doc rules with shared context",
                execute: async (runtime) => {
                    const sharedCtx = runtime.createChildContext();
                    await runtime.runRules({
                        baseContext: sharedCtx,
                        strategy: "shared",
                    });
                },
            },
        ];
    }

    protected override async executeRule(
        rule: Rule,
        ctx?: Context
    ): Promise<RuleCheckResult[]> {
        const ast = this.context.get<MarkdownNode>(CTX_MARKDOWN_AST);
        return rule.test(this.code, ast, ctx);
    }

    private seedFrontmatterArtifacts(ast: MarkdownNode, ctx: Context): void {
        const frontmatter = this.parser.getFrontmatter(ast);
        if (!frontmatter) {
            return;
        }
        ctx.set(CTX_FRONTMATTER, frontmatter);

        const resourceName = this.extractResourceName(frontmatter);
        if (resourceName) {
            ctx.set(CTX_RESOURCE_NAME, resourceName);
        }

        const desc = this.normalizeDescription(frontmatter.description);
        ctx.set(CTX_EXPECTED_DESCRIPTION, desc ?? "");
    }

    private extractResourceName(fm: Record<string, unknown>): string | null {
        const pageTitle = fm.page_title;
        if (typeof pageTitle !== "string") return null;
        const match = pageTitle.match(/:\s*(.+)$/);
        return match ? match[1].trim() : pageTitle.trim();
    }

    private normalizeDescription(desc: unknown): string | null {
        if (desc == null) return null;
        const s = typeof desc === "string" ? desc : String(desc);
        return s.replace(/\r\n/g, "\n").trim();
    }
}
