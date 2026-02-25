import { describe, it, expect } from "vitest";
import {
  Rule,
  RuleCheckResult,
} from "@code-check/core";

describe("RuleCheckResult", () => {
  it("should create instance with all properties", () => {
    const result = new RuleCheckResult(
      true,
      "All checks passed",
      "const x = 1;",
      "const x = 1;",
      [],
      {
        start: { line: 1, column: 1 },
        end: { line: 1, column: 12 },
      }
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe("All checks passed");
    expect(result.original).toBe("const x = 1;");
    expect(result.suggested).toBe("const x = 1;");
    expect(result.range).toEqual({
      start: { line: 1, column: 1 },
      end: { line: 1, column: 12 },
    });
  });

  it("should create instance for failed check", () => {
    const result = new RuleCheckResult(
      false,
      "Variable should use const",
      "let x = 1;",
      "const x = 1;"
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("Variable should use const");
    expect(result.original).toBe("let x = 1;");
    expect(result.suggested).toBe("const x = 1;");
    expect(result.range).toBeUndefined();
  });

  it("should convert line to single-line range", () => {
    expect(RuleCheckResult.fromLine(5)).toEqual({
      start: { line: 5, column: 1 },
      end: { line: 5, column: 1 },
    });
    expect(RuleCheckResult.fromLine(0)).toBeUndefined();
  });
});

describe("Rule (abstract class)", () => {
  class TestRule extends Rule {
    constructor(name: string, description: string) {
      super({ name, description, messages: {} });
    }

    public async test(code: string): Promise<RuleCheckResult[]> {
      if (code.includes("error")) {
        return [new RuleCheckResult(false, "Found error keyword", code, code)];
      }
      return [];
    }
  }

  it("should set name, description, and type correctly", () => {
    const rule = new TestRule("test-rule", "A test rule");

    expect(rule.name).toBe("test-rule");
    expect(rule.description).toBe("A test rule");
    expect(rule.type).toBe("code");
  });

  it("should return result when violation is found", async () => {
    const rule = new TestRule("test-rule", "A test rule");
    const results = await rule.test("this has error in it");

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
  });

  it("should return empty array when no violation is found", async () => {
    const rule = new TestRule("test-rule", "A test rule");
    const results = await rule.test("this is clean code");

    expect(results).toHaveLength(0);
  });
});
