# code-check-skill

AI-powered code and documentation checking toolkit with a modular
`workflow + rule` architecture.

This repository currently focuses on validating Terraform resource documentation
written in Markdown.

## What It Solves

Teams often rely on manual review to enforce documentation conventions.
This project turns those conventions into executable checks so they can be run
locally and in CI.

Current built-in workflow:

- `resource-check`: validates Terraform resources by cross-checking provider
  schemas and documentation artifacts.

## Repository Structure

This is a pnpm workspace monorepo:

- `packages/core`: core checking engine, workflows, rules, parsers, LLM helpers
- `packages/cli`: command-line interface (`code-check`)
- `packages/core-test`: Vitest test suite for core and CLI behavior

## Prerequisites

- Node.js 18+ (recommended)
- pnpm 8+

## Install And Build

```bash
pnpm install
pnpm build
```

Useful targeted build commands:

```bash
pnpm build:core
pnpm build:cli
```

## Quick Start

Build first, then run the CLI entry:

```bash
pnpm build
node packages/cli/dist/index.js list workflow
```

Run a specific workflow explicitly:

```bash
node packages/cli/dist/index.js resource-check <providerRoot> <serviceName> <resourceName> <resourceType>
```

You can also use the root script:

```bash
pnpm cli -- list workflow
pnpm cli -- resource-check <providerRoot> <serviceName> <resourceName> <resourceType>
```

## CLI Reference

```text
code-check <workflow_name> <file_path>
code-check list workflow
```

Behavior:

- Exit code `0`: all rules pass
- Exit code `1`: one or more checks fail, or arguments are invalid

## LLM Configuration

Some checks rely on LLM-assisted intent detection.
Configure these environment variables when needed:

- `DASHSCOPE_API_KEY`
- `DASHSCOPE_BASE_URL`
- `QWEN_MODEL` (default: `qwen-plus`)

The model client is created in `packages/core/src/tools/llm/model.ts`.

## Development

Run core tests:

```bash
pnpm test:core
```

Watch tests:

```bash
pnpm test:core:watch
```

Run LLM connectivity test:

```bash
pnpm test:llm:connect
```

Prompt experimentation script:

```bash
pnpm test:intent:prompt
```

## Architecture Overview

- `CodeChecker` manages workflow registration and execution.
- A `Workflow` defines lifecycle (`preprocess -> process -> postprocess`).
- Each `Rule` returns structured `RuleCheckResult` objects.
- CLI resolves input files, runs checks, and prints readable reports.

## Extending The Project

Typical extension path:

1. Add a new `Rule` in `packages/core/src/workflow/implement/...`.
2. Register the rule in a workflow's rule list.
3. Add or update tests in `packages/core-test`.
4. Register the workflow in `packages/cli/src/setup.ts`.
5. Optionally add extension-based auto-detection in
   `packages/cli/src/index.ts`.

## Roadmap Ideas

- Add more workflows beyond Terraform resource docs.
- Add configuration-driven rule toggles and severity levels.
- Add CI examples and machine-readable output modes.
