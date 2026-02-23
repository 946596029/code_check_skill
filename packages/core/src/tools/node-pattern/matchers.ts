import type { MarkdownNode, MarkdownNodeType, ListType } from "../ast-parser/markdown";
import type { NodeMatcher, NodeMatchElement, GroupMatcher, Quantifier } from "./node-matcher";

function one(): Quantifier {
    return { type: "one" };
}

/**
 * Match a node by its type.
 */
export function nodeType(type: MarkdownNodeType, display?: string): NodeMatcher {
    return {
        predicate: (n: MarkdownNode) => n.type === type,
        display: display ?? type,
        quantifier: one(),
    };
}

/**
 * Match a heading node with a specific level.
 */
export function heading(level: number): NodeMatcher {
    return {
        predicate: (n: MarkdownNode) => n.type === "heading" && n.level === level,
        display: `heading(${level})`,
        quantifier: one(),
    };
}

/**
 * Match a code_block node, optionally restricted by info string.
 */
export function codeBlock(info?: string): NodeMatcher {
    const predicate = info != null
        ? (n: MarkdownNode) => n.type === "code_block" && n.info === info
        : (n: MarkdownNode) => n.type === "code_block";

    const display = info != null ? `code_block(${info})` : "code_block";

    return { predicate, display, quantifier: one() };
}

/**
 * Match a list node, optionally restricted by list type.
 */
export function list(listType?: ListType): NodeMatcher {
    const predicate = listType != null
        ? (n: MarkdownNode) => n.type === "list" && n.listType === listType
        : (n: MarkdownNode) => n.type === "list";

    const display = listType != null ? `list(${listType})` : "list";

    return { predicate, display, quantifier: one() };
}

/**
 * Match a node using a custom predicate.
 */
export function nodeWhere(
    predicate: (n: MarkdownNode) => boolean,
    display: string
): NodeMatcher {
    return { predicate, display, quantifier: one() };
}

/**
 * Match any single node.
 */
export function anyNode(): NodeMatcher {
    return {
        predicate: () => true,
        display: "*",
        quantifier: one(),
    };
}

// ── Quantifier modifiers (single node) ──

/**
 * Make a matcher optional (0 or 1).
 */
export function optionalNode(matcher: NodeMatcher): NodeMatcher {
    return { ...matcher, quantifier: { type: "optional" } };
}

/**
 * Allow a matcher to consume zero or more consecutive nodes.
 */
export function zeroOrMore(matcher: NodeMatcher): NodeMatcher {
    return {
        ...matcher,
        display: `[${matcher.display}]*`,
        quantifier: { type: "zeroOrMore" },
    };
}

/**
 * Require a matcher to consume one or more consecutive nodes.
 */
export function oneOrMore(matcher: NodeMatcher): NodeMatcher {
    return {
        ...matcher,
        display: `[${matcher.display}]+`,
        quantifier: { type: "oneOrMore" },
    };
}

// ── Capture modifier ──

/**
 * Attach a named tag so captured nodes are accessible by name.
 * Works on both single matchers and group matchers.
 */
export function tagged(tag: string, element: NodeMatcher): NodeMatcher;
export function tagged(tag: string, element: GroupMatcher): GroupMatcher;
export function tagged(tag: string, element: NodeMatchElement): NodeMatchElement {
    return { ...element, tag };
}

// ── Group combinators ──

function groupDisplay(matchers: NodeMatcher[], suffix: string): string {
    return `(${matchers.map((m) => m.display).join(" ")})${suffix}`;
}

/**
 * Match a sequence of matchers exactly once as a group.
 */
export function group(matchers: NodeMatcher[]): GroupMatcher {
    return {
        kind: "group",
        matchers,
        display: groupDisplay(matchers, ""),
        quantifier: one(),
    };
}

/**
 * Match a sequence of matchers zero or one time.
 */
export function optionalGroup(matchers: NodeMatcher[]): GroupMatcher {
    return {
        kind: "group",
        matchers,
        display: groupDisplay(matchers, "?"),
        quantifier: { type: "optional" },
    };
}

/**
 * Match a sequence of matchers zero or more times (greedy).
 */
export function zeroOrMoreGroup(matchers: NodeMatcher[]): GroupMatcher {
    return {
        kind: "group",
        matchers,
        display: groupDisplay(matchers, "*"),
        quantifier: { type: "zeroOrMore" },
    };
}

/**
 * Match a sequence of matchers one or more times (greedy).
 */
export function oneOrMoreGroup(matchers: NodeMatcher[]): GroupMatcher {
    return {
        kind: "group",
        matchers,
        display: groupDisplay(matchers, "+"),
        quantifier: { type: "oneOrMore" },
    };
}
