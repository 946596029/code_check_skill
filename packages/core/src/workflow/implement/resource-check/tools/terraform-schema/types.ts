/**
 * Terraform schema field types matching the `schema.Type*` constants
 * in the Terraform Plugin SDK.
 */
export type SchemaFieldType =
    | "TypeString"
    | "TypeBool"
    | "TypeInt"
    | "TypeFloat"
    | "TypeList"
    | "TypeSet"
    | "TypeMap";

/**
 * A single field extracted from a Terraform resource schema definition.
 */
export interface SchemaField {
    /** Field name as declared in the schema map key (e.g. "instance_type") */
    name: string;

    /** Terraform SDK type (e.g. "TypeString") or raw string if unrecognized */
    type: SchemaFieldType | string;

    /** Whether the field has `Required: true` */
    required: boolean;

    /** Whether the field has `Optional: true` */
    optional: boolean;

    /** Whether the field has `Computed: true` */
    computed: boolean;

    /** Whether the field has `ForceNew: true` */
    forceNew: boolean;

    /** The Description string, empty if not specified */
    description: string;

    /** Default value as raw source text, undefined if not specified */
    defaultValue?: string;

    /** Element type for TypeList/TypeSet/TypeMap, undefined if not applicable */
    elemType?: SchemaFieldType | string;

    /** Nested sub-fields when Elem is a *schema.Resource (block-level nesting) */
    subFields?: SchemaField[];

    /** Whether the field is marked as internal via utils.SchemaDesc */
    internal?: boolean;
}

/**
 * Represents one Terraform resource/data-source schema extracted from
 * a Go source file.
 */
export interface ResourceSchema {
    /** Resource name inferred from the function name (e.g. "aws_instance") */
    resourceName: string;

    /** The original Go function name (e.g. "resourceAwsInstance") */
    functionName: string;

    /** All top-level schema fields */
    fields: SchemaField[];

    /**
     * Resource-level options extracted from `&schema.Resource{ ... }`,
     * such as Timeouts, Importer, and CustomizeDiff.
     */
    resourceOptions?: ResourceOptions;

    /**
     * Optional normalized semantic view derived from raw resource options.
     * This is best-effort and keeps conservative confidence signals.
     */
    resourceSemantics?: ResourceSemantics;
}

/**
 * Timeout expressions configured on `schema.ResourceTimeout`.
 * Values are kept as raw Go expressions for compatibility.
 */
export interface ResourceTimeouts {
    create?: string;
    read?: string;
    update?: string;
    delete?: string;
    default?: string;
}

/**
 * Resource-level capabilities/metadata extracted from a schema resource.
 */
export interface ResourceOptions {
    /** Whether an Importer block is configured. */
    hasImporter: boolean;

    /**
     * Importer state handler expression (for example
     * `schema.ImportStatePassthroughContext`), if present.
     */
    importerStateContext?: string;

    /** Raw expression assigned to CustomizeDiff. */
    customizeDiff?: string;

    /** Deprecation message from DeprecationMessage field. */
    deprecationMessage?: string;

    /** Parsed timeout expressions from Timeouts block. */
    timeouts?: ResourceTimeouts;
}

/** Confidence levels for conservative semantic derivation. */
export type SemanticConfidence = "high" | "none";

/** Normalized timeout semantic value with raw fallback and confidence. */
export interface TimeoutSemanticValue {
    raw: string;
    milliseconds?: number;
    confidence: SemanticConfidence;
}

/** Semantic projection of timeout settings. */
export interface ResourceTimeoutSemantics {
    create?: TimeoutSemanticValue;
    read?: TimeoutSemanticValue;
    update?: TimeoutSemanticValue;
    delete?: TimeoutSemanticValue;
    default?: TimeoutSemanticValue;
}

/** Semantic projection for force-new behavior inferred from CustomizeDiff. */
export interface ForceNewSemantics {
    fields: string[];
    confidence: SemanticConfidence;
    source: "customizeDiff";
}

/** Semantic projection for non-updatable behavior inferred from CustomizeDiff. */
export interface NonUpdatableSemantics {
    fields: string[];
    confidence: SemanticConfidence;
    source: "customizeDiff";
}

/** Semantic projection for import capability. */
export interface ImportableSemantics {
    value: boolean;
    confidence: "high";
}

/** Semantic projection for import ID format. */
export interface ImportIdSemantics {
    /** Ordered parts of the import ID (e.g. ["region", "id"]). */
    parts: string[];
    /** Separator used to join parts (typically "/"). */
    separator: string;
    confidence: SemanticConfidence;
}

/** Consolidated semantic view for a resource schema. */
export interface ResourceSemantics {
    importable?: ImportableSemantics;
    timeouts?: ResourceTimeoutSemantics;
    forceNew?: ForceNewSemantics;
    nonUpdatable?: NonUpdatableSemantics;
    importIdParts?: ImportIdSemantics;
}
