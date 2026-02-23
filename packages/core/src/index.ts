// ── Facade (high-level API) ──
export { CodeChecker } from "./facade";
export type {
    CodeCheckerConfig,
    LlmConfig,
    CheckOptions,
    CheckReport,
    WorkflowInfo,
} from "./facade";

// ── Rules ──
export { Rule, RuleCheckResult } from "./workflow/types/rule/rule";
export type { RuleMeta, MessageTemplate } from "./workflow/types/rule/rule";


// ── Workflow ──
export { Workflow, LifeCycle } from "./workflow/workflow";
export type { RuleResult, OnRuleComplete } from "./workflow/workflow";
export { ResourceDocWorkflow } from "./workflow/implement/resource-doc/resource-doc-workflow";
export {
    FrontmatterExistsRule,
    H1StructureRule,
    ExampleUsageStructureRule,
    ArgumentDescriptionFormatRule,
    RESOURCE_DOC_RULES,
} from "./workflow/implement/resource-doc/rules";

// ── Description Format Spec ──
export {
    getFormatSpec,
    DESCRIPTION_INTENTS,
} from "./workflow/implement/resource-doc/rules/argument-reference-structure";
export type {
    DescriptionIntent,
    DescriptionFormatSpec,
    FormatValidationResult,
} from "./workflow/implement/resource-doc/rules/argument-reference-structure";
export { DescriptionIntentClassifier } from "./workflow/implement/resource-doc/rules/argument-reference-structure";

// ── LLM ──
export { createQwenModel } from "./llm/model";

// ── Structured LLM Calling ──
export { StructuredCaller, extractJson } from "./tools/llm";
export type {
    StructuredCallerOptions,
    StructuredCallResult,
    StructuredCallSuccess,
    StructuredCallFailure,
} from "./tools/llm";

// ── Context ──
export { Context } from "./workflow/context/context";

// ── AST Parsers ──
export { MarkdownParser } from "./tools/ast-parser/markdown";
export { GoParser, TerraformSchemaExtractor } from "./tools/ast-parser/go";
export type {
    SchemaField,
    SchemaFieldType,
    ResourceSchema,
} from "./tools/ast-parser/go";

// ── Text Search ──
export { RegexGrep } from "./tools/text-grep";
export type { RegexMatch, RegexGrepOptions } from "./tools/text-grep";


// ── Node Pattern ──
export { NodePattern } from "./tools/node-pattern";
export type {
    NodeMatchResult,
    NodePatternMatch,
    NodeMatchFailure,
} from "./tools/node-pattern";
export type {
    NodeMatcher,
    GroupMatcher,
    NodeMatchElement,
    Quantifier,
} from "./tools/node-pattern";
export { isGroupMatcher } from "./tools/node-pattern";
export {
    nodeType,
    heading,
    codeBlock,
    list,
    nodeWhere,
    anyNode,
    optionalNode,
    zeroOrMore,
    oneOrMore,
    tagged,
    group,
    optionalGroup,
    zeroOrMoreGroup,
    oneOrMoreGroup,
} from "./tools/node-pattern";

// ── Line Pattern ──
export { LinePattern } from "./tools/line-pattern";
export type {
    LineMatchResult,
    LineMatchSuccess,
    LineMatchFailure,
} from "./tools/line-pattern";
export type { Segment, SegmentMatchResult } from "./tools/line-pattern";
export { matchSegment } from "./tools/line-pattern";
export {
    literal,
    backticked,
    parenthesized,
    csvParenthesized,
    spaces,
    keyword,
    rest,
    optional,
} from "./tools/line-pattern";
export type { CsvSlot } from "./tools/line-pattern";
export type {
    MarkdownNode,
    MarkdownNodeType,
    ListType,
    SourcePosition,
    SourceRange,
    WalkEvent,
    NodeVisitor,
    TypedVisitors,
    ParserOptions,
    CommonMarkNode,
} from "./tools/ast-parser/markdown";
