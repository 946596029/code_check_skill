import type { DetectableDescriptionIntent, SlotMap } from "./types";

const BACKTICK_PAIR_REGEX = /`([^`]+)`\s+to\s+`([^`]+)`/i;
const MAX_LENGTH_REGEX = /maximum of `([^`]+)` characters/i;
const DEFAULT_VALUE_REGEX = /default value is `([^`]+)`/i;

export function extractSlotsForIntent(
    intent: DetectableDescriptionIntent,
    text: string
): SlotMap {
    switch (intent) {
    case "value-range":
        return extractValueRangeSlots(text);
    case "enum-values":
        return extractEnumSlots(text);
    case "char-restriction":
        return extractCharRestrictionSlots(text);
    case "max-length":
        return extractMaxLengthSlots(text);
    case "default-value":
        return extractDefaultValueSlots(text);
    default:
        return {};
    }
}

function extractValueRangeSlots(text: string): SlotMap {
    const match = text.match(BACKTICK_PAIR_REGEX);
    if (!match) return {};
    return {
        min: match[1],
        max: match[2],
    };
}

function extractEnumSlots(text: string): SlotMap {
    const lines = text.split("\n").map((line) => line.trim());
    const values: string[] = [];
    for (const line of lines) {
        const item = line.match(/^\+\s+\*\*([^*]+)\*\*:/);
        if (item) values.push(item[1].trim());
    }
    return values.length > 0 ? { valueSet: values } : {};
}

function extractCharRestrictionSlots(text: string): SlotMap {
    const match = text.match(/only the (.+?) are allowed/i);
    if (!match) return {};
    return {
        allowedChars: match[1].trim(),
    };
}

function extractMaxLengthSlots(text: string): SlotMap {
    const match = text.match(MAX_LENGTH_REGEX);
    if (!match) return {};
    return {
        maxLength: match[1],
    };
}

function extractDefaultValueSlots(text: string): SlotMap {
    const match = text.match(DEFAULT_VALUE_REGEX);
    if (!match) return {};
    return {
        defaultValue: match[1],
    };
}
