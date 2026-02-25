import { describe, it, expect, vi, afterEach } from "vitest";
import { RuleCheckResult, type CheckReport } from "@code-check/core";
import { printReport } from "../../cli/src/reporter";

describe("CLI reporter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints required fields for failed result with range", () => {
    const report: CheckReport = {
      workflowId: "resource-doc",
      results: [
        {
          ruleName: "demo-rule",
          ruleDescription: "demo description",
          ruleType: "code",
          results: [
            new RuleCheckResult(
              false,
              "something failed",
              "old code",
              "new code",
              [],
              {
                start: { line: 3, column: 2 },
                end: { line: 3, column: 8 },
              }
            ),
          ],
        },
      ],
    };

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const passed = printReport(report, { filePath: "demo.md" });
    const output = logSpy.mock.calls.flat().join("\n");

    expect(passed).toBe(false);
    expect(output).toContain("range: L3:C2-L3:C8");
    expect(output).toContain("success: false");
    expect(output).toContain("message: something failed");
    expect(output).toContain("original:");
    expect(output).toContain("suggested:");
    expect(output).toContain("    | old code");
    expect(output).toContain("    | new code");
    expect(output).toContain("Summary: 1 rules");
  });

  it("prints no-range placeholder when range is missing", () => {
    const report: CheckReport = {
      workflowId: "resource-doc",
      results: [
        {
          ruleName: "demo-rule",
          ruleDescription: "demo description",
          ruleType: "code",
          results: [
            new RuleCheckResult(false, "something failed", "old code", "new code"),
          ],
        },
      ],
    };

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const passed = printReport(report, { filePath: "demo.md" });
    const output = logSpy.mock.calls.flat().join("\n");

    expect(passed).toBe(false);
    expect(output).toContain("range: (no range)");
    expect(output).toContain("success: false");
    expect(output).toContain("message: something failed");
    expect(output).toContain("original:");
    expect(output).toContain("suggested:");
  });

  it("prints required fields for passed rule result", () => {
    const report: CheckReport = {
      workflowId: "resource-doc",
      results: [
        {
          ruleName: "demo-rule",
          ruleDescription: "demo description",
          ruleType: "code",
          results: [
            RuleCheckResult.pass("matched", {
              start: { line: 8, column: 1 },
              end: { line: 8, column: 12 },
            }),
          ],
        },
      ],
    };

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const passed = printReport(report, { filePath: "demo.md" });
    const output = logSpy.mock.calls.flat().join("\n");

    expect(passed).toBe(true);
    expect(output).toContain("✓ PASS");
    expect(output).toContain("range: L8:C1-L8:C12");
    expect(output).toContain("success: true");
    expect(output).toContain("message: matched");
    expect(output).not.toContain("original:");
    expect(output).not.toContain("suggested:");
  });

  it("prints complete result tree with success and failure fields", () => {
    const report: CheckReport = {
      workflowId: "resource-doc",
      results: [
        {
          ruleName: "demo-rule",
          ruleDescription: "demo description",
          ruleType: "code",
          results: [
            new RuleCheckResult(
              false,
              "root failure",
              "old root",
              "new root",
              [
                RuleCheckResult.pass("child pass", {
                  start: { line: 2, column: 1 },
                  end: { line: 2, column: 10 },
                }),
                new RuleCheckResult(false, "child failure", "old child", "new child"),
              ],
              {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 5 },
              }
            ),
          ],
        },
      ],
    };

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const passed = printReport(report, { filePath: "demo.md" });
    const output = logSpy.mock.calls.flat().join("\n");

    expect(passed).toBe(false);
    expect(output).toContain("message: root failure");
    expect(output).toContain("message: child pass");
    expect(output).toContain("message: child failure");
    expect(output).toContain("range: L1:C1-L1:C5");
    expect(output).toContain("range: L2:C1-L2:C10");
    expect(output).toContain("success: true");
    expect(output).toContain("success: false");
    expect(output).toContain("original:");
    expect(output).toContain("suggested:");
  });
});
