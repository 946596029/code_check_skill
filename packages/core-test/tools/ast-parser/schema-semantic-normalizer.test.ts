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
});
