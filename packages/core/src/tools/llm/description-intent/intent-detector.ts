import { z } from "zod";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { StructuredCaller } from "../structured-caller";
import {
    DETECTABLE_DESCRIPTION_INTENTS,
    type DetectableDescriptionIntent,
    type IntentDetectionResult,
    type IntentResult,
} from "./types";
import { extractSlotsForIntent } from "./slot-extractor";

const IntentItemSchema = z.object({
    name: z.enum(
        DETECTABLE_DESCRIPTION_INTENTS as [
            DetectableDescriptionIntent,
            ...DetectableDescriptionIntent[],
        ]
    ),
    confidence: z.number().min(0).max(1),
    evidenceSpan: z.string().min(1),
});

const DetectionSchema = z.object({
    intents: z.array(IntentItemSchema).default([]),
    uncertain: z.boolean().optional(),
    reason: z.string().optional(),
});

const SYSTEM_PROMPT = `You classify Terraform argument descriptions by semantic intent.

Return all matching intents (multi-label), not just one. Intents:
- "value-range": valid numeric range constraints
- "enum-values": finite allowed values list
- "char-restriction": allowed character classes/content restrictions
- "max-length": maximum length/character count constraints
- "default-value": explicit default value statement

Rules:
1) Output only intents directly supported by text.
2) If confidence is low, set uncertain=true.
3) evidenceSpan must quote the most relevant phrase from input.
4) If no intent matches, return intents=[].
5) Never invent values not present in input text.`;

const SUSPECTED_STANDARD_KEYWORDS: RegExp[] = [
    /\bvalid values?\b/i,
    /\brange\b/i,
    /\bmaximum\b/i,
    /\bdefault\b/i,
    /\bonly\b/i,
    /\ballowed\b/i,
];

export class DescriptionIntentDetector {
    private readonly caller: StructuredCaller;

    constructor(model: BaseChatModel) {
        this.caller = new StructuredCaller(model, { maxRetries: 1 });
    }

    public async detect(
        argName: string,
        text: string
    ): Promise<IntentDetectionResult> {
        const userPrompt = `Argument: \`${argName}\`\nDescription:\n${text}`;
        const result = await this.caller.call(
            DetectionSchema,
            SYSTEM_PROMPT,
            userPrompt
        );
        
        // console.log(result);

        if (!result.ok) {
            if (containsSuspiciousSignals(text)) {
                return {
                    status: "suspected-standard-intent",
                    intents: [],
                    reason: "model_call_failed_with_suspected_signals",
                };
            }
            return { status: "none", intents: [], reason: "model_call_failed" };
        }

        const normalized = dedupeIntents(result.data.intents, text);
        if (normalized.length === 0) {
            if (containsSuspiciousSignals(text)) {
                return {
                    status: "suspected-standard-intent",
                    intents: [],
                    reason: "no_intent_but_suspected_signals",
                };
            }
            return { status: "none", intents: [] };
        }

        if (result.data.uncertain) {
            return {
                status: "uncertain",
                intents: normalized,
                reason: result.data.reason ?? "model_marked_uncertain",
            };
        }

        return {
            status: "classified",
            intents: normalized,
            reason: result.data.reason,
        };
    }
}

function dedupeIntents(
    intents: IntentResult[],
    text: string
): IntentResult[] {
    const map = new Map<DetectableDescriptionIntent, IntentResult>();
    for (const intent of intents) {
        const slots = extractSlotsForIntent(intent.name, text);
        const next: IntentResult = {
            ...intent,
            slots,
        };
        const prev = map.get(intent.name);
        if (!prev || next.confidence > prev.confidence) {
            map.set(intent.name, next);
        }
    }
    return Array.from(map.values()).sort((a, b) => b.confidence - a.confidence);
}

function containsSuspiciousSignals(text: string): boolean {
    return SUSPECTED_STANDARD_KEYWORDS.some((pattern) => pattern.test(text));
}
