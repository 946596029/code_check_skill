import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import {
    GoParser,
    TerraformSchemaExtractor,
    TerraformSchemaSemanticNormalizer,
} from "@code-check/core";

const SEMANTIC_SOURCE = `
package huaweicloud

import (
    "time"
    "github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"
    "github.com/huaweicloud/terraform-provider-huaweicloud/huaweicloud/config"
)

var nonUpdatableParams = []string{"instance_id", "vpc_channel_id"}

func resourceWithSemantics() *schema.Resource {
    return &schema.Resource{
        Importer: &schema.ResourceImporter{
            StateContext: schema.ImportStatePassthroughContext,
        },
        CustomizeDiff: config.FlexibleForceNew(nonUpdatableParams),
        Timeouts: &schema.ResourceTimeout{
            Create: schema.DefaultTimeout(10 * time.Minute),
            Read: schema.DefaultTimeout(time.Second * 30),
            Update: unresolvedTimeoutExpr(),
        },
        Schema: map[string]*schema.Schema{
            "name": {
                Type:     schema.TypeString,
                Required: true,
            },
        },
    }
}
`;

const NON_UPDATABLE_SOURCE = `
package huaweicloud

import (
    "github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"
    "github.com/hashicorp/terraform-plugin-sdk/v2/helper/customdiff"
    "github.com/huaweicloud/terraform-provider-huaweicloud/huaweicloud/config"
)

func resourceWithNonUpdatable() *schema.Resource {
    return &schema.Resource{
        CustomizeDiff: customdiff.Sequence(
            config.FlexibleForceNew([]string{"region"}),
            config.FlexibleNonUpdatable([]string{"instance_id", "subnet_id"}),
        ),
        Schema: map[string]*schema.Schema{
            "region": {
                Type:     schema.TypeString,
                Optional: true,
            },
            "instance_id": {
                Type:     schema.TypeString,
                Required: true,
            },
            "subnet_id": {
                Type:     schema.TypeString,
                Required: true,
            },
        },
    }
}
`;

const PASSTHROUGH_IMPORT_SOURCE = `
package huaweicloud

import "github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"

func resourceWithPassthroughImport() *schema.Resource {
    return &schema.Resource{
        Importer: &schema.ResourceImporter{
            StateContext: schema.ImportStatePassthroughContext,
        },
        Schema: map[string]*schema.Schema{
            "name": {
                Type:     schema.TypeString,
                Required: true,
            },
        },
    }
}
`;

const CUSTOM_IMPORT_SOURCE = `
package huaweicloud

import (
    "context"
    "fmt"
    "strings"
    "github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"
)

func resourceWithCustomImport() *schema.Resource {
    return &schema.Resource{
        Importer: &schema.ResourceImporter{
            StateContext: resourceCustomImportState,
        },
        Schema: map[string]*schema.Schema{
            "instance_id": {
                Type:     schema.TypeString,
                Required: true,
            },
            "name": {
                Type:     schema.TypeString,
                Required: true,
            },
        },
    }
}

func resourceCustomImportState(_ context.Context, d *schema.ResourceData, _ interface{}) ([]*schema.ResourceData, error) {
    importedId := d.Id()
    parts := strings.SplitN(importedId, "/", 2)
    if len(parts) != 2 {
        return nil, fmt.Errorf("invalid format for import ID")
    }

    d.SetId(parts[1])
    d.Set("instance_id", parts[0])

    return []*schema.ResourceData{d}, nil
}
`;

const HUAWEICLOUD_CHANNEL_MEMBER_GROUP_SOURCE = readFileSync(
    new URL(
        "../../terraform_provider_example/resource_huaweicloud_apig_channel_member_group.go",
        import.meta.url
    ),
    "utf8"
);

