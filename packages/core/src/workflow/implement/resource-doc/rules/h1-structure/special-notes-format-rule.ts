import { Rule, RuleCheckResult, RuleMeta } from "../../../../types/rule/rule";
import { Context } from "../../../../context/context";
import {
    LinePattern,
    literal,
    spaces,
    rest,
    optional,
} from "../../../../../tools/line-pattern";

const ARROW_LINE_PATTERN = new LinePattern([
    optional(spaces()),
    literal("->"),
    spaces(),
    optional(rest("content")),
]);

const CONTINUATION_LINE_PATTERN = new LinePattern([
    spaces(),
    rest("content"),
]);

const META: RuleMeta = {
    name: "special-notes-format",
    description:
        "Special notes must use -> prefix with proper alignment " +
        "for continuations",
    messages: {
        badIndent: (line: unknown, expectedSpaces: unknown) =>
            `Special note continuation line ${line} should be ` +
            `indented to align with content after "->" ` +
            `(expected ${expectedSpaces} spaces)`,
    },
};

export class SpecialNotesFormatRule extends Rule {
    constructor() {
        super(META, "code");
    }

    public async test(
        code: string,
        _ast?: unknown,
        _parentCtx?: Context
    ): Promise<RuleCheckResult[]> {
        return this.checkSpecialNotesFormat(code);
    }

    private checkSpecialNotesFormat(code: string): RuleCheckResult[] {
        const results: RuleCheckResult[] = [];
        const lines = code.split(/\r?\n/);

        let i = 0;
        while (i < lines.length) {
            const line = lines[i];
            const arrowResult = ARROW_LINE_PATTERN.match(line);

            if (arrowResult.ok) {
                const leadingSpaces = arrowResult.value.captures[0].length;
                const contentStartCol = leadingSpaces + 3;

                let j = i + 1;
                while (j < lines.length) {
                    const nextLine = lines[j];
                    if (nextLine.trim() === "") break;

                    const arrowCheck = ARROW_LINE_PATTERN.match(nextLine);
                    if (arrowCheck.ok) break;

                    const contResult = CONTINUATION_LINE_PATTERN.match(nextLine);
                    if (contResult.ok) {
                        const contSpaces = contResult.value.captures[0].length;
                        if (contSpaces > 0 && contSpaces < contentStartCol) {
                            const expectedSpaces = " ".repeat(contentStartCol);
                            const suggested = nextLine.replace(
                                /^\s+/,
                                expectedSpaces
                            );
                            results.push(
                                this.fail(
                                    "badIndent",
                                    nextLine,
                                    suggested,
                                    j + 1,
                                    contentStartCol
                                )
                            );
                        }
                    }
                    j++;
                }
                i = j;
            } else {
                i++;
            }
        }

        return results;
    }
}
