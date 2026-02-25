import type {
  CheckReport,
  RuleResult,
  RuleCheckResult,
  SourceRange,
} from "@code-check/core";

const SEPARATOR = "─".repeat(60);
const INDENT = "  ";
const CODE_PREFIX = "    | ";
const MAX_CODE_LINES = 10;

interface ReportOptions {
  filePath: string;
}

export function printReport(report: CheckReport, options: ReportOptions): boolean {
  const { filePath } = options;

  console.log();
  console.log(`File:     ${filePath}`);
  console.log(`Workflow: ${report.workflowId}`);
  console.log();

  let totalPassed = 0;
  let totalFailed = 0;

  for (const ruleResult of report.results) {
    const failureCount = collectAllFailures(ruleResult.results).length;

    if (failureCount === 0) {
      totalPassed++;
      printRuleResult(ruleResult, failureCount);
      continue;
    }

    totalFailed++;
    printRuleResult(ruleResult, failureCount);
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

function printRuleResult(ruleResult: RuleResult, failureCount: number): void {
  const passed = failureCount === 0;
  const status = passed
    ? "\x1b[32m✓ PASS\x1b[0m"
    : "\x1b[31m✗ FAIL\x1b[0m";
  console.log(SEPARATOR);
  console.log(`${INDENT}${status}  ${ruleResult.ruleName}`);
  console.log(`${INDENT}        ${ruleResult.ruleDescription}`);
  console.log();

  for (const result of ruleResult.results) {
    printResultTree(result, 1);
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

function printResultTree(result: RuleCheckResult, depth: number): void {
  const treeIndent = INDENT.repeat(depth);
  const rangeDisplay = formatRange(result.range) ?? "(no range)";
  const message = result.message || "(no message)";

  console.log(`${treeIndent}range: ${rangeDisplay}`);
  console.log(`${treeIndent}success: ${result.success}`);
  console.log(`${treeIndent}message: ${message}`);

  if (!result.success) {
    console.log(`${treeIndent}original:`);
    printCodeBlock(result.original);
    console.log(`${treeIndent}suggested:`);
    printCodeBlock(result.suggested);
  }

  console.log();

  for (const child of result.children ?? []) {
    printResultTree(child, depth + 1);
  }
}

function printCodeBlock(code: string): void {
  if (!code) {
    console.log(`${CODE_PREFIX}(empty)`);
    return;
  }

  const lines = code.split(/\r?\n/);
  const display =
    lines.length > MAX_CODE_LINES
      ? [...lines.slice(0, MAX_CODE_LINES), `... (${lines.length - MAX_CODE_LINES} more lines)`]
      : lines;

  for (const line of display) {
    console.log(`${CODE_PREFIX}${line}`);
  }
}

function formatRange(range?: SourceRange): string | undefined {
  if (!range) return undefined;
  const { start, end } = range;
  if (!start || !end) return undefined;
  return `L${start.line}:C${start.column}-L${end.line}:C${end.column}`;
}
