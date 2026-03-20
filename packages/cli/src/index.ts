#!/usr/bin/env node

import path from "path";
import { CodeChecker } from "@greyworld/code-check-core";
import { setupChecker } from "./setup";
import { listWorkflowCommand } from "./commands/list-workflow";
import { checkCommand } from "./commands/check";
import { resourceCheckCommand } from "./commands/resource-check";
import type { ResourceCheckInput } from "./commands/resource-check";
import { DefaultResourceResolver } from "./resolver/resource-resolver";

const USAGE = `
Usage:
  code-check <workflow_name> <file_path>  Run a specific workflow on a file
                                         Example: code-check resource-check ./path/to/input
  code-check resource-check <providerRoot> <serviceName> <resourceName> <resourceType>
                                         Run resource-check workflow
                                         resourceType: resource | data-source
  code-check list workflow              List available workflows
`;

const WORKFLOW_BY_EXT: Record<string, string> = {};

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

  if (args[0] === "resource-check") {
    if (args.length !== 5) {
      console.error(
        "resource-check requires exactly 4 arguments:\n" +
        "  code-check resource-check <providerRoot> <serviceName> <resourceName> <resourceType>"
      );
      process.exit(1);
    }
    const [, providerRoot, serviceName, resourceName, resourceType] = args;
    if (resourceType !== "resource" && resourceType !== "data-source") {
      console.error(`resourceType must be "resource" or "data-source", got: "${resourceType}"`);
      process.exit(1);
    }
    const input: ResourceCheckInput = {
      providerRoot,
      serviceName,
      resourceName,
      resourceType,
    };
    await resourceCheckCommand(checker, input);
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

  console.error(`Unknown command or invalid arguments: ${args.join(" ")}`);
  console.log(USAGE);
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
