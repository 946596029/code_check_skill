import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
    DescriptionIntentDetector,
    type DescriptionIntent,
} from "../../../../../../../tools/llm/description-intent";

/**
 * Classifies the semantic intent of a single argument's description
 * using an LLM via StructuredCaller.
 */
export class DescriptionIntentClassifier {
    private readonly detector: DescriptionIntentDetector;

    constructor(model: BaseChatModel) {
        this.detector = new DescriptionIntentDetector(model);
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
        const result = await this.detector.detect(argName, text);
        const primary = result.intents[0];
        if (primary) return primary.name;
        return "none";
    }
}
