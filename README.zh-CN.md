# code-check-skill

## 前置要求

- Node.js 18+（推荐）
- pnpm 8+

## 安装与构建

```bash
pnpm install
pnpm build
```

常用的定向构建命令：

```bash
pnpm build:core
pnpm build:cli
```

## 运行

先构建，然后运行 CLI 入口（在 `pnpm build` 之后）：

### 列出工作流

```bash
node packages/cli/dist/index.js list workflow
```

### 运行指定工作流（`resource-check`）

```bash
node packages/cli/dist/index.js resource-check <providerRoot> <serviceName> <resourceName> <resourceType>
```

你也可以使用根目录脚本：

```bash
pnpm cli -- list workflow
pnpm cli -- resource-check <providerRoot> <serviceName> <resourceName> <resourceType>
```

## CLI 参考

```text
code-check list workflow
code-check resource-check <providerRoot> <serviceName> <resourceName> <resourceType>
```

### 退出码

- 退出码 `0`：所有检查通过
- 退出码 `1`：一个或多个检查失败，或参数无效
