import {
    LinePattern,
    keyword,
    spaces,
    backticked,
    literal,
    rest,
} from "../../../../../../../tools/line-pattern";

/**
 * Semantic intent categories for argument description sub-lines.
 *
 * The LLM classifier assigns one of these to each description,
 * then the corresponding LinePattern validator checks the exact format.
 */
export type DescriptionIntent =
    | "value-range"
    | "enum-values"
    | "char-restriction"
    | "max-length"
    | "default-value"
    | "none";

export const DESCRIPTION_INTENTS: DescriptionIntent[] = [
    "value-range",
    "enum-values",
    "char-restriction",
    "max-length",
    "default-value",
    "none",
];

export interface FormatValidationResult {
    ok: boolean;
    expected: string;
    detail?: string;
}

export interface DescriptionFormatSpec {
    intent: DescriptionIntent;
    validate: (lines: string[]) => FormatValidationResult;
}

// ── Pattern definitions ────────────────────────────────────────────────

const VALUE_RANGE_PATTERN = new LinePattern([
    keyword("The valid value is range from"),
    spaces(1),
    backticked("min"),
    spaces(1),
    keyword("to"),
    spaces(1),
    backticked("max"),
    literal("."),
]);

const ENUM_INTRO_PATTERN = new LinePattern([
    keyword("The valid values are as follow:"),
]);

const ENUM_ITEM_PATTERN = new LinePattern([
    literal("+ "),
    literal("**"),
    rest("value"),
]);

const MAX_LENGTH_REGEX = /contain a maximum of `[^`]+` characters\./;

const DEFAULT_VALUE_PATTERN = new LinePattern([
    keyword("The default value is"),
    spaces(1),
    backticked("value"),
    literal("."),
]);

const CHAR_RESTRICTION_PATTERN = new LinePattern([
    keyword("Only the"),
    spaces(1),
    rest("char_types_and_suffix"),
]);

// ── Spec implementations ───────────────────────────────────────────────

const VALUE_RANGE_SPEC: DescriptionFormatSpec = {
    intent: "value-range",
    validate(lines) {
        const expected = VALUE_RANGE_PATTERN.toDisplayFormat();
        const target = findRelevantLine(lines, /valid\s+value.*range|range\s+from/i);
        if (!target) {
            return { ok: false, expected, detail: "No line matches value-range pattern" };
        }
        const ok = VALUE_RANGE_PATTERN.test(target);
        return {
            ok,
            expected,
            detail: ok ? undefined : VALUE_RANGE_PATTERN.describeFailure(target) ?? undefined,
        };
    },
};

const ENUM_VALUES_SPEC: DescriptionFormatSpec = {
    intent: "enum-values",
    validate(lines) {
        const introExpected = ENUM_INTRO_PATTERN.toDisplayFormat();
        if (lines.length === 0) {
            return { ok: false, expected: introExpected, detail: "No lines to check" };
        }

        const introLine = lines[0].trim();
        if (!ENUM_INTRO_PATTERN.test(introLine)) {
            return {
                ok: false,
                expected: introExpected,
                detail: ENUM_INTRO_PATTERN.describeFailure(introLine) ?? undefined,
            };
        }

        const itemLines = lines.slice(1).filter((l) => l.trim().length > 0);
        for (const line of itemLines) {
            const trimmed = line.trim();
            if (!ENUM_ITEM_PATTERN.test(trimmed)) {
                return {
                    ok: false,
                    expected: `+ **value**: description`,
                    detail: `Invalid enum item: "${trimmed}"`,
                };
            }
        }

        return { ok: true, expected: introExpected };
    },
};

const CHAR_RESTRICTION_SPEC: DescriptionFormatSpec = {
    intent: "char-restriction",
    validate(lines) {
        const expected = `Only the {char_types} are allowed`;
        const target = findRelevantLine(lines, /only\s+the\b/i);
        if (!target) {
            return { ok: false, expected, detail: "No line matches char-restriction pattern" };
        }
        const ok = CHAR_RESTRICTION_PATTERN.test(target);
        if (!ok) {
            return {
                ok: false,
                expected,
                detail: CHAR_RESTRICTION_PATTERN.describeFailure(target) ?? undefined,
            };
        }
        if (!/are allowed/i.test(target)) {
            return { ok: false, expected, detail: `Missing "are allowed" suffix` };
        }
        return { ok: true, expected };
    },
};

const MAX_LENGTH_SPEC: DescriptionFormatSpec = {
    intent: "max-length",
    validate(lines) {
        const expected = "... contain a maximum of `N` characters.";
        const target = findRelevantLine(lines, /maximum|at most/i);
        if (!target) {
            return { ok: false, expected, detail: "No line matches max-length pattern" };
        }
        const ok = MAX_LENGTH_REGEX.test(target);
        return {
            ok,
            expected,
            detail: ok ? undefined : `Got: "${target}"`,
        };
    },
};

const DEFAULT_VALUE_SPEC: DescriptionFormatSpec = {
    intent: "default-value",
    validate(lines) {
        const expected = DEFAULT_VALUE_PATTERN.toDisplayFormat();
        const target = findRelevantLine(lines, /default\s+value/i);
        if (!target) {
            return { ok: false, expected, detail: "No line matches default-value pattern" };
        }
        const ok = DEFAULT_VALUE_PATTERN.test(target);
        return {
            ok,
            expected,
            detail: ok ? undefined : DEFAULT_VALUE_PATTERN.describeFailure(target) ?? undefined,
        };
    },
};

// ── Registry ───────────────────────────────────────────────────────────

const SPEC_MAP = new Map<DescriptionIntent, DescriptionFormatSpec>([
    ["value-range", VALUE_RANGE_SPEC],
    ["enum-values", ENUM_VALUES_SPEC],
    ["char-restriction", CHAR_RESTRICTION_SPEC],
    ["max-length", MAX_LENGTH_SPEC],
    ["default-value", DEFAULT_VALUE_SPEC],
]);

export function getFormatSpec(
    intent: DescriptionIntent
): DescriptionFormatSpec | undefined {
    return SPEC_MAP.get(intent);
}

// ── Helpers ────────────────────────────────────────────────────────────

function findRelevantLine(lines: string[], pattern: RegExp): string | null {
    for (const line of lines) {
        if (pattern.test(line)) return line.trim();
    }
    return null;
}
