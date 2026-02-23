import type { MarkdownNode } from "../../../../tools/ast-parser/markdown";
import { MarkdownParser } from "../../../../tools/ast-parser/markdown";
import { Rule, RuleCheckResult, RuleMeta } from "../../../types/rule/rule";
import { Context } from "../../../context/context";
import {
    CTX_EXPECTED_DESCRIPTION,
    CTX_FRONTMATTER,
    CTX_RESOURCE_NAME,
} from "../context-keys";

const META: RuleMeta = {
    name: "frontmatter-exists",
    description:
        "Front matter block must exist at the start of the document",
    messages: {
        missing: "Missing front matter block",
    },
};

export class FrontmatterExistsRule extends Rule {
    private readonly parser = new MarkdownParser();

    constructor() {
        super(META, "code");
    }

    public async test(
        code: string,
        ast?: unknown,
        parentCtx?: Context
    ): Promise<RuleCheckResult[]> {
        if (!ast) {
            return [this.fail("missing", code)];
        }

        const doc = ast as MarkdownNode;

        if (this.parser.hasChild(
            doc, (n) => n.type === "frontmatter", "first"
        )) {
            this.storeFrontmatterInContext(doc, parentCtx);
            return [];
        }

        const result = this.fail("missing", code);

        if (this.children.length > 0) {
            const ctx = parentCtx
                ? parentCtx.createChild()
                : new Context();
            result.children = await this.executeChildren(code, ast, ctx);
        }

        return [result];
    }

    private storeFrontmatterInContext(
        doc: MarkdownNode,
        ctx?: Context
    ): void {
        if (!ctx) return;

        const frontmatter = this.parser.getFrontmatter(doc);
        if (!frontmatter) return;

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
