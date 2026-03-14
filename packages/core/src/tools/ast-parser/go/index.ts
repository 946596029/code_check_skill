export { GoParser } from "./parser";
export type { SyntaxNode, Tree, QueryMatch, QueryCapture } from "./parser";

export { TerraformSchemaExtractor } from "./schema-extractor";
export { TerraformSchemaSemanticNormalizer } from "./semantic-normalizer";

export type {
    ForceNewSemantics,
    ImportableSemantics,
    ResourceSemantics,
    SchemaField,
    SchemaFieldType,
    SemanticConfidence,
    ResourceOptions,
    ResourceSchema,
    ResourceTimeoutSemantics,
    ResourceTimeouts,
    TimeoutSemanticValue,
} from "./types";
