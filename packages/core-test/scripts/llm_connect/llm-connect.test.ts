import { describe, it, expect } from "vitest";
import { createModel } from "@code-check/core";

const runConnectivityTest =
  process.env.RUN_LLM_CONNECT_TEST === "1" ||
  process.env.RUN_LLM_CONNECT_TEST === "true";

const llmTest = runConnectivityTest ? it : it.skip;

describe("LLM connectivity", () => {
  llmTest(
    "should call remote LLM successfully",
    { timeout: 30_000 },
    async () => {
      const modelName = process.env.QWEN_MODEL || "qwen-plus";
      const baseURL = process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
      const apiKey = process.env.DASHSCOPE_API_KEY || "";

      expect(baseURL, "Missing DASHSCOPE_BASE_URL").toBeTruthy();
      expect(apiKey, "Missing DASHSCOPE_API_KEY").toBeTruthy();

      const model = createModel(
        modelName,
        0,
        false,
        baseURL as string,
        apiKey as string
      );

      const response = await model.invoke("Reply with exactly one word: pong");
      const content =
        typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);

      expect(content.trim().length).toBeGreaterThan(0);
      expect(content.toLowerCase()).toContain("pong");
    }
  );
});
