import { describe, it, expect, beforeEach } from "vitest";
import {
  CodeChecker,
  Workflow,
  Rule,
  RuleCheckResult,
  ResourceDocWorkflow,
} from "@code-check/core";
import type { Context } from "@code-check/core";

class NoTodoRule extends Rule {
  private readonly pattern = /TODO/i;

  constructor() {
    super({
      name: "no-todo",
      description: "Disallow TODO comments",
      messages: {
        found: "TODO comments should be resolved",
      },
    });
  }

  public async test(
    code: string,
    _ast?: unknown,
    _ctx?: Context
  ): Promise<RuleCheckResult[]> {
    if (this.pattern.test(code)) {
      return [
        this.fail(
          "found",
          code,
          code.replace(/\/\/\s*TODO[^\n]*/gi, "// RESOLVED")
        ),
      ];
    }
    return [];
  }
}

class AlwaysPassRule extends Rule {
  constructor() {
    super({ name: "always-pass", description: "Always passes", messages: {} });
  }

  public async test(): Promise<RuleCheckResult[]> {
    return [];
  }
}

class SimpleWorkflow extends Workflow {
  public readonly id = "simple-test";
  public readonly description = "Simple workflow for testing";

  constructor() {
    super();
    this.setRules([new NoTodoRule(), new AlwaysPassRule()]);
  }

  public preprocess(): void {
    this.code = this.code.trim();
  }

  public postprocess(): void {}
}

describe("CodeChecker", () => {
  let checker: CodeChecker;

  beforeEach(async () => {
    checker = new CodeChecker();
    await checker.initialize();
  });

  describe("initialization", () => {
    it("should initialize successfully", () => {
      expect(checker).toBeDefined();
    });

    it("should not initialize twice", async () => {
      await checker.initialize();
      expect(checker.listWorkflows()).toEqual([]);
    });

    it("should throw when check is called before initialize", async () => {
      const uninitChecker = new CodeChecker();
      await expect(
        uninitChecker.check({ code: "test", workflowId: "x" })
      ).rejects.toThrow("not initialized");
    });
  });

  describe("workflow management", () => {
    it("should register and list workflows", () => {
      checker.registerWorkflow(new SimpleWorkflow());

      const workflows = checker.listWorkflows();
      expect(workflows).toHaveLength(1);
      expect(workflows[0].id).toBe("simple-test");
      expect(workflows[0].description).toBe("Simple workflow for testing");
      expect(workflows[0].ruleCount).toBe(2);
      expect(workflows[0].ruleNames).toEqual(["no-todo", "always-pass"]);
    });

    it("should throw on duplicate workflow registration", () => {
      checker.registerWorkflow(new SimpleWorkflow());
      expect(() => checker.registerWorkflow(new SimpleWorkflow())).toThrow(
        'already registered'
      );
    });

    it("should register multiple workflows", () => {
      checker.registerWorkflow(new SimpleWorkflow());
      checker.registerWorkflow(new ResourceDocWorkflow());

      const workflows = checker.listWorkflows();
      expect(workflows).toHaveLength(2);

      const ids = workflows.map((w) => w.id);
      expect(ids).toContain("simple-test");
      expect(ids).toContain("resource-doc");
    });
  });

  describe("check", () => {
    beforeEach(() => {
      checker.registerWorkflow(new SimpleWorkflow());
    });

    it("should throw for unknown workflow", async () => {
      await expect(
        checker.check({ code: "test", workflowId: "unknown" })
      ).rejects.toThrow('not found');
    });

    it("should return results with failures for violating code", async () => {
      const report = await checker.check({
        code: "// TODO: fix later\nconst x = 1;",
        workflowId: "simple-test",
      });

      expect(report.workflowId).toBe("simple-test");
      expect(report.results).toHaveLength(2);

      const todoResult = report.results.find((r) => r.ruleName === "no-todo");
      expect(todoResult).toBeDefined();
      expect(todoResult!.results).toHaveLength(1);
      expect(todoResult!.results[0].success).toBe(false);
    });

    it("should return empty results for clean code", async () => {
      const report = await checker.check({
        code: "const x = 1;",
        workflowId: "simple-test",
      });

      expect(report.workflowId).toBe("simple-test");
      expect(report.results).toHaveLength(2);
      for (const ruleResult of report.results) {
        expect(ruleResult.results).toHaveLength(0);
      }
    });
  });

  describe("check with ResourceDocWorkflow", () => {
    beforeEach(() => {
      checker.registerWorkflow(new ResourceDocWorkflow());
    });

    it("should detect missing frontmatter", async () => {
      const report = await checker.check({
        code: "# Hello\n\nSome content",
        workflowId: "resource-doc",
      });

      const frontmatterResult = report.results.find(
        (r) => r.ruleName.toLowerCase().includes("frontmatter")
      );
      expect(frontmatterResult).toBeDefined();
      expect(frontmatterResult!.results.length).toBeGreaterThanOrEqual(1);
      expect(frontmatterResult!.results[0].success).toBe(false);
    });

    it("should pass when frontmatter exists", async () => {
      const code = [
        "---",
        "title: Test",
        "---",
        "",
        "# Hello",
        "",
        "Some content",
      ].join("\n");

      const report = await checker.check({
        code,
        workflowId: "resource-doc",
      });

      const frontmatterResult = report.results.find(
        (r) => r.ruleName.toLowerCase().includes("frontmatter")
      );
      expect(frontmatterResult).toBeDefined();
      expect(frontmatterResult!.results).toHaveLength(0);
    });
  });
});
