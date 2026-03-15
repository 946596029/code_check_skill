import { CodeChecker, ResourceDocWorkflow, ResourceCheckWorkflow } from "@code-check/core";

export function setupChecker(checker: CodeChecker): void {
  checker.registerWorkflow(new ResourceDocWorkflow());
  checker.registerWorkflow(new ResourceCheckWorkflow());
}
