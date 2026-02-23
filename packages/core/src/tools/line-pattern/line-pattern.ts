import type { Segment } from "./segment";
import { matchSegment } from "./segment";

export interface LineMatchFailure {
    /** 0-based index of the segment that failed. */
    segmentIndex: number;
    /** The display string of the failed segment. */
    expectedDisplay: string;
    /** The remaining unmatched portion of the input. */
    remaining: string;
}

export interface LineMatchSuccess {
    /** The portion of input consumed by each segment. */
    captures: string[];
}

export type LineMatchResult =
    | { ok: true; value: LineMatchSuccess }
    | { ok: false; error: LineMatchFailure };

/**
 * A line-level format pattern composed of ordered segments.
 *
 * Instead of one monolithic regex, the pattern validates input
 * by sequentially applying each segment's own small regex.
 * This makes each piece independently readable, testable,
 * and produces precise error reporting on mismatch.
 */
export class LinePattern {
    private readonly segments: Segment[];

    constructor(segments: Segment[]) {
        this.segments = segments;
    }

    /**
     * Generate the human-readable display format by joining
     * all segment display strings.
     */
    toDisplayFormat(): string {
        return this.segments
            .map((s) => s.display)
            .join("");
    }

    /**
     * Test whether the full line matches this pattern.
     */
    test(line: string): boolean {
        return this.match(line).ok;
    }

    /**
     * Match the line against all segments sequentially.
     *
     * On success, returns the text captured by each segment.
     * On failure, returns which segment failed and what remained.
     */
    match(line: string): LineMatchResult {
        let remaining = line;
        const captures: string[] = [];

        for (let i = 0; i < this.segments.length; i++) {
            const seg = this.segments[i];
            const result = matchSegment(seg, remaining);

            if (!result.matched) {
                if (seg.optional) {
                    captures.push("");
                    continue;
                }
                return {
                    ok: false,
                    error: {
                        segmentIndex: i,
                        expectedDisplay: seg.display,
                        remaining,
                    },
                };
            }

            captures.push(remaining.slice(0, result.consumed));
            remaining = remaining.slice(result.consumed);
        }

        if (remaining.length > 0) {
            return {
                ok: false,
                error: {
                    segmentIndex: this.segments.length,
                    expectedDisplay: "<end of line>",
                    remaining,
                },
            };
        }

        return { ok: true, value: { captures } };
    }

    /**
     * Produce a diagnostic message when a line fails to match.
     */
    describeFailure(line: string): string | null {
        const result = this.match(line);
        if (result.ok) return null;

        const { segmentIndex, expectedDisplay, remaining } = result.error;
        const pos = line.length - remaining.length;
        return (
            `Mismatch at position ${pos} (segment #${segmentIndex}): ` +
            `expected ${expectedDisplay}, ` +
            `got "${remaining.slice(0, 20)}${remaining.length > 20 ? "..." : ""}"`
        );
    }
}
