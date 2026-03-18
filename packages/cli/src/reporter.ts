import type { CheckReport } from "@code-check/core";

type RuleResult = CheckReport["results"][number];

type SourcePosition = { line: number; column: number };
type SourceRange = { start: SourcePosition; end: SourcePosition };

type RuleCheckResult = {
  success: boolean;
  message?: string;
  original?: string;
  suggested?: string;
  children?: RuleCheckResult[];
  range?: SourceRange;
};

const SEPARATOR = "─".repeat(60);
const INDENT = "  ";
const CODE_PREFIX = "    | ";
const MAX_SNIPPET_LINES = 5;
const MAX_CODE_LINES = 10;

interface ReportOptions {
  filePath: string;
  sourceCode?: string;
}

export function printReport(report: CheckReport, options: ReportOptions): boolean {
  const { filePath, sourceCode } = options;
  const sourceLines = sourceCode?.split(/\r?\n/) ?? [];

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
    } else {
      totalFailed++;
    }
    printRuleResult(ruleResult, failureCount, sourceLines);
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

function printRuleResult(
  ruleResult: RuleResult,
  failureCount: number,
  sourceLines: string[]
): void {
  const passed = failureCount === 0;
  const status = passed
    ? "\x1b[32m✓ PASS\x1b[0m"
    : "\x1b[31m✗ FAIL\x1b[0m";
  console.log(SEPARATOR);
  console.log(`${INDENT}${status}  ${ruleResult.ruleName}`);
  console.log(`${INDENT}        ${ruleResult.ruleDescription}`);
  console.log();

  for (const result of ruleResult.results) {
    printResultTree(result, 1, sourceLines);
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

function printResultTree(
  result: RuleCheckResult,
  depth: number,
  sourceLines: string[]
): void {
  const treeIndent = INDENT.repeat(depth);
  const rangeDisplay = formatRange(result.range) ?? "(no range)";
  const message = result.message || "(no message)";

  console.log(`${treeIndent}range: ${rangeDisplay}`);
  console.log(`${treeIndent}success: ${result.success}`);
  console.log(`${treeIndent}message: ${message}`);

  const snippet = extractSnippet(sourceLines, result.range);
  if (snippet) {
    console.log(`${treeIndent}code:`);
    printCodeBlock(snippet);
  }

  if (!result.success) {
    const original = result.original;
    const suggested = result.suggested;
    const hasSuggestion =
      typeof original === "string" &&
      typeof suggested === "string" &&
      original !== suggested;
    if (hasSuggestion) {
      console.log(`${treeIndent}original:`);
      printCodeBlock(original, MAX_CODE_LINES);
      console.log(`${treeIndent}suggested:`);
      printCodeBlock(suggested, MAX_CODE_LINES);
    }
  }

  console.log();

  for (const child of result.children ?? []) {
    printResultTree(child, depth + 1, sourceLines);
  }
}

function extractSnippet(
  sourceLines: string[],
  range?: SourceRange
): string | undefined {
  if (!range?.start || sourceLines.length === 0) return undefined;

  const rangeStart = range.start.line;
  const rangeEnd = range.end?.line ?? rangeStart;

  const contextBefore = 1;
  const from = Math.max(1, rangeStart - contextBefore);
  const to = Math.min(sourceLines.length, rangeEnd);
  const cappedTo = Math.min(to, from + MAX_SNIPPET_LINES - 1);

  const lines = sourceLines.slice(from - 1, cappedTo);
  if (lines.length === 0) return undefined;

  const padWidth = String(cappedTo).length;
  const numbered = lines.map(
    (line, i) => `${String(from + i).padStart(padWidth)}: ${line}`
  );
  if (cappedTo < to) {
    numbered.push(`... (${to - cappedTo} more lines)`);
  }
  return numbered.join("\n");
}

function printCodeBlock(code: string, maxLines?: number): void {
  if (!code) {
    console.log(`${CODE_PREFIX}(empty)`);
    return;
  }

  const lines = code.split(/\r?\n/);
  const limit = maxLines ?? lines.length;
  const display =
    lines.length > limit
      ? [...lines.slice(0, limit), `... (${lines.length - limit} more lines)`]
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
