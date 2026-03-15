# 路标

## 1.固化 core -> cli 层数据约束，分离 cli 层工作，优先实现 core 层功能

### core 层数据结果
```json
{
  "workflowId": "resource-doc",
  "results": [
    {
      "ruleName": "argument-reference-structure",
      "ruleDescription": "Argument Reference section structure validation",
      "ruleType": "code",
      "results": [
        {
          "success": false,
          "message": "Argument Reference section must start with expected intro line.",
          "original": "",
          "suggested": "",
          "children": [],
          "range": {
            "start": { "line": 55, "column": 1 },
            "end": { "line": 55, "column": 1 }
          }
        }
      ]
    }
  ]
}
```

## cli 层存在的问题
1. CLI 直接消费树形结构，展示逻辑与 `RuleCheckResult.children` 强耦合，后续变更成本高。
2. 缺少稳定的“诊断对象”抽象，难以按严重级别、规则类型、行号做统一排序与聚合。
3. 报告协议无版本字段，未来 Core 扩展语义信息时，CLI 兼容策略不清晰。
4. CLI 展示更偏“规则执行结果”，缺少“期望/实际/修复建议”这类语义化视角。
5. 对外系统集成（CI 注解、IDE 诊断、JSON 输出）依赖树结构，适配复杂度偏高。
6. 统计口径较粗，只统计规则通过/失败，缺少错误数、警告数、信息数等维度。

---

# 2. workflow 支持多阶段，结构化检查阶段，结构化提取阶段，语义一致性检查阶段

因为多流依赖很复杂，且现在的场景也可以简化实现，所以我们手工设计一个整合流

## Flow stages

1. Resolve resource file locations and read content
2. Go structured schema extraction
3. Go structured check => produce implement file issue report
4. Markdown format check (no semantic) => produce doc file issue report
5. Markdown semantic check => produce doc file issue report
6. Go test structured extraction
7. Go test structured check => produce test case issue report
8. Go test HCL style check => delegate to existing script

## Input

User provides: `providerRoot`, `serviceName`, `resourceName`, `resourceType` (resource | data-source).

## File resolution rules

Given `providerRoot`, `serviceName`, `resourceName`, `resourceType`:

- provider prefix: `huaweicloud` (hardcoded for now)
- full resource name: `{provider}_{resourceName}` (e.g. `huaweicloud_apig_channel_member`)
- file prefix by type:
  - resource => `resource_{fullResourceName}`
  - data-source => `data_source_{fullResourceName}`

Resolved file paths:

- implement go:
  `{providerRoot}/{provider}/services/{serviceName}/{filePrefix}.go`
- doc markdown:
  - resource => `{providerRoot}/docs/resources/{resourceName}.md`
  - data-source => `{providerRoot}/docs/data-sources/{resourceName}.md`
- test go:
  `{providerRoot}/{provider}/services/acceptance/{serviceName}/{filePrefix}_test.go`

Example (resource):

| param        | value                          |
|--------------|--------------------------------|
| providerRoot | /path/to/terraform-provider    |
| serviceName  | apig                           |
| resourceName | apig_channel_member            |
| resourceType | resource                       |

Resolved:

- implement: `{root}/huaweicloud/services/apig/resource_huaweicloud_apig_channel_member.go`
- doc: `{root}/docs/resources/apig_channel_member.md`
- test: `{root}/huaweicloud/services/acceptance/apig/resource_huaweicloud_apig_channel_member_test.go`

## Implementation plan

### New files

- `packages/core/src/workflow/implement/resource-check/context-keys.ts`
  Context key constants for stage artifacts (entry params, resolved paths,
  loaded sources, extracted schemas, parsed ASTs, test summary, HCL status).
- `packages/core/src/workflow/implement/resource-check/resource-check-workflow.ts`
  `ResourceCheckWorkflow extends Workflow` with 8 stages defined in `defineStages()`.
- `packages/core/src/workflow/implement/resource-check/rules/stage-placeholder-rule.ts`
  Generic placeholder rule for stages not yet implemented; outputs readable
  pass/fail message with source range.
