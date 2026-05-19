import type { Segment } from "./segment";

/**
 * Factory functions for common segment types.
 *
 * Each factory returns a Segment with a focused regex and
 * a descriptive display string.
 */

/** Matches an exact literal string (whitespace-flexible). */
export function literal(text: string): Segment {
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return {
        regex: new RegExp(escaped),
        display: text,
    };
}

/** Matches `name` — a back-ticked identifier. */
export function backticked(placeholder: string): Segment {
    return {
        regex: /`[^`]+`/,
        display: `\`${placeholder}\``,
    };
}

/** Matches (content) — parenthesized group. */
export function parenthesized(placeholder: string): Segment {
    return {
        regex: /\([^)]+\)/,
        display: `(${placeholder})`,
    };
}

/** Matches whitespace characters. Optionally specify an exact count. */
export function spaces(count?: number): Segment {
    return {
        regex: count !== undefined ? new RegExp(`\\s{${count}}`) : /\s+/,
        display: " ",
    };
}

/** Matches a fixed keyword. */
export function keyword(word: string): Segment {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return {
        regex: new RegExp(escaped),
        display: word,
    };
}

/** Matches the rest of the line (at least one character). */
export function rest(placeholder: string): Segment {
    return {
        regex: /.+/,
        display: placeholder,
    };
}

/** Matches an optional segment — skipped without error if absent. */
export function optional(segment: Segment): Segment {
    return { ...segment, optional: true };
}

const COMMON_TYPOS: Record<string, string> = {
    Integer: "Int",
    Number: "Int",
    Boolean: "Bool",
    Float64: "Float",
    Array: "List",
    Dictionary: "Map",
    Object: "Map",
    StringType: "String",
    IntType: "Int",
    BoolType: "Bool",
};

function buildCsvTypoHint(
    remaining: string,
    slots: CsvSlot[],
): string | undefined {
    const m = /^\(([^)]+)\)/.exec(remaining);
    if (!m) return undefined;
    const parts = m[1].split(/,\s*/);
    const allAllowed = new Set(slots.flatMap((s) => s.values));
    const suggestions: string[] = [];
    for (const part of parts) {
        if (!allAllowed.has(part) && COMMON_TYPOS[part]) {
            suggestions.push(`"${part}" → "${COMMON_TYPOS[part]}"`);
        }
    }
    if (suggestions.length === 0) return undefined;
    return `possible typo — ${suggestions.join("; ")}`;
}

/** One slot in a CSV-parenthesized group. */
export interface CsvSlot {
    /** Display name for this slot. */
    name: string;
    /** Allowed values (matched literally, case-sensitive). */
    values: string[];
    /**
     * If true, zero or more items from this value set may trail
     * the required slots. Must be the last slot.
     */
    zeroOrMore?: boolean;
}

/**
 * Matches a parenthesized, comma-separated group where each positional
 * slot validates against a fixed set of allowed values.
 *
 * Required slots appear in order, separated by `, `.
 * A trailing `zeroOrMore` slot allows 0+ extra comma-separated items
 * drawn from its value set.
 */
export function csvParenthesized(slots: CsvSlot[]): Segment {
    const required = slots.filter((s) => !s.zeroOrMore);
    const trailing = slots.find((s) => s.zeroOrMore);

    const parts = required.map(
        (s) => `(?:${s.values.join("|")})`
    );
    let inner = parts.join(",\\s+");

    if (trailing) {
        inner += `(?:,\\s+(?:${trailing.values.join("|")}))*`;
    }

    const displayParts = required.map((s) => s.name);
    let display = displayParts.join(", ");
    if (trailing) {
        display += `[, ${trailing.name}...]`;
    }

    const failureDetailParts = slots.map((s) => {
        const suffix = s.zeroOrMore ? " (0+)" : "";
        return `${s.name}${suffix}: ${s.values.join("|")}`;
    });
    const failureDetail = failureDetailParts.join("; ");

    const failureHint = (remaining: string): string | undefined =>
        buildCsvTypoHint(remaining, slots);

    return {
        regex: new RegExp(`\\(${inner}\\)`),
        display: `(${display})`,
        failureDetail,
        failureHint,
    };
}
