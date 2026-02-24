import type { DetectableDescriptionIntent, SlotMap } from "./types";

export interface NormalizationSuggestion {
    intent: DetectableDescriptionIntent;
    template: string;
    suggestion: string | null;
}

/**
 * Best-effort formatter that suggests canonical sentences based on slots.
 * It does not mutate source content and is safe to use as a hint provider.
 */
export function suggestNormalizedSentence(
    intent: DetectableDescriptionIntent,
    slots: SlotMap
): NormalizationSuggestion {
    switch (intent) {
    case "value-range":
        return {
            intent,
            template: "The valid value is range from `min` to `max`.",
            suggestion: buildRangeSuggestion(slots),
        };
    case "enum-values":
        return {
            intent,
            template: "The valid values are as follow:",
            suggestion: "The valid values are as follow:",
        };
    case "char-restriction":
        return {
            intent,
            template: "Only the <char-types> are allowed",
            suggestion: buildCharRestrictionSuggestion(slots),
        };
    case "max-length":
        return {
            intent,
            template: "The <arg_name> contain a maximum of `N` characters.",
            suggestion: buildMaxLengthSuggestion(slots),
        };
    case "default-value":
        return {
            intent,
            template: "The default value is `value`.",
            suggestion: buildDefaultValueSuggestion(slots),
        };
    default:
        return {
            intent,
            template: "",
            suggestion: null,
        };
    }
}

function buildRangeSuggestion(slots: SlotMap): string | null {
    const min = slots.min;
    const max = slots.max;
    if (!min || !max) return null;
    return `The valid value is range from \`${min}\` to \`${max}\`.`;
}

function buildCharRestrictionSuggestion(slots: SlotMap): string | null {
    const allowedChars = slots.allowedChars;
    if (!allowedChars || typeof allowedChars !== "string") return null;
    return `Only the ${allowedChars} are allowed`;
}

function buildMaxLengthSuggestion(slots: SlotMap): string | null {
    const maxLength = slots.maxLength;
    if (!maxLength) return null;
    return `The value contain a maximum of \`${maxLength}\` characters.`;
}

function buildDefaultValueSuggestion(slots: SlotMap): string | null {
    const defaultValue = slots.defaultValue;
    if (!defaultValue) return null;
    return `The default value is \`${defaultValue}\`.`;
}
