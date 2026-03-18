import type { SchemaFieldType } from "../terraform-schema/types";

/**
 * A schema field enriched with document-oriented semantic tags.
 * Used by doc-semantic rules to compare against DocArgument/DocAttribute.
 */
export interface SemanticField {
    name: string;
    type: SchemaFieldType | string;
    required: boolean;
    optional: boolean;
    computed: boolean;
    forceNew: boolean;
    nonUpdatable: boolean;
    description: string;
    subFields?: SemanticField[];
}

/**
 * Simplified timeout view with millisecond values.
 * Only includes entries where the normalizer had high confidence.
 */
export interface TimeoutView {
    create?: number;
    read?: number;
    update?: number;
    delete?: number;
}

/**
 * Import capability and ID format for a resource.
 */
export interface ImportView {
    importable: boolean;
    stateFunc?: string;
    idParts?: string[];
}

/**
 * Schema-derived semantic view consumed by document validation rules.
 * Built from raw ResourceSchema + ResourceSemantics during the
 * check-markdown-semantic stage.
 */
export interface SchemaSemanticView {
    resourceName: string;
    arguments: Map<string, SemanticField>;
    attributes: Map<string, SemanticField>;
    timeouts: TimeoutView | null;
    importInfo: ImportView;
}
