import type { MarkdownNode, SourceRange } from "../../../../../../tools/ast-parser/markdown";
import { MarkdownParser } from "../../../../../../tools/ast-parser/markdown";
import { Rule, RuleCheckResult, type RuleMeta } from "../../../../../types/rule/rule";
import type { Context } from "../../../../../context/context";

const MAX_LINE_LENGTH = 120;

const META: RuleMeta = {
    name: "md-line-length",
    description: `Lines must not exceed ${MAX_LINE_LENGTH} columns; use soft line breaks to wrap`,
    messages: {
        tooLong: (line: unknown, length: unknown) =>
            `Line ${line} exceeds ${MAX_LINE_LENGTH} columns (actual: ${length}). ` +
            `Use a soft line break to wrap.`,
        summary: (count: unknown) =>
            `${count} line(s) exceed ${MAX_LINE_LENGTH} columns`,
    },
};

interface LineRange {
    start: number;
    end: number;
}

export class LineLengthRule extends Rule {
    private readonly parser = new MarkdownParser();

    constructor() {
        super(META, "markdown");
    }

    public async test(
        code: string,
        ast?: unknown,
        _parentCtx?: Context
    ): Promise<RuleCheckResult[]> {
        const lines = code.split(/\r?\n/);
        const skipRanges = ast ? this.buildSkipRanges(ast as MarkdownNode) : [];
        const violations: RuleCheckResult[] = [];

        for (let i = 0; i < lines.length; i++) {
            const lineNum = i + 1;
            const line = lines[i];

            if (line.length <= MAX_LINE_LENGTH) continue;
            if (this.isInSkipRange(lineNum, skipRanges)) continue;
            if (this.shouldSkipLine(line)) continue;

            violations.push(
                new RuleCheckResult(
                    false,
                    this.msg("tooLong", lineNum, line.length),
                    line,
                    line,
                    [],
                    RuleCheckResult.fromLine(lineNum)
                )
            );
        }

        if (violations.length === 0) {
            return [RuleCheckResult.pass("All lines are within length limit")];
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

    private buildSkipRanges(doc: MarkdownNode): LineRange[] {
        const ranges: LineRange[] = [];

        const codeBlocks = this.parser.getCodeBlocks(doc);
        for (const cb of codeBlocks) {
            const sr = cb.node.sourceRange;
            if (sr) {
                ranges.push({ start: sr.start.line, end: sr.end.line });
            }
        }

        const fm = this.parser.findFirst(doc, (n) => n.type === "frontmatter");
        if (fm?.sourceRange) {
            ranges.push({ start: fm.sourceRange.start.line, end: fm.sourceRange.end.line });
        }

        return ranges;
    }

    private isInSkipRange(line: number, ranges: LineRange[]): boolean {
        return ranges.some((r) => line >= r.start && line <= r.end);
    }

    /**
     * Skip lines that cannot reasonably be wrapped:
     * HTML anchor tags, pure URLs, markdown link definitions.
     */
    private shouldSkipLine(line: string): boolean {
        const trimmed = line.trim();
        if (trimmed.startsWith("<a ") && trimmed.endsWith(">")) return true;
        if (/^\[.+\]:\s*https?:\/\//.test(trimmed)) return true;
        if (/^https?:\/\/\S+$/.test(trimmed)) return true;
        return false;
    }
}
