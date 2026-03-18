import { CodeChecker } from "@code-check/core";
import { printReport } from "../reporter";

export type ResourceCheckInput = {
  providerRoot: string;
  serviceName: string;
  resourceName: string;
  resourceType: "resource" | "data-source";
};

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
