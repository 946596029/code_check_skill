import { describe, it, expect } from "vitest";
import {
  Rule,
  RuleCheckResult,
  RuleType,
} from "@code-check/core";

describe("RuleCheckResult", () => {
  it("should create instance with all properties", () => {
    const result = new RuleCheckResult(true, "All checks passed", "const x = 1;", "const x = 1;");

    expect(result.success).toBe(true);
    expect(result.message).toBe("All checks passed");
    expect(result.original).toBe("const x = 1;");
    expect(result.suggested).toBe("const x = 1;");
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
  });
});

describe("Rule (abstract class)", () => {
  class TestRule extends Rule {
    constructor(name: string, description: string, type: RuleType) {
      super(name, description, type);
    }

    public async test(code: string): Promise<RuleCheckResult | null> {
      if (code.includes("error")) {
        return new RuleCheckResult(false, "Found error keyword", code, code);
      }
      return null;
    }
  }

  it("should set name, description, and type correctly", () => {
    const rule = new TestRule("test-rule", "A test rule", "code");

    expect(rule.name).toBe("test-rule");
    expect(rule.description).toBe("A test rule");
    expect(rule.type).toBe("code");
  });

  it("should return result when violation is found", async () => {
    const rule = new TestRule("test-rule", "A test rule", "code");
    const result = await rule.test("this has error in it");

    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
  });

  it("should return null when no violation is found", async () => {
    const rule = new TestRule("test-rule", "A test rule", "code");
    const result = await rule.test("this is clean code");

    expect(result).toBeNull();
  });
});
