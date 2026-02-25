import { CodeChecker } from "@code-check/core";
import { resolveResourcePath, type ResourceResolver } from "../resolver/resource-resolver";
import { printReport } from "../reporter";

export async function checkCommand(
  checker: CodeChecker,
  resolver: ResourceResolver,
  workflowId: string,
  filePath: string
): Promise<void> {
  const code = await resolver.resolve(filePath);
  const resolved = await resolveResourcePath(filePath);

  const report = await checker.check({ code, workflowId });

  const allPassed = printReport(report, { filePath: resolved, sourceCode: code });
  process.exit(allPassed ? 0 : 1);
}
