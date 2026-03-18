import fs from "fs";
import path from "path";

export type ResourceType = "resource" | "data-source";

export type {
    SemanticField,
    TimeoutView,
    ImportView,
    SchemaSemanticView,
} from "./tools/schema-semantic";
export type {
    Argument,
    Attribute,
    ArgumentList,
    AttributeList,
} from "./tools/doc-semantic";
export { DocSemanticView } from "./tools/doc-semantic";

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
    const root = path.resolve(providerRoot);
    const dirName = path.basename(root);
    const prefix = "terraform-provider-";
    if (dirName.startsWith(prefix)) {
        return dirName.slice(prefix.length);
    }
    // Prefer structural detection for fixtures/non-standard roots:
    // <root>/<provider>/services/** or <root>/services/**.
    const providerDirs = detectProviderDirs(root);
    if (providerDirs.length === 1) {
        return providerDirs[0];
    }
    return dirName;
}

function detectProviderDirs(root: string): string[] {
    if (!fs.existsSync(root)) return [];

    if (fs.existsSync(path.join(root, "services"))) {
        return [path.basename(root)];
    }

    const entries = fs.readdirSync(root, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => fs.existsSync(path.join(root, name, "services")));
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
    const providerBase = fs.existsSync(path.join(root, "services"))
        ? root
        : path.join(root, provider);

    const filePrefix = input.resourceType === "resource"
        ? `resource_${fullName}`
        : `data_source_${fullName}`;

    const docDir = input.resourceType === "resource"
        ? "resources"
        : "data-sources";

    const implementGoPath = path.join(
        providerBase, "services", input.serviceName, `${filePrefix}.go`
    );

    const testGoPath = path.join(
        providerBase, "services", "acceptance", input.serviceName, `${filePrefix}_test.go`
    );

    const docMdPath = path.join(root, "docs", docDir, `${shortName}.md`);

    return { implementGoPath, docMdPath, testGoPath };
}
