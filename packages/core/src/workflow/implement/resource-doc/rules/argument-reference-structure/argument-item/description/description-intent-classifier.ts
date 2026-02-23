import { z } from "zod";
import { StructuredCaller } from "../../../../../../../tools/llm";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { DESCRIPTION_INTENTS, type DescriptionIntent } from "./description-format-spec";

const IntentSchema = z.object({
    intent: z.enum(DESCRIPTION_INTENTS as [string, ...string[]]).describe(
        "The semantic intent category of this argument description"
    ),
});

const SYSTEM_PROMPT = `You are a technical document format classifier.

Given an argument description from a Terraform resource document, classify its
semantic intent into exactly ONE of the following categories:

- "value-range": The text describes a valid numeric range for the argument
  (e.g. "values from 0 to 65535", "must be between 1 and 100").
- "enum-values": The text lists a set of allowed/enumerated values
  (e.g. "valid values are: A, B, C", "can be one of the following").
- "char-restriction": The text describes which character types are allowed
  (e.g. "only letters and numbers are allowed", "must contain only ...").
- "max-length": The text describes a maximum length or character count
  (e.g. "maximum of 255 characters", "at most 64 characters long").
- "default-value": The text states the default value of the argument
  (e.g. "defaults to false", "the default value is 0").
- "none": The text does NOT match any of the above categories.

Classify based on the semantic MEANING, not exact wording.
If the text contains multiple intents, pick the MOST PROMINENT one.
If unsure, choose "none".`;

/**
 * Classifies the semantic intent of a single argument's description
 * using an LLM via StructuredCaller.
 */
export class DescriptionIntentClassifier {
    private readonly caller: StructuredCaller;

    constructor(model: BaseChatModel) {
        this.caller = new StructuredCaller(model, { maxRetries: 1 });
    }

    /**
     * Classify a single argument description.
     *
     * @param argName  - The argument name (for context).
     * @param text     - The description sub-lines joined into a single string.
     * @returns The classified intent, or "none" on failure.
     */
    public async classify(
        argName: string,
        text: string
    ): Promise<DescriptionIntent> {
        const userPrompt =
            `Argument: \`${argName}\`\n` +
            `Description:\n${text}`;

        const result = await this.caller.call(
            IntentSchema,
            SYSTEM_PROMPT,
            userPrompt,
        );

        if (result.ok) {
            return result.data.intent as DescriptionIntent;
        }
        return "none";
    }
}
