/**
 * Represents one atomic piece of a line format pattern.
 *
 * Each segment owns a small regex that matches its portion of the input
 * and a human-readable placeholder used when generating display formats.
 */
export interface Segment {
    /** Regex that matches this segment (must NOT be anchored with ^ or $). */
    readonly regex: RegExp;

    /** Human-readable placeholder, e.g. "`arg_name`" or "(Modifier, Type)". */
    readonly display: string;

    /** Whether this segment is optional. */
    readonly optional?: boolean;
}

export interface SegmentMatchResult {
    matched: boolean;
    consumed: number;
}

/**
 * Try to match a segment at the beginning of `input`.
 * Returns how many characters were consumed, or -1 on failure.
 */
export function matchSegment(
    segment: Segment,
    input: string
): SegmentMatchResult {
    const m = segment.regex.exec(input);
    if (!m || m.index !== 0) {
        return { matched: false, consumed: 0 };
    }
    return { matched: true, consumed: m[0].length };
}
