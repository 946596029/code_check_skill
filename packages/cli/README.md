# @greyworld/code-check-cli

Command line interface for `@greyworld/code-check-core`.

## Install

```bash
pnpm add -g @greyworld/code-check-cli
```

or run without global install:

```bash
npx @greyworld/code-check-cli list workflow
```

## Usage

```bash
code-check list workflow
```

List all available workflows.

```bash
code-check resource-check <providerRoot> <serviceName> <resourceName> <resourceType>
```

Run the built-in `resource-check` workflow.

- `resourceType`: `resource` or `data-source`

## Examples

```bash
code-check list workflow
code-check resource-check ./terraform-provider-foo ecs instance resource
```

## Exit Code

- `0`: all checks passed
- `1`: check failed or invalid arguments

## License

MIT
