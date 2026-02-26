/**
 * LLM Tool Module
 *
 * Provides structured LLM calling with automatic schema validation
 * and retry logic.  Analogous to RegexGrep for text search —
 * StructuredCaller takes a prompt + Zod schema and returns a
 * type-safe, validated object.
 *
 * @module tools/llm
 */

export { StructuredCaller, extractJson } from "./structured-caller";
export { createModel } from "./model";
export type {
    StructuredCallerOptions,
    StructuredCallResult,
    StructuredCallSuccess,
    StructuredCallFailure,
} from "./structured-caller";

export {
    DescriptionIntentDetector,
    extractSlotsForIntent,
    suggestNormalizedSentence,
    getFormatSpec,
    DESCRIPTION_INTENTS,
    DETECTABLE_DESCRIPTION_INTENTS,
} from "./description-intent";
export type {
    DescriptionIntent,
    DetectableDescriptionIntent,
    SlotMap,
    SlotValue,
    IntentResult,
    IntentDetectionResult,
    DetectionStatus,
    FormatValidationResult,
    DescriptionFormatSpec,
} from "./description-intent";
