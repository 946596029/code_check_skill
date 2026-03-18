# code-check-skill

一个由 AI 驱动的代码与文档检查工具包，采用模块化的 `workflow + rule` 架构。

当前仓库主要聚焦于校验使用 Markdown 编写的 Terraform 资源文档。

## 它解决了什么问题

团队通常依赖人工评审来落实文档规范。该项目将这些规范转化为可执行检查，
从而能够在本地和 CI 中自动运行。

当前内置工作流：

- `resource-check`：通过关联 provider schema 与文档工件，对 Terraform 资源进行检查。

## 仓库结构

这是一个基于 pnpm workspace 的 monorepo：

- `packages/core`：核心检查引擎、工作流、规则、解析器、LLM 辅助工具
- `packages/cli`：命令行工具（`code-check`）
- `packages/core-test`：用于 core 与 CLI 行为的 Vitest 测试集

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

## 快速开始

先构建，再运行 CLI 入口：

```bash
pnpm build
node packages/cli/dist/index.js list workflow
```

显式指定某个工作流运行：

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
code-check <workflow_name> <file_path>
code-check list workflow
```

行为说明：

- 退出码 `0`：所有规则通过
- 退出码 `1`：存在一个或多个检查失败，或参数不合法

## LLM 配置

部分检查依赖 LLM 辅助的意图识别。按需配置以下环境变量：

- `DASHSCOPE_API_KEY`
- `DASHSCOPE_BASE_URL`
- `QWEN_MODEL`（默认：`qwen-plus`）

模型客户端创建位置：`packages/core/src/tools/llm/model.ts`。

## 开发

运行 core 测试：

```bash
pnpm test:core
```

监听模式运行测试：

```bash
pnpm test:core:watch
```

运行 LLM 连通性测试：

```bash
pnpm test:llm:connect
```

用于 Prompt 实验的脚本：

```bash
pnpm test:intent:prompt
```

## 架构概览

- `CodeChecker` 负责管理工作流注册与执行。
- `Workflow` 定义生命周期（`preprocess -> process -> postprocess`）。
- 每条 `Rule` 返回结构化的 `RuleCheckResult` 对象。
- CLI 负责解析输入文件、执行检查并输出可读报告。

## 如何扩展项目

典型扩展路径：

1. 在 `packages/core/src/workflow/implement/...` 中新增 `Rule`。
2. 在对应工作流的规则列表中注册该规则。
3. 在 `packages/core-test` 中新增或更新测试。
4. 在 `packages/cli/src/setup.ts` 中注册该工作流。
5. 可选：在 `packages/cli/src/index.ts` 中新增基于扩展名的自动识别逻辑。

## 路线图建议

- 增加除 Terraform 资源文档之外的更多工作流。
- 增加基于配置的规则开关与严重级别。
- 增加 CI 示例与机器可读输出模式。
