import type { CheckReport, RuleResult, RuleCheckResult } from "@code-check/core";

const SEPARATOR = "─".repeat(60);
const INDENT = "  ";
const CODE_PREFIX = "    | ";
const MAX_CODE_LINES = 10;

interface ReportOptions {
  filePath: string;
  showPassedRules?: boolean;
}

export function printReport(report: CheckReport, options: ReportOptions): boolean {
  const { filePath, showPassedRules = false } = options;

  console.log();
  console.log(`File:     ${filePath}`);
  console.log(`Workflow: ${report.workflowId}`);
  console.log();

  let totalPassed = 0;
  let totalFailed = 0;

  for (const ruleResult of report.results) {
    const failures = collectAllFailures(ruleResult.results);

    if (failures.length === 0) {
      totalPassed++;
      if (showPassedRules) {
        console.log(`${INDENT}\x1b[32m✓ PASS\x1b[0m  ${ruleResult.ruleName}`);
      }
      continue;
    }

    totalFailed++;
    printRuleFailure(ruleResult, failures);
  }

  console.log(SEPARATOR);
  console.log();
  console.log(
    `Summary: ${report.results.length} rules, ` +
      `\x1b[32m${totalPassed} passed\x1b[0m, ` +
      `\x1b[31m${totalFailed} failed\x1b[0m`
  );
  console.log();

  return totalFailed === 0;
}

function printRuleFailure(
  ruleResult: RuleResult,
  failures: RuleCheckResult[]
): void {
  console.log(SEPARATOR);
  console.log(
    `${INDENT}\x1b[31m✗ FAIL\x1b[0m  ${ruleResult.ruleName}`
  );
  console.log(
    `${INDENT}        ${ruleResult.ruleDescription}`
  );
  console.log();

  for (const failure of failures) {
    console.log(`${INDENT}  \x1b[33m→\x1b[0m ${failure.message}`);

    const hasDistinctSuggestion =
      failure.suggested &&
      failure.original !== failure.suggested;

    if (hasDistinctSuggestion) {
      console.log();
      console.log(`${INDENT}  Original:`);
      printCodeBlock(failure.original);
      console.log(`${INDENT}  Suggested:`);
      printCodeBlock(failure.suggested);
    }

    console.log();
  }
}

function collectAllFailures(results: RuleCheckResult[]): RuleCheckResult[] {
  const failures: RuleCheckResult[] = [];
  for (const r of results) {
    if (!r.success) {
      failures.push(r);
    }
    if (r.children && r.children.length > 0) {
      failures.push(...collectAllFailures(r.children));
    }
  }
  return failures;
}

function printCodeBlock(code: string): void {
  const lines = code.split(/\r?\n/);
  const display =
    lines.length > MAX_CODE_LINES
      ? [...lines.slice(0, MAX_CODE_LINES), `... (${lines.length - MAX_CODE_LINES} more lines)`]
      : lines;

  for (const line of display) {
    console.log(`${CODE_PREFIX}${line}`);
  }
}
