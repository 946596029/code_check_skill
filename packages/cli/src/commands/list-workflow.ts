import { CodeChecker } from "@code-check/core";

export function listWorkflowCommand(checker: CodeChecker): void {
  const workflows = checker.listWorkflows();

  if (workflows.length === 0) {
    console.log("No workflows registered.");
    return;
  }

  console.log("Available workflows:\n");
  for (const wf of workflows) {
    console.log(`  ${wf.id}`);
    console.log(`    ${wf.description}`);
    console.log(`    rules: ${wf.ruleNames.join(", ")}`);
    console.log();
  }
}
