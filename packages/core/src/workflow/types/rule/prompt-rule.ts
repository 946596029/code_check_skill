import { Feature, FeatureMatch } from "../feature/feature";
import { Rule, RuleCheckResult, RuleType, MatcherFn } from "./rule";
import { createQwenModel } from "../../../llm/model";

export abstract class PromptRule extends Rule {
    
    protected readonly prompt: string;

    public constructor(
        name: string, 
        description: string,
        prompt: string,
        features: Feature[] = [],
        matcher: MatcherFn | null = null
    ) {
        const ruleType: RuleType = "prompt";
        super(name, description, ruleType, features, matcher);
        this.prompt = prompt;
    }

    private buildReviewContext(code: string, match?: FeatureMatch): string {
        const context = [
            "Rule metadata:",
            `- Name: ${this.name}`,
            `- Description: ${this.description}`,
            "",
            "Rule prompt:",
            this.prompt,
            "",
        ];

        if (match) {
            context.push(
                "Matched feature location:",
                `- Lines: ${match.start.line}-${match.end.line}`,
                `- Columns: ${match.start.column}-${match.end.column}`,
                ""
            );
        }

        context.push(
            "Code to review:",
            "```",
            code,
            "```"
        );

        return context.join("\n");
    }

    protected override async check(code: string): Promise<RuleCheckResult | null> {
        const model = createQwenModel({ streaming: false });
        const reviewContext = this.buildReviewContext(code);

        try {
            const firstRound = await model.invoke([
                [
                    "system",
                    "You are a strict code reviewer. Analyze code style and correctness " +
                    "based on user rules."
                ],
                [
                    "human",
                    `${reviewContext}\n\nTask:\n1. List all rule violations.\n` +
                    `2. Explain why each item is a violation.\n` +
                    `3. Provide a brief fix direction for each item.`
                ],
            ]);

            const firstRoundText = (firstRound.content as unknown as string[]).join("\n");

            const secondRound = await model.invoke([
                [
                    "system",
                    "You are a strict code reviewer. Return JSON only with no markdown " +
                    "and no extra text."
                ],
                ["human", reviewContext],
                ["assistant", firstRoundText],
                [
                    "human",
                    "Based on your previous analysis, return final JSON only using this " +
                    "schema: {\"success\": boolean, \"message\": string, \"suggested\": string}. " +
                    "Set success=true when there are no violations. Keep suggested as " +
                    "improved full code when violations exist, otherwise return the " +
                    "original code."
                ],
            ]);

            return new RuleCheckResult(
                true,
                "Prompt rule execution succeeded",
                code,
                secondRound.content as string
            );
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown prompt rule error";
            return new RuleCheckResult(
                false,
                `Prompt rule execution failed: ${message}`,
                code,
                code
            );
        }
    }
}

/**
 * Concrete PromptRule that can be instantiated dynamically from DB rule definitions.
 */
export class DynamicPromptRule extends PromptRule {
    constructor(
        name: string,
        description: string,
        prompt: string,
        features: Feature[] = [],
        matcher: MatcherFn | null = null
    ) {
        super(name, description, prompt, features, matcher);
    }
}
