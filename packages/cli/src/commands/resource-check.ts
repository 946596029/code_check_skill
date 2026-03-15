import { CodeChecker } from "@code-check/core";
import type { ResourceCheckInput } from "@code-check/core";
import { printReport } from "../reporter";

export async function resourceCheckCommand(
  checker: CodeChecker,
  input: ResourceCheckInput
): Promise<void> {
  const code = JSON.stringify(input);
  const report = await checker.check({ code, workflowId: "resource-check" });

  const label = `${input.resourceType}:${input.resourceName} (service=${input.serviceName})`;
  const allPassed = printReport(report, { filePath: label });
  process.exit(allPassed ? 0 : 1);
}
