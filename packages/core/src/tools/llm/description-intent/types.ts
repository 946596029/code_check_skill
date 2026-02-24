export type DescriptionIntent =
    | "value-range"
    | "enum-values"
    | "char-restriction"
    | "max-length"
    | "default-value"
    | "none";

export type DetectableDescriptionIntent = Exclude<DescriptionIntent, "none">;

export const DESCRIPTION_INTENTS: DescriptionIntent[] = [
    "value-range",
    "enum-values",
    "char-restriction",
    "max-length",
    "default-value",
    "none",
];

export const DETECTABLE_DESCRIPTION_INTENTS: DetectableDescriptionIntent[] = [
    "value-range",
    "enum-values",
    "char-restriction",
    "max-length",
    "default-value",
];

export type SlotValue = string | number | boolean | string[];
export type SlotMap = Record<string, SlotValue>;

export interface IntentResult {
    name: DetectableDescriptionIntent;
    confidence: number;
    evidenceSpan: string;
    slots?: SlotMap;
}

export type DetectionStatus =
    | "classified"
    | "none"
    | "uncertain"
    | "suspected-standard-intent";

export interface IntentDetectionResult {
    status: DetectionStatus;
    intents: IntentResult[];
    reason?: string;
}

export interface FormatValidationResult {
    ok: boolean;
    expected: string;
    detail?: string;
}

export interface DescriptionFormatSpec {
    intent: DetectableDescriptionIntent;
    validate: (lines: string[]) => FormatValidationResult;
}
