#!/usr/bin/env node

import path from "path";
import { CodeChecker } from "@code-check/core";
import { setupChecker } from "./setup";
import { listWorkflowCommand } from "./commands/list-workflow";
import { checkCommand } from "./commands/check";
import { DefaultResourceResolver } from "./resolver/resource-resolver";

const USAGE = `
Usage:
  code-check <file.md>                  Check a Markdown file (auto-detect workflow)
  code-check <workflow_name> <file_path>  Run a specific workflow on a file
                                         Example: code-check resource-doc ./docs/resource.md
  code-check list workflow              List available workflows
                                         Use this command to discover valid workflow_name values
`;

const WORKFLOW_BY_EXT: Record<string, string> = {
  ".md": "resource-doc",
};

function inferWorkflow(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase();
  return WORKFLOW_BY_EXT[ext];
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;

  if (args.length === 0) {
    console.log(USAGE);
    process.exit(0);
  }

  const checker = new CodeChecker();
  await checker.initialize();
  setupChecker(checker);

  const resolver = new DefaultResourceResolver();

  if (args[0] === "list" && args[1] === "workflow") {
    listWorkflowCommand(checker);
    return;
  }

  if (args.length === 2) {
    const [workflowId, resourcePath] = args;
    await checkCommand(checker, resolver, workflowId, resourcePath);
    return;
  }

  if (args.length === 1) {
    const filePath = args[0];
    const workflowId = inferWorkflow(filePath);
    if (!workflowId) {
      console.error(
        `Cannot infer workflow for "${filePath}". ` +
          `Supported extensions: ${Object.keys(WORKFLOW_BY_EXT).join(", ")}`
      );
      console.log(USAGE);
      process.exit(1);
    }
    await checkCommand(checker, resolver, workflowId, filePath);
    return;
  }

  if (args.length > 2) {
    console.error(`Invalid arguments: ${args.join(" ")}`);
    console.error("Expected exactly: code-check <workflow_name> <file_path>");
    console.log(USAGE);
    process.exit(1);
  }

  console.error(`Unknown command: ${args.join(" ")}`);
  console.log(USAGE);
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
