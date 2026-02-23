import type { MarkdownNode } from "../ast-parser/markdown";

/**
 * Controls how many consecutive nodes a single matcher consumes.
 */
export type Quantifier =
    | { type: "one" }
    | { type: "optional" }
    | { type: "zeroOrMore" }
    | { type: "oneOrMore" };

/**
 * Atomic unit for matching a single AST node.
 *
 * Analogous to `Segment` in LinePattern — each matcher owns
 * a predicate instead of a regex, plus a human-readable display
 * string used in diagnostics and `toDisplayFormat()`.
 */
export interface NodeMatcher {
    readonly predicate: (node: MarkdownNode) => boolean;
    readonly display: string;
    readonly quantifier: Quantifier;
    readonly tag?: string;
}

/**
 * A group of matchers treated as a single repeatable unit.
 *
 * The inner matcher sequence is matched as a whole, and the
 * quantifier controls how many times the sequence repeats.
 * Similar to `(A B C)+` in regex.
 */
export interface GroupMatcher {
    readonly kind: "group";
    readonly matchers: NodeMatcher[];
    readonly display: string;
    readonly quantifier: Quantifier;
    readonly tag?: string;
}

/**
 * Either a single-node matcher or a group of matchers.
 */
export type NodeMatchElement = NodeMatcher | GroupMatcher;

export function isGroupMatcher(el: NodeMatchElement): el is GroupMatcher {
    return "kind" in el && (el as GroupMatcher).kind === "group";
}

export interface NodeMatchSegmentResult {
    matched: boolean;
    consumed: number;
}

export interface GroupMatchSegmentResult {
    matched: boolean;
    consumed: number;
    innerTags: Record<string, MarkdownNode[]>;
}

/**
 * Try to consume nodes from `nodes[offset..]` according to
 * the matcher's quantifier.
 *
 * Returns how many nodes were consumed (greedy for multi-quantifiers).
 */
export function matchNodes(
    matcher: NodeMatcher,
    nodes: MarkdownNode[],
    offset: number
): NodeMatchSegmentResult {
    const { predicate, quantifier } = matcher;
    const remaining = nodes.length - offset;

    switch (quantifier.type) {
        case "one": {
            if (remaining < 1 || !predicate(nodes[offset])) {
                return { matched: false, consumed: 0 };
            }
            return { matched: true, consumed: 1 };
        }

        case "optional": {
            if (remaining >= 1 && predicate(nodes[offset])) {
                return { matched: true, consumed: 1 };
            }
            return { matched: true, consumed: 0 };
        }

        case "zeroOrMore": {
            let count = 0;
            while (offset + count < nodes.length && predicate(nodes[offset + count])) {
                count++;
            }
            return { matched: true, consumed: count };
        }

        case "oneOrMore": {
            let count = 0;
            while (offset + count < nodes.length && predicate(nodes[offset + count])) {
                count++;
            }
            if (count === 0) {
                return { matched: false, consumed: 0 };
            }
            return { matched: true, consumed: count };
        }
    }
}

/**
 * Try to match a group (a sequence of matchers repeated per quantifier).
 *
 * Inner matcher tags are accumulated across all iterations
 * into `innerTags`.
 */
export function matchGroup(
    group: GroupMatcher,
    nodes: MarkdownNode[],
    offset: number
): GroupMatchSegmentResult {
    const { matchers, quantifier } = group;

    function matchSequenceOnce(
        start: number
    ): { consumed: number; tags: Record<string, MarkdownNode[]> } | null {
        let pos = start;
        const tags: Record<string, MarkdownNode[]> = {};

        for (const matcher of matchers) {
            const result = matchNodes(matcher, nodes, pos);
            if (!result.matched) return null;

            if (matcher.tag) {
                const captured = nodes.slice(pos, pos + result.consumed);
                tags[matcher.tag] = (tags[matcher.tag] ?? []).concat(captured);
            }
            pos += result.consumed;
        }

        return { consumed: pos - start, tags };
    }

    function mergeTags(
        target: Record<string, MarkdownNode[]>,
        source: Record<string, MarkdownNode[]>
    ): void {
        for (const [key, value] of Object.entries(source)) {
            target[key] = (target[key] ?? []).concat(value);
        }
    }

    const innerTags: Record<string, MarkdownNode[]> = {};

    switch (quantifier.type) {
        case "one": {
            const seq = matchSequenceOnce(offset);
            if (!seq) return { matched: false, consumed: 0, innerTags };
            mergeTags(innerTags, seq.tags);
            return { matched: true, consumed: seq.consumed, innerTags };
        }

        case "optional": {
            const seq = matchSequenceOnce(offset);
            if (!seq) return { matched: true, consumed: 0, innerTags };
            mergeTags(innerTags, seq.tags);
            return { matched: true, consumed: seq.consumed, innerTags };
        }

        case "zeroOrMore": {
            let total = 0;
            while (true) {
                const seq = matchSequenceOnce(offset + total);
                if (!seq || seq.consumed === 0) break;
                mergeTags(innerTags, seq.tags);
                total += seq.consumed;
            }
            return { matched: true, consumed: total, innerTags };
        }

        case "oneOrMore": {
            let total = 0;
            let count = 0;
            while (true) {
                const seq = matchSequenceOnce(offset + total);
                if (!seq || seq.consumed === 0) break;
                mergeTags(innerTags, seq.tags);
                total += seq.consumed;
                count++;
            }
            if (count === 0) return { matched: false, consumed: 0, innerTags };
            return { matched: true, consumed: total, innerTags };
        }
    }
}
