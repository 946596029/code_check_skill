import type { MarkdownNode } from "../../../../../tools/ast-parser/markdown";
import { MarkdownParser } from "../../../../../tools/ast-parser/markdown";
import {
    NodePattern,
    heading,
    nodeType,
    optionalNode,
    tagged,
} from "../../../../../tools/node-pattern";
import { bodyCheck, type CheckFailure } from "../../../../../tools/section-check";
import { Rule, RuleCheckResult, RuleMeta } from "../../../../types/rule/rule";
import { Context } from "../../../../context/context";
import {
    CTX_EXPECTED_DESCRIPTION,
    CTX_RESOURCE_NAME,
} from "../../context-keys";

const H1_SECTION_OPENING = new NodePattern([
    tagged("h1", heading(1)),
    tagged("desc", optionalNode(nodeType("paragraph"))),
]);

const META: RuleMeta = {
    name: "h1-structure",
    description:
        "First-level heading section must match frontmatter " +
        "(title, description) and use proper -> format for special notes",
    messages: {},
};

export class H1StructureRule extends Rule {
    private readonly parser = new MarkdownParser();

    constructor() {
        super(META, "code");
    }

    public async test(
        code: string,
        ast?: unknown,
        parentCtx?: Context
    ): Promise<RuleCheckResult[]> {
        if (!ast || !parentCtx) {
            return [RuleCheckResult.pass("AST or context is unavailable, rule skipped")];
        }

        const resourceName = parentCtx.get<string>(CTX_RESOURCE_NAME);
        if (!resourceName) {
            return [RuleCheckResult.pass("Resource name is unavailable, rule skipped")];
        }
        const expectedDescription =
            parentCtx.get<string>(CTX_EXPECTED_DESCRIPTION) ?? "";

        const doc = ast as MarkdownNode;
        const failures = await bodyCheck()
            .structure(H1_SECTION_OPENING)
            .taggedTextEquals("h1", resourceName)
            .taggedTextEquals("desc", expectedDescription, {
                normalize: (s) => s.replace(/\s+/g, " ").trim(),
            })
            .validate((section) =>
                this.checkSpecialNotesFormat(section.lines, section.startLine)
            )
            .run(doc, code);

        if (failures.length === 0) {
            const firstH1 = this.parser.getHeadings(doc)
                .find((h) => h.level === 1)?.node;
            return [
                RuleCheckResult.pass(
                    "H1 section structure matches frontmatter",
                    firstH1?.sourceRange ?? undefined
                ),
            ];
        }

        return failures.map(
            (failure) => new RuleCheckResult(
                false,
                failure.message,
                code,
                code,
                [],
                RuleCheckResult.fromLine(failure.line)
            )
        );
    }

    private checkSpecialNotesFormat(
        lines: string[],
        startLine: number
    ): CheckFailure[] {
        const failures: CheckFailure[] = [];
        const arrowLinePattern = /^(\s*)->\s*(.*)?$/;
        const continuationPattern = /^(\s+).+$/;

        let i = 0;
        while (i < lines.length) {
            const match = lines[i].match(arrowLinePattern);
            if (!match) {
                i++;
                continue;
            }

            const leadingSpaces = match[1].length;
            const contentStartCol = leadingSpaces + 3;
            let j = i + 1;
            while (j < lines.length) {
                const line = lines[j];
                if (line.trim() === "") break;
                if (arrowLinePattern.test(line)) break;

                const contMatch = line.match(continuationPattern);
                if (contMatch) {
                    const indent = contMatch[1].length;
                    if (indent > 0 && indent < contentStartCol) {
                        const currentLine = startLine + j;
                        failures.push({
                            message:
                                `Special note continuation line ${currentLine} should be ` +
                                `indented to align with content after "->" ` +
                                `(expected ${contentStartCol} spaces)`,
                            line: currentLine,
                        });
                    }
                }
                j++;
            }

            i = j;
        }

        return failures;
    }
}
