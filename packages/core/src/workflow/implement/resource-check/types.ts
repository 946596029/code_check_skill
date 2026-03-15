import path from "path";
import type { SchemaFieldType } from "../../../tools/ast-parser/go/types";

export type ResourceType = "resource" | "data-source";

/**
 * A single argument extracted from the "Argument Reference" Markdown section.
 * Mirrors Go-side SchemaField for cross-source comparison.
 */
export interface DocArgument {
    name: string;
    modifier: string;
    type: string;
    tags: string[];
    descriptionText: string;
    startLine: number;
}

/**
 * A single attribute extracted from the "Attributes Reference" Markdown section.
 */
export interface DocAttribute {
    name: string;
    descriptionText: string;
    startLine: number;
}

/**
 * Structured representation of a Terraform resource Markdown document,
 * extracted during the extract-doc-structure stage.
 */
export interface DocStructure {
    frontmatter: Record<string, unknown> | null;
    resourceName: string | null;
    expectedDescription: string | null;
    arguments: DocArgument[];
    attributes: DocAttribute[];
}

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

export interface ResourceCheckInput {
    providerRoot: string;
    serviceName: string;
    resourceName: string;
    resourceType: ResourceType;
}

export interface ResolvedResourcePaths {
    implementGoPath: string;
    docMdPath: string;
    testGoPath: string;
}

/**
 * Infer the provider short name from the providerRoot directory name.
 * e.g. "terraform-provider-huaweicloud" -> "huaweicloud"
 */
function inferProviderName(providerRoot: string): string {
    const dirName = path.basename(path.resolve(providerRoot));
    const prefix = "terraform-provider-";
    if (dirName.startsWith(prefix)) {
        return dirName.slice(prefix.length);
    }
    return dirName;
}

/**
 * Strip the provider prefix from the resource name to get the short doc name.
 * e.g. provider="huaweicloud", resourceName="apig_channel_member"
 *   -> already has no provider prefix, returns "apig_channel_member"
 * e.g. provider="huaweicloud", resourceName="huaweicloud_apig_channel_member"
 *   -> strips prefix, returns "apig_channel_member"
 */
function stripProviderPrefix(provider: string, resourceName: string): string {
    const prefix = `${provider}_`;
    if (resourceName.startsWith(prefix)) {
        return resourceName.slice(prefix.length);
    }
    return resourceName;
}

function buildFullResourceName(provider: string, resourceName: string): string {
    const prefix = `${provider}_`;
    if (resourceName.startsWith(prefix)) {
        return resourceName;
    }
    return `${prefix}${resourceName}`;
}

export function parseResourceCheckInput(jsonCode: string): ResourceCheckInput {
    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonCode);
    } catch {
        throw new Error(
            "resource-check expects JSON-encoded ResourceCheckInput as code input"
        );
    }

    const obj = parsed as Record<string, unknown>;
    if (
        typeof obj.providerRoot !== "string" ||
        typeof obj.serviceName !== "string" ||
        typeof obj.resourceName !== "string" ||
        (obj.resourceType !== "resource" && obj.resourceType !== "data-source")
    ) {
        throw new Error(
            "ResourceCheckInput requires: providerRoot (string), serviceName (string), " +
            "resourceName (string), resourceType ('resource' | 'data-source')"
        );
    }

    return {
        providerRoot: obj.providerRoot as string,
        serviceName: obj.serviceName as string,
        resourceName: obj.resourceName as string,
        resourceType: obj.resourceType as ResourceType,
    };
}

export function resolveResourcePaths(input: ResourceCheckInput): ResolvedResourcePaths {
    const root = path.resolve(input.providerRoot);
    const provider = inferProviderName(root);
    const fullName = buildFullResourceName(provider, input.resourceName);
    const shortName = stripProviderPrefix(provider, input.resourceName);

    const filePrefix = input.resourceType === "resource"
        ? `resource_${fullName}`
        : `data_source_${fullName}`;

    const docDir = input.resourceType === "resource"
        ? "resources"
        : "data-sources";

    const implementGoPath = path.join(
        root, provider, "services", input.serviceName, `${filePrefix}.go`
    );

    const testGoPath = path.join(
        root, provider, "services", "acceptance", input.serviceName, `${filePrefix}_test.go`
    );

    const docMdPath = path.join(root, "docs", docDir, `${shortName}.md`);

    return { implementGoPath, docMdPath, testGoPath };
}
