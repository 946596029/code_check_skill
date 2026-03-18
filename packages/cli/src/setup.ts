import { CodeChecker, ResourceCheckWorkflow } from "@code-check/core";

export function setupChecker(checker: CodeChecker): void {
  checker.registerWorkflow(new ResourceCheckWorkflow());
}