describe("TerraformSchemaSemanticNormalizer", () => {
    let parser: GoParser;
    let extractor: TerraformSchemaExtractor;
    let normalizer: TerraformSchemaSemanticNormalizer;

    beforeAll(async () => {
        parser = await GoParser.create();
        extractor = new TerraformSchemaExtractor(parser);
        normalizer = new TerraformSchemaSemanticNormalizer();
    });

    afterAll(() => {
        parser.dispose();
    });

    it("should derive importable and forceNew fields from whitelisted pattern", () => {
        const schemas = extractor.extract(SEMANTIC_SOURCE);
        const normalized = normalizer.normalizeSchemas(SEMANTIC_SOURCE, schemas);
        expect(normalized).toHaveLength(1);
        const semantics = normalized[0].resourceSemantics;

        expect(semantics?.importable?.value).toBe(true);
        expect(semantics?.importable?.confidence).toBe("high");

        expect(semantics?.forceNew?.fields).toEqual(["instance_id", "vpc_channel_id"]);
        expect(semantics?.forceNew?.confidence).toBe("high");
        expect(semantics?.forceNew?.source).toBe("customizeDiff");
    });

    it("should conservatively resolve timeout values and fallback unknown expressions", () => {
        const schemas = extractor.extract(SEMANTIC_SOURCE);
        const normalized = normalizer.normalizeSchemas(SEMANTIC_SOURCE, schemas);
        const timeouts = normalized[0].resourceSemantics?.timeouts;

        expect(timeouts?.create?.milliseconds).toBe(600000);
        expect(timeouts?.create?.confidence).toBe("high");
        expect(timeouts?.read?.milliseconds).toBe(30000);
        expect(timeouts?.read?.confidence).toBe("high");

        expect(timeouts?.update?.milliseconds).toBeUndefined();
        expect(timeouts?.update?.confidence).toBe("none");
        expect(timeouts?.update?.raw).toBe("unresolvedTimeoutExpr()");
    });

    it("should derive forceNew fields from real provider variable reference", () => {
        const schemas = extractor.extract(HUAWEICLOUD_CHANNEL_MEMBER_GROUP_SOURCE);
        const target = schemas.find((s) => s.functionName === "ResourceChannelMemberGroup");
        expect(target).toBeDefined();

        const [normalized] = normalizer.normalizeSchemas(
            HUAWEICLOUD_CHANNEL_MEMBER_GROUP_SOURCE,
            [target!]
        );
        expect(normalized.resourceSemantics?.forceNew?.fields).toEqual([
            "instance_id",
            "vpc_channel_id",
        ]);
        expect(normalized.resourceSemantics?.forceNew?.confidence).toBe("high");
    });

    it("should avoid forceNew inference for non-whitelisted customizeDiff patterns", () => {
        const source = `
package test

import "github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"

func resourceUnknownDiff() *schema.Resource {
    return &schema.Resource{
        CustomizeDiff: someCustomDiffChain("name"),
        Schema: map[string]*schema.Schema{
            "name": { Type: schema.TypeString, Optional: true },
        },
    }
}
`;
        const schemas = extractor.extract(source);
        const [normalized] = normalizer.normalizeSchemas(source, schemas);
        expect(normalized.resourceSemantics?.forceNew).toBeUndefined();
    });

    describe("NonUpdatable derivation", () => {
        it("should derive nonUpdatable fields from FlexibleNonUpdatable in customizeDiff.Sequence", () => {
            const schemas = extractor.extract(NON_UPDATABLE_SOURCE);
            const [normalized] = normalizer.normalizeSchemas(NON_UPDATABLE_SOURCE, schemas);

            expect(normalized.resourceSemantics?.nonUpdatable?.fields).toEqual([
                "instance_id",
                "subnet_id",
            ]);
            expect(normalized.resourceSemantics?.nonUpdatable?.confidence).toBe("high");
            expect(normalized.resourceSemantics?.nonUpdatable?.source).toBe("customizeDiff");
        });

        it("should also derive forceNew when both FlexibleForceNew and FlexibleNonUpdatable are present", () => {
            const schemas = extractor.extract(NON_UPDATABLE_SOURCE);
            const [normalized] = normalizer.normalizeSchemas(NON_UPDATABLE_SOURCE, schemas);

            expect(normalized.resourceSemantics?.forceNew?.fields).toEqual(["region"]);
        });

        it("should not derive nonUpdatable when FlexibleNonUpdatable is absent", () => {
            const schemas = extractor.extract(SEMANTIC_SOURCE);
            const [normalized] = normalizer.normalizeSchemas(SEMANTIC_SOURCE, schemas);

            expect(normalized.resourceSemantics?.nonUpdatable).toBeUndefined();
        });

        it("should derive nonUpdatable from real provider resource with variable reference", () => {
            const schemas = extractor.extract(HUAWEICLOUD_CHANNEL_MEMBER_GROUP_SOURCE);
            const target = schemas.find((s) => s.functionName === "ResourceChannelMemberGroup")!;
            const [normalized] = normalizer.normalizeSchemas(
                HUAWEICLOUD_CHANNEL_MEMBER_GROUP_SOURCE,
                [target],
            );

            expect(normalized.resourceSemantics?.forceNew?.fields).toEqual([
                "instance_id",
                "vpc_channel_id",
            ]);
            // This resource uses FlexibleForceNew only, so nonUpdatable should be undefined
            expect(normalized.resourceSemantics?.nonUpdatable).toBeUndefined();
        });
    });

    describe("Import ID derivation", () => {
        it("should return ['id'] for schema.ImportStatePassthroughContext", () => {
            const schemas = extractor.extract(PASSTHROUGH_IMPORT_SOURCE);
            const [normalized] = normalizer.normalizeSchemas(PASSTHROUGH_IMPORT_SOURCE, schemas);

            expect(normalized.resourceSemantics?.importIdParts).toEqual({
                parts: ["id"],
                separator: "/",
                confidence: "high",
            });
        });

        it("should parse custom import function with strings.SplitN and d.Set", () => {
            const schemas = extractor.extract(CUSTOM_IMPORT_SOURCE);
            const [normalized] = normalizer.normalizeSchemas(CUSTOM_IMPORT_SOURCE, schemas);

            expect(normalized.resourceSemantics?.importIdParts).toBeDefined();
            expect(normalized.resourceSemantics?.importIdParts?.parts).toEqual([
                "instance_id",
                "id",
            ]);
            expect(normalized.resourceSemantics?.importIdParts?.separator).toBe("/");
            expect(normalized.resourceSemantics?.importIdParts?.confidence).toBe("high");
        });

        it("should parse import ID from real provider resource with 3-part split", () => {
            const schemas = extractor.extract(HUAWEICLOUD_CHANNEL_MEMBER_GROUP_SOURCE);
            const target = schemas.find((s) => s.functionName === "ResourceChannelMemberGroup")!;
            const [normalized] = normalizer.normalizeSchemas(
                HUAWEICLOUD_CHANNEL_MEMBER_GROUP_SOURCE,
                [target],
            );

            expect(normalized.resourceSemantics?.importIdParts).toBeDefined();
            expect(normalized.resourceSemantics?.importIdParts?.parts).toEqual([
                "instance_id",
                "vpc_channel_id",
                "id",
            ]);
            expect(normalized.resourceSemantics?.importIdParts?.separator).toBe("/");
        });

        it("should not derive importIdParts when there is no importer", () => {
            const schemas = extractor.extract(NON_UPDATABLE_SOURCE);
            const [normalized] = normalizer.normalizeSchemas(NON_UPDATABLE_SOURCE, schemas);

            expect(normalized.resourceSemantics?.importIdParts).toBeUndefined();
        });

        it("should return passthrough for schema.ImportStatePassthrough (legacy alias)", () => {
            const source = `
package test

import "github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"

func resourceLegacyImport() *schema.Resource {
    return &schema.Resource{
        Importer: &schema.ResourceImporter{
            StateContext: schema.ImportStatePassthrough,
        },
        Schema: map[string]*schema.Schema{
            "name": { Type: schema.TypeString, Required: true },
        },
    }
}
`;
            const schemas = extractor.extract(source);
            const [normalized] = normalizer.normalizeSchemas(source, schemas);
            expect(normalized.resourceSemantics?.importIdParts).toEqual({
                parts: ["id"],
                separator: "/",
                confidence: "high",
            });
        });
    });
});
