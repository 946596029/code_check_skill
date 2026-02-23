import { z } from "zod";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
    HumanMessage,
    SystemMessage,
    AIMessage,
    type BaseMessage,
} from "@langchain/core/messages";

/**
 * Options for creating a StructuredCaller.
 */
export interface StructuredCallerOptions {
    /** Maximum retry attempts on parse / validation failure (default: 2). */
    maxRetries?: number;
}

export interface StructuredCallSuccess<T> {
    ok: true;
    data: T;
    /** Number of retries consumed (0 = first attempt succeeded). */
    retries: number;
}

export interface StructuredCallFailure {
    ok: false;
    error: string;
    retries: number;
    /** Raw model output from the last attempt, useful for debugging. */
    lastRaw?: string;
}

export type StructuredCallResult<T> =
    | StructuredCallSuccess<T>
    | StructuredCallFailure;

/**
 * Stateless tool that calls an LLM and validates the response against a
 * Zod schema.
 *
 * Workflow:
 *  1. Append JSON format instructions (derived from the Zod schema) to
 *     the system prompt.
 *  2. Invoke the model.
 *  3. Extract JSON from the raw response (handles code fences, leading
 *     text, etc.).
 *  4. Validate the JSON with Zod.
 *  5. On failure, feed the error back to the model and retry up to
 *     `maxRetries` times.
 *
 * Temperature is intentionally NOT managed here — configure it when
 * creating the model (recommend 0–0.2 for structured output).
 *
 * @example
 * ```typescript
 * import { StructuredCaller } from "@code-check/core";
 * import { z } from "zod";
 *
 * const caller = new StructuredCaller(model);
 * const result = await caller.call(
 *     z.object({
 *         pass: z.boolean().describe("Whether the check passed"),
 *         reason: z.string().describe("Short explanation"),
 *     }),
 *     "You are a document reviewer.",
 *     "Check whether the title matches: ...",
 * );
 *
 * if (result.ok) {
 *     console.log(result.data.pass, result.data.reason);
 * }
 * ```
 */
export class StructuredCaller {
    private readonly model: BaseChatModel;
    private readonly maxRetries: number;

    constructor(model: BaseChatModel, options: StructuredCallerOptions = {}) {
        this.model = model;
        this.maxRetries = options.maxRetries ?? 2;
    }

    /**
     * Call the model and return a schema-validated result.
     *
     * @param schema      Zod schema defining the expected output shape.
     * @param systemPrompt  System-level instruction (what the model should do).
     * @param userPrompt    User-level input (the data to process).
     */
    public async call<S extends z.ZodType>(
        schema: S,
        systemPrompt: string,
        userPrompt: string,
    ): Promise<StructuredCallResult<z.infer<S>>> {
        const formatBlock = buildFormatInstruction(schema);
        const messages: BaseMessage[] = [
            new SystemMessage(systemPrompt + "\n\n" + formatBlock),
            new HumanMessage(userPrompt),
        ];

        let lastRaw: string | undefined;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            let raw: string;
            try {
                const response = await this.model.invoke(messages);
                raw = typeof response.content === "string"
                    ? response.content
                    : JSON.stringify(response.content);
            } catch (err) {
                return {
                    ok: false,
                    error: `Model invocation failed: ${
                        err instanceof Error ? err.message : String(err)
                    }`,
                    retries: attempt,
                    lastRaw,
                };
            }

            lastRaw = raw;

            // ── Step 1: extract JSON ──
            const json = extractJson(raw);
            if (json === null) {
                if (attempt < this.maxRetries) {
                    messages.push(
                        new AIMessage(raw),
                        new HumanMessage(
                            "Your response could not be parsed as JSON. " +
                            "Please respond with ONLY a valid JSON object, " +
                            "no extra text or markdown fences.",
                        ),
                    );
                }
                continue;
            }

            // ── Step 2: validate against schema ──
            const parsed = schema.safeParse(json);
            if (parsed.success) {
                return { ok: true, data: parsed.data, retries: attempt };
            }

            if (attempt < this.maxRetries) {
                messages.push(
                    new AIMessage(raw),
                    new HumanMessage(
                        "Your JSON was valid but did not match the required schema.\n" +
                        `Validation errors:\n${formatZodError(parsed.error)}\n` +
                        "Please fix and respond with ONLY the corrected JSON.",
                    ),
                );
            }
        }

        return {
            ok: false,
            error: `Failed to get valid structured output after ${this.maxRetries + 1} attempts`,
            retries: this.maxRetries,
            lastRaw,
        };
    }
}

// ── Utilities ──────────────────────────────────────────────────────────

/**
 * Extract a JSON value from a string that may contain surrounding text
 * or markdown code fences.
 *
 * Tries three strategies in order:
 *  1. Direct `JSON.parse` on the trimmed text.
 *  2. Extract content from the first ``` code fence.
 *  3. Locate the outermost `{ … }` bracket pair.
 *
 * Returns `null` when no valid JSON can be extracted.
 */
export function extractJson(text: string): unknown {
    const trimmed = text.trim();

    // 1. Direct parse
    try {
        return JSON.parse(trimmed);
    } catch { /* continue */ }

    // 2. Markdown code fence
    const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
        try {
            return JSON.parse(fenceMatch[1].trim());
        } catch { /* continue */ }
    }

    // 3. Outermost braces
    const open = trimmed.indexOf("{");
    const close = trimmed.lastIndexOf("}");
    if (open !== -1 && close > open) {
        try {
            return JSON.parse(trimmed.slice(open, close + 1));
        } catch { /* continue */ }
    }

    return null;
}

// ── Internal helpers ──────────────────────────────────────────────────

function buildFormatInstruction(schema: z.ZodType): string {
    let schemaStr: string;
    try {
        const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
        const { $schema: _dropped, ...rest } = jsonSchema;
        schemaStr = JSON.stringify(rest, null, 2);
    } catch {
        schemaStr = "(schema unavailable — follow the instructions above)";
    }

    return [
        "## Response Format",
        "",
        "You MUST respond with ONLY a valid JSON object.",
        "Do NOT wrap it in markdown code fences or add any explanatory text.",
        "The JSON must conform to this schema:",
        "",
        schemaStr,
    ].join("\n");
}

function formatZodError(error: unknown): string {
    if (
        error &&
        typeof error === "object" &&
        "issues" in error &&
        Array.isArray((error as { issues: unknown }).issues)
    ) {
        const issues = (
            error as { issues: Array<{ path: (string | number)[]; message: string }> }
        ).issues;
        return issues
            .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
            .join("\n");
    }
    return String(error);
}
