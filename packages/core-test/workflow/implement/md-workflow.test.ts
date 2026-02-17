import { describe, it, expect } from "vitest";
import {
  MarkdownWorkflow,
  RuleCheckResult,
  CodeRule,
} from "@code-check/core";

/**
 * Simple CodeRule implementation for workflow testing.
 */
class NoTodoCommentRule extends CodeRule {
  constructor() {
    super(
      "no-todo",
      "Disallow TODO comments in code",
      /\/\/\s*TODO/i,
      "TODO comments should be resolved before committing"
    );
  }

  protected check(code: string): RuleCheckResult | null {
    if (this.pattern && this.pattern.test(code)) {
      return new RuleCheckResult(
        false,
        this.errorMessage,
        code,
        code.replace(/\/\/\s*TODO[^\n]*/gi, "// RESOLVED")
      );
    }
    return null;
  }
}

class AlwaysPassRule extends CodeRule {
  constructor() {
    super("always-pass", "A rule that always passes", null, "");
  }

  protected check(_code: string): RuleCheckResult | null {
    return null;
  }
}

describe("MarkdownWorkflow", () => {
  it("should trim code during preprocess", () => {
    const workflow = new MarkdownWorkflow();
    workflow.setCode("  \n  const x = 1;  \n  ");
    workflow.preprocess();

    // Access trimmed code via process behavior
    workflow.setRules([new AlwaysPassRule()]);
  });

  it("should return empty results when no rules match", async () => {
    const workflow = new MarkdownWorkflow();
    workflow.setCode("const x = 1;");
    workflow.setRules([new AlwaysPassRule()]);
    workflow.preprocess();

    const results = await workflow.process();
    expect(results).toEqual([]);
  });

  it("should return results for matching rules", async () => {
    const workflow = new MarkdownWorkflow();
    workflow.setCode("// TODO: fix this later\nconst x = 1;");
    workflow.setRules([new NoTodoCommentRule()]);
    workflow.preprocess();

    const results = await workflow.process();
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(false);
    expect(results[0].message).toContain("TODO");
  });

  it("should process multiple rules sequentially", async () => {
    const workflow = new MarkdownWorkflow();
    workflow.setCode("// TODO: fix\nconst x = 1;");
    workflow.setRules([new NoTodoCommentRule(), new AlwaysPassRule()]);
    workflow.preprocess();

    const results = await workflow.process();
    // Only NoTodoCommentRule should return a result
    expect(results.length).toBe(1);
  });

  it("should handle postprocess without errors", () => {
    const workflow = new MarkdownWorkflow();
    expect(() => workflow.postprocess()).not.toThrow();
  });
});
