import type { MarkdownNode } from "../../../../../../tools/ast-parser/markdown";
import { MarkdownParser } from "../../../../../../tools/ast-parser/markdown";
import { Rule, RuleCheckResult, type RuleMeta } from "../../../../../types/rule/rule";
import type { Context } from "../../../../../context/context";

const ARGUMENT_SECTION_TITLES = ["Arguments Reference", "Argument Reference"];

const META: RuleMeta = {
    name: "md-argument-blank-line-between-items",
    description: "Argument Reference bullet items must be separated by blank lines",
    messages: {
        missing: (line: unknown) =>
            `Missing blank line between argument items before line ${String(line)}.`,
        summary: (count: unknown) =>
            `${String(count)} argument item separator issue(s) found`,
    },
};

export class ArgumentBlankLineBetweenItemsRule extends Rule {
    private readonly parser = new MarkdownParser();

    constructor() {
        super(META, "markdown");
    }

    public async test(
        code: string,
        ast?: unknown,
        _parentCtx?: Context,
    ): Promise<RuleCheckResult[]> {
        if (!ast) {
            return [RuleCheckResult.pass("AST unavailable, rule skipped")];
        }

        const doc = ast as MarkdownNode;
        const sectionInfo = getSectionByTitles(this.parser, doc, ARGUMENT_SECTION_TITLES);
        if (!sectionInfo) {
            return [RuleCheckResult.pass("Argument Reference section not found, skipped")];
        }

        const lines = code.split(/\r?\n/);
        const lists = this.collectLists(sectionInfo.nodes);
        const violations: RuleCheckResult[] = [];

        for (const list of lists) {
            const items = list.children.filter((node) => node.type === "item");
            for (let i = 1; i < items.length; i++) {
                const prev = items[i - 1];
                const curr = items[i];
                const prevEnd = prev.sourceRange?.end.line;
                const currStart = curr.sourceRange?.start.line;

                if (!prevEnd || !currStart || currStart <= prevEnd) continue;
                if (this.hasBlankLineBetween(lines, prevEnd, currStart)) continue;

                violations.push(
                    this.fail(
                        "missing",
                        lines[currStart - 1] ?? "",
                        lines[currStart - 1] ?? "",
                        RuleCheckResult.fromLine(currStart),
                        currStart,
                    ),
                );
            }
        }

        if (violations.length === 0) {
            return [RuleCheckResult.pass("Argument items are separated by blank lines")];
        }

        return [
            new RuleCheckResult(
                false,
                this.msg("summary", violations.length),
                "",
                "",
                violations,
            ),
        ];
    }

    private collectLists(nodes: MarkdownNode[]): MarkdownNode[] {
        const lists: MarkdownNode[] = [];

        const walk = (node: MarkdownNode): void => {
            if (node.type === "list") {
                lists.push(node);
            }
            for (const child of node.children) {
                walk(child);
            }
        };

        for (const node of nodes) {
            walk(node);
        }

        return lists;
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

function getSectionByTitles(
    parser: MarkdownParser,
    doc: MarkdownNode,
    titles: string[],
): { title: string; nodes: MarkdownNode[] } | null {
    for (const title of titles) {
        const section = parser.getSection(doc, 2, title);
        if (section) return { title, nodes: section };
    }
    return null;
}
