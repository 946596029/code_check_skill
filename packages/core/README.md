# @greyworld/code-check-core

AI-powered code review core library.

## Install

```bash
pnpm add @greyworld/code-check-core
```

## Quick Start

```ts
import { CodeChecker } from "@greyworld/code-check-core";

async function main() {
  const checker = new CodeChecker({
    llm: {
      apiKey: process.env.DASHSCOPE_API_KEY,
      baseUrl: process.env.DASHSCOPE_BASE_URL,
      model: process.env.QWEN_MODEL,
    },
  });

  await checker.initialize();

  const report = await checker.check({
    workflowId: "resource-check",
    code: JSON.stringify({
      providerRoot: "/path/to/terraform-provider-example",
      serviceName: "ecs",
      resourceName: "instance",
      resourceType: "resource",
    }),
  });

  console.log(report);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## API

- `CodeChecker`: main entry for workflow registration and execution.
- `initialize()`: initializes checker and built-in workflows.
- `check({ workflowId, code })`: runs a workflow against input content.
- `listWorkflows()`: lists available workflows and rule metadata.

## License

MIT
