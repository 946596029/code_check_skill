import type { MarkdownNode, MarkdownNodeType } from "../../../../../../tools/ast-parser/markdown";
import { Rule, RuleCheckResult, type RuleMeta } from "../../../../../types/rule/rule";
import type { Context } from "../../../../../context/context";

const META: RuleMeta = {
    name: "md-blank-line-between-blocks",
    description: "Top-level markdown blocks should be separated by a blank line",
    messages: {
        missing: (prevType: unknown, currType: unknown, line: unknown) =>
            `Missing blank line between ${String(prevType)} and ${String(currType)} blocks ` +
            `before line ${String(line)}.`,
        summary: (count: unknown) =>
            `${String(count)} block boundary issue(s) found`,
    },
};

const BLOCK_TYPES_REQUIRING_SEPARATOR = new Set<MarkdownNodeType>([
    "heading",
    "paragraph",
    "list",
    "code_block",
    "block_quote",
    "html_block",
]);

export class BlankLineBetweenBlocksRule extends Rule {
    constructor() {
        super(META, "markdown");
    }

    public async test(
        code: string,
        ast?: unknown,
        _parentCtx?: Context
    ): Promise<RuleCheckResult[]> {
        if (!ast) {
            return [RuleCheckResult.pass("AST unavailable, rule skipped")];
        }

        const doc = ast as MarkdownNode;
        const blocks = doc.children.filter((n) => n.type !== "frontmatter");
        const lines = code.split(/\r?\n/);
        const violations: RuleCheckResult[] = [];

        for (let i = 1; i < blocks.length; i++) {
            const prev = blocks[i - 1];
            const curr = blocks[i];
            if (!this.shouldCheckBoundary(prev, curr)) continue;

            const prevEnd = prev.sourceRange?.end.line;
            const currStart = curr.sourceRange?.start.line;
            if (!prevEnd || !currStart || currStart <= prevEnd) continue;

            if (!this.hasBlankLineBetween(lines, prevEnd, currStart)) {
                const line = currStart;
                violations.push(
                    this.fail(
                        "missing",
                        lines[line - 1] ?? "",
                        lines[line - 1] ?? "",
                        RuleCheckResult.fromLine(line),
                        prev.type,
                        curr.type,
                        line
                    )
                );
            }
        }

        if (violations.length === 0) {
            return [RuleCheckResult.pass("All top-level block boundaries have blank lines")];
        }

        return [
            new RuleCheckResult(
                false,
                this.msg("summary", violations.length),
                "",
                "",
                violations
            ),
        ];
    }

    private shouldCheckBoundary(prev: MarkdownNode, curr: MarkdownNode): boolean {
        if (!BLOCK_TYPES_REQUIRING_SEPARATOR.has(prev.type)) return false;
        if (!BLOCK_TYPES_REQUIRING_SEPARATOR.has(curr.type)) return false;

        // Allow adjacent headings for intentionally empty sections.
        if (prev.type === "heading" && curr.type === "heading") {
            return false;
        }

        return true;
    }

    private hasBlankLineBetween(lines: string[], prevEndLine: number, currStartLine: number): boolean {
        const start = prevEndLine + 1;
        const end = currStartLine - 1;
        if (start > end) return false;

        for (let line = start; line <= end; line++) {
            if ((lines[line - 1] ?? "").trim() === "") {
                return true;
            }
        }
        return false;
    }
}
