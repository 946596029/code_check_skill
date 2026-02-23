/**
 * Line Pattern Module
 *
 * Provides a composable, segment-based approach to defining
 * and validating line-level text format patterns.
 *
 * @module tools/line-pattern
 */

export { LinePattern } from "./line-pattern";
export type {
    LineMatchResult,
    LineMatchSuccess,
    LineMatchFailure,
} from "./line-pattern";

export type { Segment, SegmentMatchResult } from "./segment";
export { matchSegment } from "./segment";

export {
    literal,
    backticked,
    parenthesized,
    spaces,
    keyword,
    rest,
    optional,
    csvParenthesized,
} from "./segments";
export type { CsvSlot } from "./segments";
