import type { MarkdownNode } from "../../../../../../tools/ast-parser/markdown";
import { MarkdownParser } from "../../../../../../tools/ast-parser/markdown";
import { Rule, RuleCheckResult, type RuleMeta } from "../../../../../types/rule/rule";
import type { Context } from "../../../../../context/context";

const META: RuleMeta = {
    name: "md-number-format",
    description:
        "Numbers in prose must be wrapped with backticks or bold markers, " +
        "and large numbers should use thousands separators",
    messages: {
        bareNumber: (line: unknown, num: unknown) =>
            `Line ${line}: bare number "${num}" should be wrapped ` +
            "with backticks (`) or bold (**)",
        missingThousandsSep: (line: unknown, num: unknown, formatted: unknown) =>
            `Line ${line}: number "${num}" should use thousands ` +
            `separator format: "${formatted}"`,
        summary: (count: unknown) =>
            `${count} number formatting issue(s) found`,
    },
};

/**
 * Match numbers already wrapped in backticks or bold:
 *   `123`  `65,535`  **123**  **65,535**
 */
const WRAPPED_NUMBER = /(?:`[^`]*\d[^`]*`|\*\*[^*]*\d[^*]*\*\*)/g;

/**
 * Match bare numbers in text (integers only, not part of identifiers).
 * Excludes numbers preceded/followed by word chars (e.g. "var123", "v2").
 */
const BARE_NUMBER = /(?<![`*\w])(\d[\d,]*)(?![`*\w])/g;

interface LineRange {
    start: number;
    end: number;
}

export class NumberFormatRule extends Rule {
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
            if (this.isInSkipRange(lineNum, skipRanges)) continue;

            const line = lines[i];
            if (this.isNonProseLine(line)) continue;

            const masked = this.maskWrappedNumbers(line);
            this.checkLine(masked, line, lineNum, violations);
        }

        if (violations.length === 0) {
            return [RuleCheckResult.pass("All numbers are properly formatted")];
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
            if (sr) ranges.push({ start: sr.start.line, end: sr.end.line });
        }

        const fm = this.parser.findFirst(doc, (n) => n.type === "frontmatter");
        if (fm?.sourceRange) {
            ranges.push({ start: fm.sourceRange.start.line, end: fm.sourceRange.end.line });
        }

        const headings = this.parser.getHeadings(doc);
        for (const h of headings) {
            const sr = h.node.sourceRange;
            if (sr) ranges.push({ start: sr.start.line, end: sr.end.line });
        }

        return ranges;
    }

    private isInSkipRange(line: number, ranges: LineRange[]): boolean {
        return ranges.some((r) => line >= r.start && line <= r.end);
    }

    /**
     * Skip lines that are not prose: HTML anchors, blank lines,
     * heading markers, code fence markers.
     */
    private isNonProseLine(line: string): boolean {
        const trimmed = line.trim();
        if (!trimmed) return true;
        if (trimmed.startsWith("```")) return true;
        if (trimmed.startsWith("#")) return true;
        if (trimmed.startsWith("<a ")) return true;
        return false;
    }

    /**
     * Replace already-wrapped numbers with placeholder text
     * so they don't trigger false positives.
     */
    private maskWrappedNumbers(line: string): string {
        return line.replace(WRAPPED_NUMBER, (m) => "_".repeat(m.length));
    }

    private checkLine(
        masked: string,
        original: string,
        lineNum: number,
        violations: RuleCheckResult[]
    ): void {
        let match: RegExpExecArray | null;
        BARE_NUMBER.lastIndex = 0;

        while ((match = BARE_NUMBER.exec(masked)) !== null) {
            const raw = match[1];
            const digits = raw.replace(/,/g, "");

            if (!/^\d+$/.test(digits)) continue;
            if (digits.length === 1) continue;

            const numValue = parseInt(digits, 10);

            if (numValue >= 1000 && !this.hasThousandsSeparator(raw)) {
                const formatted = this.formatThousands(digits);
                violations.push(
                    new RuleCheckResult(
                        false,
                        this.msg("missingThousandsSep", lineNum, raw, formatted),
                        original,
                        original.replace(raw, `\`${formatted}\``),
                        [],
                        RuleCheckResult.fromLine(lineNum)
                    )
                );
            } else {
                violations.push(
                    new RuleCheckResult(
                        false,
                        this.msg("bareNumber", lineNum, raw),
                        original,
                        original,
                        [],
                        RuleCheckResult.fromLine(lineNum)
                    )
                );
            }
        }
    }

    private hasThousandsSeparator(num: string): boolean {
        return /^\d{1,3}(,\d{3})+$/.test(num);
    }

    private formatThousands(digits: string): string {
        return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
}
