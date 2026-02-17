import { describe, it, expect } from "vitest";
import { CodeRule, RuleCheckResult } from "@code-check/core";

/**
 * Concrete implementation of CodeRule for testing purposes.
 * Checks if code contains console.log statements.
 */
class NoConsoleLogRule extends CodeRule {
  constructor() {
    super(
      "no-console-log",
      "Disallow console.log statements",
      /console\.log\(/,
      "console.log is not allowed in production code"
    );
  }

  protected check(code: string): RuleCheckResult | null {
    if (this.pattern && this.pattern.test(code)) {
      return new RuleCheckResult(
        false,
        this.errorMessage,
        code,
        code.replace(/console\.log\([^)]*\);?\n?/g, "")
      );
    }
    return null;
  }
}

/**
 * Concrete implementation that checks for var usage.
 */
class NoVarRule extends CodeRule {
  constructor() {
    super(
      "no-var",
      "Disallow var declarations",
      /\bvar\s+/,
      "Use const or let instead of var"
    );
  }

  protected check(code: string): RuleCheckResult | null {
    if (this.pattern && this.pattern.test(code)) {
      const suggested = code.replace(/\bvar\s+/g, "const ");
      return new RuleCheckResult(false, this.errorMessage, code, suggested);
    }
    return null;
  }
}

describe("CodeRule", () => {
  describe("NoConsoleLogRule", () => {
    const rule = new NoConsoleLogRule();

    it("should have correct properties", () => {
      expect(rule.name).toBe("no-console-log");
      expect(rule.description).toBe("Disallow console.log statements");
      expect(rule.type).toBe("code");
    });

    it("should detect console.log statements", async () => {
      const code = 'console.log("hello world");';
      const result = await rule.test(code);

      expect(result).not.toBeNull();
      expect(result!.success).toBe(false);
      expect(result!.message).toBe("console.log is not allowed in production code");
    });

    it("should pass when no console.log is present", async () => {
      const code = "const x = 1;\nconst y = x + 2;";
      const result = await rule.test(code);

      expect(result).toBeNull();
    });

    it("should provide suggested fix with console.log removed", async () => {
      const code = 'const x = 1;\nconsole.log(x);\nconst y = 2;';
      const result = await rule.test(code);

      expect(result).not.toBeNull();
      expect(result!.suggested).not.toContain("console.log");
    });
  });

  describe("NoVarRule", () => {
    const rule = new NoVarRule();

    it("should detect var declarations", async () => {
      const code = "var x = 1;";
      const result = await rule.test(code);

      expect(result).not.toBeNull();
      expect(result!.success).toBe(false);
      expect(result!.suggested).toBe("const x = 1;");
    });

    it("should pass when const/let is used", async () => {
      const code = "const x = 1;\nlet y = 2;";
      const result = await rule.test(code);

      expect(result).toBeNull();
    });

    it("should replace multiple var occurrences in suggested fix", async () => {
      const code = "var x = 1;\nvar y = 2;";
      const result = await rule.test(code);

      expect(result).not.toBeNull();
      expect(result!.suggested).toBe("const x = 1;\nconst y = 2;");
    });
  });
});