- `packages/core/src/workflow/implement/resource-check/rules/index.ts`
  Re-exports `StagePlaceholderRule` and a default `RESOURCE_CHECK_RULES` array.

### Modified files

- `packages/core/src/index.ts`
  Add export for `ResourceCheckWorkflow`.
- `packages/cli/src/setup.ts`
  Register `ResourceCheckWorkflow` in `setupChecker()`.
- `packages/cli/src/index.ts`
  Accept `resource-check <providerRoot> <serviceName> <resourceName> <resourceType>`
  CLI arguments (4 args => build JSON input and call workflow).

### Stage details

1. **resolve-resource-files** - Build paths from input params, read each file.
   Store resolved paths and source content into context via `CTX_*` keys.
   If a file does not exist, store empty string (do not throw).
2. **extract-go-schema** - If implement source is non-empty, call
   `GoParser.create()` + `TerraformSchemaExtractor.extract()` and store
   `ResourceSchema[]` into context. Otherwise store empty array.
3. **check-go-implement** - Run placeholder rule reporting schema count or
   missing file. Later stages will add real structural checks here.
4. **check-markdown-format** - Parse markdown AST if doc source exists.
   Run placeholder rule. Later stages will reuse `resource-doc` rules here.
5. **check-markdown-semantic** - Read go schema artifacts from context.
   Run placeholder rule that reports cross-source readiness.
6. **extract-go-test** - Parse `_test.go` with `GoParser`, count functions
   and test functions, store summary into context.
7. **check-go-test** - Run placeholder rule reporting test function counts.
8. **check-go-test-hcl-style** - Output `success: false` with message
   "HCL style check script is not configured yet" as a placeholder.

### Tests

- Add `resource-check` to `code-checker.test.ts` registration tests.
- New `packages/core-test/workflow/resource-check-workflow.test.ts`:
  - Workflow runs against `terraform_provider_example` sample files.
  - Returns 5 rule results (one per check stage: stages 3-8, minus extract-only).
  - Stage 8 returns `success: false` with script-not-configured message.

# 3. 扩展 go schema 解析能力

Core 输入侧不完整：当前 Go 提取模型主要聚焦 fields，对 timeouts、importable 等资源级能力覆盖不足。

# 4. go schema 的结构化输出结果如何传递给 markdown checker

## 4.1 markdown 带语义场景的规则，如何获取对应的语义呢？
    通过 context key 来固化查询的键
跨源关联缺失：Markdown 工作流和 Go schema 还没形成统一关联键（资源名、文件映射、命名规范差异）。

# 5. 对规则按阶段进行文件夹的分类

规则职责边界不清：结构规则、语义规则、跨源一致性规则可能混在一起，后续维护和排障成本会升高。
缺失强制门禁：当前对 section 不存在的场景普遍是“跳过”，缺少“应存在但缺失”的硬性错误机制。

# 6. 实现对 implement 文件 go 函数命名的检查，代码模式检查

需要使用到意图识别

# 7. 实现对 test case 文件 go 函数命名的检查

# 8. hcl 单测部分可以后面集成

## 剩下的问题，非核心问题，延后处理
误报治理机制不足：还没有豁免白名单、规则开关、分级降噪策略，语义规则上线后可能噪声偏高。
测试资产结构不够：缺少“schema + markdown 成对样本”的语义基线，回归测试难覆盖真实边界。
报告可读性与可执行性不足：错误信息偏规则视角，缺少“期望/实际/建议动作”的落地表达。
配置与版本治理缺失：规则版本、报告版本、兼容策略（向后兼容/破坏性升级）尚未制度化。
性能与扩展风险未评估：跨源解析、规则增多后的执行时间、内存占用、并行策略暂无基线数据。
工程协作边界不明确：Core/CLI/Test 各自的交付契约和验收标准还没有明确文档化。
观测能力不足：缺少规则命中率、误报率、失败类型分布等指标，难做数据驱动迭代。
