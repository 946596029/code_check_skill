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
}
