import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { StructuredCaller, extractJson } from "../../../core/src/tools/llm/structured-caller";

// ── Helper: minimal mock that satisfies BaseChatModel.invoke() ──

function mockModel(responses: string[]) {
    let callIndex = 0;
    return {
        invoke: vi.fn(async () => {
            const content = responses[callIndex] ?? "";
            callIndex++;
            return { content };
        }),
    } as never; // cast to avoid full BaseChatModel interface
}

function throwingModel(error: Error) {
    return {
        invoke: vi.fn(async () => { throw error; }),
    } as never;
}

// ═══════════════════════════════════════════════════════════════════════
//  extractJson
// ═══════════════════════════════════════════════════════════════════════

describe("extractJson", () => {
    it("should parse plain JSON", () => {
        expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    });

    it("should parse JSON wrapped in markdown code fence", () => {
        const text = 'Here is the result:\n```json\n{"ok":true}\n```\n';
        expect(extractJson(text)).toEqual({ ok: true });
    });

    it("should parse JSON wrapped in plain code fence (no language tag)", () => {
        const text = '```\n{"ok":true}\n```';
        expect(extractJson(text)).toEqual({ ok: true });
    });

    it("should extract first { … } when surrounded by extra text", () => {
        const text = 'Sure! Here is your result: {"x":42} Hope that helps!';
        expect(extractJson(text)).toEqual({ x: 42 });
    });

    it("should return null for non-JSON text", () => {
        expect(extractJson("Hello world")).toBeNull();
    });

    it("should return null for empty string", () => {
        expect(extractJson("")).toBeNull();
    });

    it("should handle JSON arrays", () => {
        expect(extractJson("[1,2,3]")).toEqual([1, 2, 3]);
    });

    it("should handle whitespace-padded JSON", () => {
        expect(extractJson('  \n  {"key":"val"}  \n  ')).toEqual({ key: "val" });
    });

    it("should return null for malformed JSON inside braces", () => {
        expect(extractJson("{not: valid json}")).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════
//  StructuredCaller
// ═══════════════════════════════════════════════════════════════════════

const SimpleSchema = z.object({
    pass: z.boolean(),
    reason: z.string(),
});

describe("StructuredCaller", () => {
    describe("successful first attempt", () => {
        it("should return parsed data when model responds with valid JSON", async () => {
            const model = mockModel([
                JSON.stringify({ pass: true, reason: "looks good" }),
            ]);
            const caller = new StructuredCaller(model);

            const result = await caller.call(
                SimpleSchema,
                "You are a reviewer.",
                "Check this.",
            );

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.data).toEqual({ pass: true, reason: "looks good" });
                expect(result.retries).toBe(0);
            }
        });

        it("should handle JSON wrapped in code fence on first try", async () => {
            const model = mockModel([
                '```json\n{"pass":false,"reason":"bad"}\n```',
            ]);
            const caller = new StructuredCaller(model);

            const result = await caller.call(
                SimpleSchema,
                "system",
                "user",
            );

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.data.pass).toBe(false);
            }
        });
    });

    describe("retry on invalid JSON", () => {
        it("should retry and succeed when first response is not JSON", async () => {
            const model = mockModel([
                "I think the answer is yes.",
                JSON.stringify({ pass: true, reason: "ok" }),
            ]);
            const caller = new StructuredCaller(model);

            const result = await caller.call(SimpleSchema, "sys", "usr");

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.retries).toBe(1);
            }
        });
    });

    describe("retry on schema validation failure", () => {
        it("should retry when JSON does not match schema", async () => {
            const model = mockModel([
                JSON.stringify({ pass: "not-a-boolean", reason: 123 }),
                JSON.stringify({ pass: true, reason: "fixed" }),
            ]);
            const caller = new StructuredCaller(model);

            const result = await caller.call(SimpleSchema, "sys", "usr");

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.data).toEqual({ pass: true, reason: "fixed" });
                expect(result.retries).toBe(1);
            }
        });
    });

    describe("max retries exhausted", () => {
        it("should return failure after all retries fail", async () => {
            const model = mockModel([
                "garbage",
                "still garbage",
                "more garbage",
            ]);
            const caller = new StructuredCaller(model, { maxRetries: 2 });

            const result = await caller.call(SimpleSchema, "sys", "usr");

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.retries).toBe(2);
                expect(result.lastRaw).toBe("more garbage");
            }
        });
    });

    describe("model invocation error", () => {
        it("should return failure when model throws", async () => {
            const model = throwingModel(new Error("API rate limit"));
            const caller = new StructuredCaller(model);

            const result = await caller.call(SimpleSchema, "sys", "usr");

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain("API rate limit");
            }
        });
    });

    describe("maxRetries option", () => {
        it("should respect maxRetries = 0 (no retries)", async () => {
            const model = mockModel(["not json"]);
            const caller = new StructuredCaller(model, { maxRetries: 0 });

            const result = await caller.call(SimpleSchema, "sys", "usr");

            expect(result.ok).toBe(false);
            expect(model.invoke).toHaveBeenCalledTimes(1);
        });
    });

    describe("prompt construction", () => {
        it("should include JSON schema description in system message", async () => {
            const model = mockModel([
                JSON.stringify({ pass: true, reason: "ok" }),
            ]);
            const caller = new StructuredCaller(model);

            await caller.call(SimpleSchema, "You review code.", "Check this.");

            const firstCall = (model.invoke as ReturnType<typeof vi.fn>).mock.calls[0];
            const messages = firstCall[0] as Array<{ content: string }>;
            const systemContent = messages[0].content;

            expect(systemContent).toContain("Response Format");
            expect(systemContent).toContain('"pass"');
            expect(systemContent).toContain('"reason"');
        });
    });
});
