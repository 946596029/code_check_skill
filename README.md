# code-check-skill

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

## Run

Build first, then run the CLI entry (after `pnpm build`):

### List workflows

```bash
node packages/cli/dist/index.js list workflow
```

### Run a specific workflow (`resource-check`)

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
code-check list workflow
code-check resource-check <providerRoot> <serviceName> <resourceName> <resourceType>
```

### Exit codes

- Exit code `0`: all checks pass
- Exit code `1`: one or more checks fail, or arguments are invalid
