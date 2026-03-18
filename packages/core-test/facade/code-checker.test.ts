import { describe, it, expect, beforeEach } from "vitest";
import {
  CodeChecker,
  Workflow,
  Rule,
  RuleCheckResult,
} from "@code-check/core";
import type { Context } from "@code-check/core";
import type { WorkflowStage } from "@code-check/core";

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

  protected defineStages(): WorkflowStage[] {
    return [
      {
        id: "normalize",
        description: "Trim input code",
        execute: async (runtime) => {
          runtime.updateCode(runtime.code.trim());
        },
      },
      this.createRuleExecutionStage(),
    ];
  }
}

const CTX_TEST_ARTIFACT = "test.stage.artifact";

class ExpectArtifactRule extends Rule {
  constructor() {
    super({
      name: "expect-artifact",
      description: "Ensures stage artifact is visible to rules",
      messages: {
        missing: "Expected artifact is missing from context",
      },
    });
  }

  public async test(
    _code: string,
    _ast?: unknown,
    parentCtx?: Context
  ): Promise<RuleCheckResult[]> {
    const value = parentCtx?.get<string>(CTX_TEST_ARTIFACT);
    if (value !== "ready") {
      return [this.fail("missing", "", "")];
    }
    return [RuleCheckResult.pass("Artifact is available in rule context")];
  }
}

class ArtifactWorkflow extends Workflow {
  public readonly id = "artifact-workflow";
  public readonly description = "Workflow with stage artifacts";

  constructor() {
    super();
    this.setRules([new ExpectArtifactRule()]);
  }

  protected defineStages(): WorkflowStage[] {
    return [
      {
        id: "seed-artifact",
        description: "Seed context artifact",
        execute: async (runtime) => {
          runtime.setArtifact(CTX_TEST_ARTIFACT, "ready");
        },
      },
      this.createRuleExecutionStage(),
    ];
  }
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

      const workflows = checker.listWorkflows();
      expect(workflows).toHaveLength(1);

      const ids = workflows.map((w) => w.id);
      expect(ids).toContain("simple-test");
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

  describe("stage artifact flow", () => {
    beforeEach(() => {
      checker.registerWorkflow(new ArtifactWorkflow());
    });

    it("should allow rules to read stage artifacts from context keys", async () => {
      const report = await checker.check({
        code: "const x = 1;",
        workflowId: "artifact-workflow",
      });

      expect(report.results).toHaveLength(1);
      expect(report.results[0].ruleName).toBe("expect-artifact");
      expect(report.results[0].results).toHaveLength(1);
      expect(report.results[0].results[0].success).toBe(true);
    });
  });

  // ResourceDocWorkflow tests removed with workflow deletion.
});
