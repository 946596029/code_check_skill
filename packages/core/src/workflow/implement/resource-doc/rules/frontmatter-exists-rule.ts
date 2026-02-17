import type { MarkdownNode } from "../../../../tools/ast-parser/markdown";
import { CodeRule } from "../../../types/rule/code-rule";
import { RuleCheckResult } from "../../../types/rule/rule";

/**
 * Rule 1: frontmatter-exists
 * Front matter block must exist at the start of the document.
 *
 * Detect phase: check whether children[0] is a "frontmatter" node.
 *               (The parser always inserts frontmatter as the first child.)
 * Check  phase: if the first child is not frontmatter, report an error.
 */
export class FrontmatterExistsRule extends CodeRule {
    constructor() {
        super(
            "frontmatter-exists",
            "Front matter block must exist at the start of the document",
            null,
            "Missing front matter block",
            []
        );
    }

    /**
     * Orchestrate detect → check flow.
     *
     * 1. Detect: the parser guarantees frontmatter is always children[0],
     *            so we check the first child directly (O(1)).
     * 2. Check:  if the first child is not a frontmatter node, call check().
     */
    public async test(code: string, ast?: unknown): Promise<RuleCheckResult[]> {
        if (!ast) {
            const result = await this.check(code);
            return result ? [result] : [];
        }

        const doc = ast as MarkdownNode;

        // Detect: frontmatter is always the first child of the document
        if (doc.children[0]?.type !== "frontmatter") {
            // Check: first child is not frontmatter → report error
            const result = await this.check(code);
            return result ? [result] : [];
        }

        return [];
    }

    protected async check(code: string): Promise<RuleCheckResult | null> {
        return new RuleCheckResult(false, this.errorMessage, code, code);
    }
}
