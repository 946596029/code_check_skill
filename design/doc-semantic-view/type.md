## DocSemanticView 类型定义（草案）

目标：把 Markdown 的“线性块结构”（AST）提升为 Terraform Provider 文档的“领域语义结构”，让语义规则只依赖 view。

```typescript
export type StringTree = {
  text: string;
  children: StringTree[];
  sourceRange?: SourceRange;
}

export type DocBlockType = "FrontMatter" | "Title" | "ArgumentList" | "AttributeList" | "Import" | "TimeOut"

export type DocBlock = FrontMatter | Title | ArgumentList | AttributeList | Import | TimeOut

export class FrontMatter {
  subcategory: string;
  pageTitle: string;
  description: string;
  raw: Record<string, unknown>;  // 保留原始 YAML 数据以备扩展
  sourceRange?: SourceRange;
}

export class Title {
  title: string;
  description: string;
  sourceRange?: SourceRange;
}

export class Example {
  title: string;
  code: string;
  sourceRange?: SourceRange;
}

export class ExampleList {
  title: string;
  examples: Example[];
  sourceRange?: SourceRange;
}

export class Argument {
  name: string;
  tags: string[];
  description: string;
  details: StringTree;
  arguments: Argument[];
  sourceRange?: SourceRange;
}

export class ArgumentList {
  title: string;
  description: string;
  isComputed: () => boolean;
  // 其他标签类似
  arguments: Argument[];
  sourceRange?: SourceRange;
}

export class Attribute {
  name: string;
  description: string;
  details: StringTree;
  attributes: Attribute[];
  sourceRange?: SourceRange;
}

export class AttributeList {
  title: string;
  description: string;
  attributes: Attribute[];
  sourceRange?: SourceRange;
}

export class Import {
  hasImportBlock: boolean;
  importIdPattern?: string;  // 如果能从 doc 中提取 import id 格式
  sourceRange?: SourceRange;
}

export class TimeOut {
  create?: string;
  update?: string;
  delete?: string;
  sourceRange?: SourceRange;
}

export class DocBlockView {
  kind: DocBlockType;
  astRef: MarkdownNode[];
  node: DocBlock;
  sourceRange?: SourceRange;
}

export class DocSemanticView {
  blocks: DocBlockView[];
  diagnostics: BuildDiagnostic[];
  // 便捷访问
  get frontMatter(): FrontMatter | undefined;
  get title(): Title | undefined;
  get argumentLists(): ArgumentList[];
}

```

7. 关于 DocSemanticView 的构建器（Builder）
当前代码中 extractArguments、extractAttributes 等函数直接散布在 resource-check-workflow.ts 中（一个 600+ 行的文件）。引入 DocSemanticView 后，建议：

创建一个独立的 DocSemanticViewBuilder 类/函数，负责 MarkdownNode -> DocSemanticView 的转换
它封装所有的 LinePattern 匹配、section 查找等逻辑
Workflow 只需调用 buildDocSemanticView(ast, source) 即可
这样 workflow 代码会大幅简化，测试也更方便。