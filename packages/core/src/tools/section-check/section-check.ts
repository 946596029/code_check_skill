import {
    MarkdownParser,
    type MarkdownNode,
} from "../ast-parser/markdown";
import { type NodePattern, type NodePatternMatch } from "../node-pattern";
import type { CheckFailure, BulletItem, SectionData } from "./types";
import { BulletLine } from "./types";

type SectionTarget =
    | { kind: "named"; title: string; level: number }
    | { kind: "body" };

type Step =
    | { kind: "structure"; pattern: NodePattern }
    | { kind: "introLine"; expected: string }
    | {
          kind: "taggedTextEquals";
          tag: string;
          expected: string;
          normalize?: (s: string) => string;
      }
    | {
          kind: "requireBulletList";
          includeNestedLists: boolean;
          message?: string;
      }
    | {
          kind: "eachBulletItem";
          check: (firstLine: BulletLine) => boolean;
          includeNestedLists: boolean;
      }
    | {
          kind: "eachBulletItemAsync";
          check: (item: BulletItem) => Promise<CheckFailure | null>;
          includeNestedLists: boolean;
      }
    | {
          kind: "validate";
          check: (
              section: SectionData
          ) => CheckFailure[] | Promise<CheckFailure[]>;
      };

export class SectionCheck {
    private readonly parser = new MarkdownParser();
    private readonly target: SectionTarget;
    private readonly steps: Step[] = [];

    public constructor(target: SectionTarget) {
        this.target = target;
    }

    public structure(pattern: NodePattern): this {
        this.steps.push({ kind: "structure", pattern });
        return this;
    }

    public introLine(expected: string): this {
        this.steps.push({ kind: "introLine", expected });
        return this;
    }

    public taggedTextEquals(
        tag: string,
        expected: string,
        options?: { normalize?: (s: string) => string }
    ): this {
        this.steps.push({
            kind: "taggedTextEquals",
            tag,
            expected,
            normalize: options?.normalize,
        });
        return this;
    }

    public eachBulletItem(
        check: (firstLine: BulletLine) => boolean,
        options?: { includeNestedLists?: boolean }
    ): this {
        this.steps.push({
            kind: "eachBulletItem",
            check,
            includeNestedLists: options?.includeNestedLists ?? false,
        });
        return this;
    }

    public requireBulletList(options?: {
        includeNestedLists?: boolean;
        message?: string;
    }): this {
        this.steps.push({
            kind: "requireBulletList",
            includeNestedLists: options?.includeNestedLists ?? false,
            message: options?.message,
        });
        return this;
    }

    public eachBulletItemAsync(
        check: (item: BulletItem) => Promise<CheckFailure | null>,
        options?: { includeNestedLists?: boolean }
    ): this {
        this.steps.push({
            kind: "eachBulletItemAsync",
            check,
            includeNestedLists: options?.includeNestedLists ?? false,
        });
        return this;
    }

    public validate(
        check: (
            section: SectionData
        ) => CheckFailure[] | Promise<CheckFailure[]>
    ): this {
        this.steps.push({ kind: "validate", check });
        return this;
    }

    public async run(doc: MarkdownNode, code: string): Promise<CheckFailure[]> {
        const extracted = this.extractSection(doc, code);
        if (!extracted) return [];

        const failures: CheckFailure[] = [];
        let structureMatch: NodePatternMatch | null = null;

        for (const step of this.steps) {
            if (step.kind === "structure") {
                const result = step.pattern.match(extracted.nodes);
                if (!result.ok) {
                    const detail =
                        step.pattern.describeFailure(extracted.nodes) ?? "unknown mismatch";
                    failures.push({
                        message:
                            `${this.targetDisplay()} structure mismatch: ${detail}. ` +
                            `Expected: ${step.pattern.toDisplayFormat()}`,
                        line: extracted.startLine,
                    });
                    return failures;
                }
                structureMatch = result.value;
                continue;
            }

            if (step.kind === "introLine") {
                const firstNonEmpty = extracted.lines.find(
                    (line) => line.trim().length > 0
                );
                if (firstNonEmpty && firstNonEmpty.trim() !== step.expected) {
                    failures.push({
                        message: `${this.targetDisplay()} must start with "${step.expected}".`,
                        line: extracted.startLine,
                    });
                }
                continue;
            }

            if (step.kind === "taggedTextEquals") {
                const tagged = structureMatch?.tagged[step.tag] ?? [];
                const actual = tagged.length > 0
                    ? this.parser.getTextContent(tagged[0])
                    : "";
                const normalize = step.normalize;
                const normalizedActual = normalize ? normalize(actual) : actual;
                const normalizedExpected = normalize
                    ? normalize(step.expected)
                    : step.expected;

                if (normalizedActual !== normalizedExpected) {
                    failures.push({
                        message:
                            `Tagged "${step.tag}" text mismatch. ` +
                            `Expected "${step.expected}", got "${actual}".`,
                        line: tagged[0]?.sourceRange?.start.line ?? extracted.startLine,
                    });
                }
                continue;
            }

            if (step.kind === "eachBulletItem") {
                const bulletItems = this.resolveBulletItems(
                    extracted.nodes,
                    structureMatch?.tagged["bullets"] ?? [],
                    step.includeNestedLists
                );
                for (const item of bulletItems) {
                    const bullet = this.parser.getItemBulletLine(code, item);
                    if (!bullet) continue;

                    const firstLine = new BulletLine(bullet.text, bullet.startLine);
                    const ok = step.check(firstLine);
                    if (ok) continue;

                    const pattern = firstLine.getLastPattern();
                    failures.push({
                        message: pattern
                            ? `Invalid ${this.targetDisplay()} bullet format at line ${firstLine.startLine}. ` +
                              `Expected: ${pattern.toDisplayFormat()}`
                            : `Invalid ${this.targetDisplay()} bullet format at line ${firstLine.startLine}.`,
                        line: firstLine.startLine,
                    });
                }
                continue;
            }

            if (step.kind === "requireBulletList") {
                const listNodes = this.resolveListNodes(
                    structureMatch?.tagged["bullets"]?.length
                        ? structureMatch.tagged["bullets"]
                        : extracted.nodes,
                    step.includeNestedLists
                );
                if (listNodes.length === 0) {
                    failures.push({
                        message:
                            step.message ??
                            `${this.targetDisplay()} exists but does not contain a bullet list.`,
                        line: extracted.startLine,
                    });
                    return failures;
                }
                continue;
            }

            if (step.kind === "eachBulletItemAsync") {
                const bulletItems = this.resolveBulletItems(
                    extracted.nodes,
                    structureMatch?.tagged["bullets"] ?? [],
                    step.includeNestedLists
                );
                for (const node of bulletItems) {
                    const item = this.buildBulletItem(code, node);
                    if (!item) continue;
                    const failure = await step.check(item);
                    if (failure) failures.push(failure);
                }
                continue;
            }

            const customFailures = await step.check({
                nodes: extracted.nodes,
                lines: extracted.lines,
                startLine: extracted.startLine,
            });
            failures.push(...customFailures);
        }

        return failures;
    }

