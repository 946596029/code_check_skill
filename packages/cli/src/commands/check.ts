import path from "path";
import { CodeChecker } from "@code-check/core";
import type { ResourceResolver } from "../resolver/resource-resolver";
import { printReport } from "../reporter";

export async function checkCommand(
  checker: CodeChecker,
  resolver: ResourceResolver,
  workflowId: string,
  filePath: string
): Promise<void> {
  const code = await resolver.resolve(filePath);
  const resolved = path.resolve(filePath);

  const report = await checker.check({ code, workflowId });

  const allPassed = printReport(report, { filePath: resolved });
  process.exit(allPassed ? 0 : 1);
}
