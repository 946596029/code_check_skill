import type { MarkdownNode } from "../ast-parser/markdown";
import type { NodeMatchElement } from "./node-matcher";
import { isGroupMatcher, matchNodes, matchGroup } from "./node-matcher";

export interface NodeMatchFailure {
    /** 0-based index of the element that failed. */
    matcherIndex: number;
    /** Display string of the expected element. */
    expectedDisplay: string;
    /** Number of unconsumed nodes at point of failure. */
    remainingCount: number;
    /** The node that was encountered (if any remain). */
    actual?: MarkdownNode;
}

export interface NodePatternMatch {
    /** Nodes consumed by each element (parallel to the elements array). */
    captures: MarkdownNode[][];
    /** Nodes indexed by tag name. */
    tagged: Record<string, MarkdownNode[]>;
    /** Start index within the input node array. */
    startIndex: number;
    /** Total number of nodes consumed. */
    length: number;
}

export type NodeMatchResult =
    | { ok: true; value: NodePatternMatch }
    | { ok: false; error: NodeMatchFailure };

/**
 * A sequence-level pattern for flat AST node arrays.
 *
 * Analogous to LinePattern for text: instead of matching segments
 * within a single string, NodePattern matches ordered elements
 * against a sequence of MarkdownNode siblings.
 *
 * Elements can be single-node matchers or groups (repeatable
 * sub-sequences).
 */
export class NodePattern {
    private readonly elements: NodeMatchElement[];

    constructor(elements: NodeMatchElement[]) {
        this.elements = elements;
    }

    /**
     * Human-readable display of the expected node sequence.
     */
    toDisplayFormat(): string {
        return this.elements.map((m) => m.display).join(" ");
    }

    /**
     * Test whether the node sequence (from the start) matches.
     */
    test(nodes: MarkdownNode[]): boolean {
        return this.match(nodes).ok;
    }

    /**
     * Match the full element sequence starting from `nodes[0]`.
     */
    match(nodes: MarkdownNode[]): NodeMatchResult {
        return this.matchAt(nodes, 0);
    }

    /**
     * Slide across the node array and collect every non-overlapping match.
     */
    findAll(nodes: MarkdownNode[]): NodePatternMatch[] {
        const results: NodePatternMatch[] = [];
        let i = 0;

        while (i < nodes.length) {
            const result = this.matchAt(nodes, i);
            if (result.ok) {
                results.push(result.value);
                i += Math.max(result.value.length, 1);
            } else {
                i++;
            }
        }

        return results;
    }

    /**
     * Produce a diagnostic message when a node sequence fails to match.
     */
    describeFailure(nodes: MarkdownNode[]): string | null {
        const result = this.match(nodes);
        if (result.ok) return null;

        const { matcherIndex, expectedDisplay, actual } = result.error;
        const actualDesc = actual ? `${actual.type}` : "<end of sequence>";
        return (
            `Mismatch at matcher #${matcherIndex}: ` +
            `expected ${expectedDisplay}, got ${actualDesc}`
        );
    }

    private matchAt(nodes: MarkdownNode[], start: number): NodeMatchResult {
        let offset = start;
        const captures: MarkdownNode[][] = [];
        const taggedMap: Record<string, MarkdownNode[]> = {};

        for (let i = 0; i < this.elements.length; i++) {
            const element = this.elements[i];

            if (isGroupMatcher(element)) {
                const result = matchGroup(element, nodes, offset);

                if (!result.matched) {
                    return {
                        ok: false,
                        error: {
                            matcherIndex: i,
                            expectedDisplay: element.display,
                            remainingCount: nodes.length - offset,
                            actual: offset < nodes.length ? nodes[offset] : undefined,
                        },
                    };
                }

                const captured = nodes.slice(offset, offset + result.consumed);
                captures.push(captured);

                if (element.tag) {
                    taggedMap[element.tag] = captured;
                }
                for (const [key, value] of Object.entries(result.innerTags)) {
                    taggedMap[key] = (taggedMap[key] ?? []).concat(value);
                }

                offset += result.consumed;
            } else {
                const result = matchNodes(element, nodes, offset);

                if (!result.matched) {
                    return {
                        ok: false,
                        error: {
                            matcherIndex: i,
                            expectedDisplay: element.display,
                            remainingCount: nodes.length - offset,
                            actual: offset < nodes.length ? nodes[offset] : undefined,
                        },
                    };
                }

                const captured = nodes.slice(offset, offset + result.consumed);
                captures.push(captured);

                if (element.tag) {
                    taggedMap[element.tag] = captured;
                }

                offset += result.consumed;
            }
        }

        return {
            ok: true,
            value: {
                captures,
                tagged: taggedMap,
                startIndex: start,
                length: offset - start,
            },
        };
    }
}