    private extractSection(
        doc: MarkdownNode,
        code: string
    ): SectionData | null {
        if (this.target.kind === "named") {
            const nodes = this.parser.getSection(
                doc,
                this.target.level,
                this.target.title
            );
            if (!nodes) return null;

            const text = this.parser.getSectionText(
                code,
                this.target.level,
                this.target.title
            );
            const startLine =
                text?.startLine ??
                nodes[0]?.sourceRange?.start.line ??
                1;
            return {
                nodes,
                lines: text?.lines ?? [],
                startLine,
            };
        }

        const nodes = this.parser.getBodyChildren(doc);
        const bodyText = this.extractBodyText(code, nodes);
        return {
            nodes,
            lines: bodyText?.lines ?? [],
            startLine: bodyText?.startLine ?? (nodes[0]?.sourceRange?.start.line ?? 1),
        };
    }

    private extractBodyText(
        code: string,
        body: MarkdownNode[]
    ): { lines: string[]; startLine: number } | null {
        const firstNode = body[0];
        if (!firstNode?.sourceRange) return null;

        const allLines = code.split(/\r?\n/);
        const contentStart = firstNode.sourceRange.start.line;
        let endLine = allLines.length;
        for (let i = 1; i < body.length; i++) {
            const node = body[i];
            if (node.type === "heading" && node.sourceRange) {
                endLine = node.sourceRange.start.line - 1;
                break;
            }
        }

        return {
            lines: allLines.slice(contentStart, endLine),
            startLine: contentStart + 1,
        };
    }

    private resolveBulletItems(
        sectionNodes: MarkdownNode[],
        taggedBullets: MarkdownNode[],
        includeNestedLists: boolean
    ): MarkdownNode[] {
        const listNodes = this.resolveListNodes(
            taggedBullets.length > 0 ? taggedBullets : sectionNodes,
            includeNestedLists
        );
        return this.parser.getBulletItems(listNodes);
    }

    private resolveListNodes(
        nodes: MarkdownNode[],
        includeNestedLists: boolean
    ): MarkdownNode[] {
        if (!includeNestedLists) {
            return nodes.filter((n) => n.type === "list");
        }

        const listNodes: MarkdownNode[] = [];
        const seen = new Set<MarkdownNode>();

        const walk = (node: MarkdownNode): void => {
            if (node.type === "list" && !seen.has(node)) {
                seen.add(node);
                listNodes.push(node);
            }
            for (const child of node.children) {
                walk(child);
            }
        };

        for (const node of nodes) {
            walk(node);
        }

        return listNodes;
    }

    private buildBulletItem(code: string, node: MarkdownNode): BulletItem | null {
        const bullet = this.parser.getItemBulletLine(code, node);
        if (!bullet) return null;

        const logical = this.parser.getLogicalLines(code, node);
        const logicalLines = logical?.lines ?? [];
        const descriptionLines = logicalLines.slice(1);
        const argNameMatch = bullet.text.match(/`([^`]+)`/);
        const argName = argNameMatch ? argNameMatch[1] : "unknown";

        return {
            firstLine: new BulletLine(bullet.text, bullet.startLine),
            argName,
            descriptionLines,
            descriptionText: descriptionLines.join("\n"),
            node,
            startLine: node.sourceRange?.start.line ?? bullet.startLine,
        };
    }

    private targetDisplay(): string {
        return this.target.kind === "named"
            ? `${this.target.title} section`
            : "Body";
    }
}

/** Target a named section (e.g. "## Argument Reference"). */
export function sectionCheck(title: string, level: number): SectionCheck {
    return new SectionCheck({ kind: "named", title, level });
}

/** Target the document body (H1 area, excluding frontmatter). */
export function bodyCheck(): SectionCheck {
    return new SectionCheck({ kind: "body" });
}
