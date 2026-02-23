/**
 * Node Pattern Module
 *
 * Provides a composable, matcher-based approach to defining
 * and validating AST node sequence patterns.
 *
 * Analogous to LinePattern for text lines — NodePattern works
 * on flat arrays of MarkdownNode siblings.
 *
 * @module tools/node-pattern
 */

export { NodePattern } from "./node-pattern";
export type {
    NodeMatchResult,
    NodePatternMatch,
    NodeMatchFailure,
} from "./node-pattern";

export type {
    NodeMatcher,
    GroupMatcher,
    NodeMatchElement,
    Quantifier,
    NodeMatchSegmentResult,
    GroupMatchSegmentResult,
} from "./node-matcher";
export { matchNodes, matchGroup, isGroupMatcher } from "./node-matcher";

export {
    nodeType,
    heading,
    codeBlock,
    list,
    nodeWhere,
    anyNode,
    optionalNode,
    zeroOrMore,
    oneOrMore,
    tagged,
    group,
    optionalGroup,
    zeroOrMoreGroup,
    oneOrMoreGroup,
} from "./matchers";
