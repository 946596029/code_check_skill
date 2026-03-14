import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { GoParser, TerraformSchemaExtractor } from "@code-check/core";
import type { ResourceSchema, SchemaField } from "@code-check/core";

const SIMPLE_SCHEMA = `
package huaweicloud

import (
    "github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"
)

func resourceApigChannelMember() *schema.Resource {
    return &schema.Resource{
        Schema: map[string]*schema.Schema{
            "channel_id": {
                Type:        schema.TypeString,
                Required:    true,
                ForceNew:    true,
                Description: "The ID of the channel.",
            },
            "member": {
                Type:     schema.TypeList,
                Required: true,
                Elem: &schema.Resource{
                    Schema: map[string]*schema.Schema{
                        "host": {
                            Type:        schema.TypeString,
                            Optional:    true,
                            Description: "The backend server address.",
                        },
                        "weight": {
                            Type:        schema.TypeInt,
                            Optional:    true,
                            Default:     1,
                            Description: "The weight of the backend.",
                        },
                    },
                },
                Description: "The list of channel members.",
            },
            "tags": {
                Type:     schema.TypeMap,
                Optional: true,
                Elem: &schema.Schema{
                    Type: schema.TypeString,
                },
                Description: "The tags of the channel member.",
            },
            "is_backup": {
                Type:        schema.TypeBool,
                Optional:    true,
                Computed:    true,
                Description: "Whether this member is a backup.",
            },
        },
    }
}
`;

const MULTI_FUNC_SOURCE = `
package huaweicloud

import "github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"

func resourceApigGroup() *schema.Resource {
    return &schema.Resource{
        Schema: map[string]*schema.Schema{
            "name": {
                Type:     schema.TypeString,
                Required: true,
            },
        },
    }
}

func helperFunction() string {
    return "not a resource"
}

func dataSourceApigApis() *schema.Resource {
    return &schema.Resource{
        Schema: map[string]*schema.Schema{
            "group_id": {
                Type:     schema.TypeString,
                Optional: true,
            },
        },
    }
}
`;

const RESOURCE_OPTIONS_SOURCE = `
package huaweicloud

import (
    "time"
    "github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"
)

func resourceWithOptions() *schema.Resource {
    return &schema.Resource{
        DeprecationMessage: "resource is deprecated",
        Importer: &schema.ResourceImporter{
            StateContext: schema.ImportStatePassthroughContext,
        },
        CustomizeDiff: forceNewOnFields("instance_id"),
        Timeouts: &schema.ResourceTimeout{
            Create: schema.DefaultTimeout(10 * time.Minute),
            Read: schema.DefaultTimeout(5 * time.Minute),
            Update: schema.DefaultTimeout(30 * time.Minute),
            Delete: schema.DefaultTimeout(15 * time.Minute),
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

describe("TerraformSchemaExtractor", () => {
    let parser: GoParser;
    let extractor: TerraformSchemaExtractor;

    beforeAll(async () => {
        parser = await GoParser.create();
        extractor = new TerraformSchemaExtractor(parser);
    });

    afterAll(() => {
        parser.dispose();
    });

    describe("basic extraction", () => {
        it("should extract resource name from function name", () => {
            const schemas = extractor.extract(SIMPLE_SCHEMA);
            expect(schemas).toHaveLength(1);
            expect(schemas[0].functionName).toBe("resourceApigChannelMember");
            expect(schemas[0].resourceName).toBe("apig_channel_member");
        });

        it("should extract all top-level fields", () => {
            const schemas = extractor.extract(SIMPLE_SCHEMA);
            const fields = schemas[0].fields;
            const names = fields.map((f) => f.name);
            expect(names).toEqual(["channel_id", "member", "tags", "is_backup"]);
        });
    });

    describe("field properties", () => {
        let fields: SchemaField[];

        beforeAll(() => {
            fields = extractor.extract(SIMPLE_SCHEMA)[0].fields;
        });

        it("should extract Type correctly", () => {
            expect(fields[0].type).toBe("TypeString");
            expect(fields[1].type).toBe("TypeList");
            expect(fields[2].type).toBe("TypeMap");
            expect(fields[3].type).toBe("TypeBool");
        });

        it("should extract Required / Optional", () => {
            const channelId = fields.find((f) => f.name === "channel_id")!;
            expect(channelId.required).toBe(true);
            expect(channelId.optional).toBe(false);

            const tags = fields.find((f) => f.name === "tags")!;
            expect(tags.required).toBe(false);
            expect(tags.optional).toBe(true);
        });

        it("should extract ForceNew", () => {
            const channelId = fields.find((f) => f.name === "channel_id")!;
            expect(channelId.forceNew).toBe(true);

            const tags = fields.find((f) => f.name === "tags")!;
            expect(tags.forceNew).toBe(false);
        });

        it("should extract Computed", () => {
            const isBackup = fields.find((f) => f.name === "is_backup")!;
            expect(isBackup.computed).toBe(true);
            expect(isBackup.optional).toBe(true);
        });

        it("should extract Description strings", () => {
            const channelId = fields.find((f) => f.name === "channel_id")!;
            expect(channelId.description).toBe("The ID of the channel.");

            const member = fields.find((f) => f.name === "member")!;
            expect(member.description).toBe("The list of channel members.");
        });
    });

    describe("Elem handling", () => {
        let fields: SchemaField[];

        beforeAll(() => {
            fields = extractor.extract(SIMPLE_SCHEMA)[0].fields;
        });

        it("should extract elemType for simple Elem (&schema.Schema)", () => {
            const tags = fields.find((f) => f.name === "tags")!;
            expect(tags.elemType).toBe("TypeString");
            expect(tags.subFields).toBeUndefined();
        });

        it("should extract subFields for nested Elem (&schema.Resource)", () => {
            const member = fields.find((f) => f.name === "member")!;
            expect(member.subFields).toBeDefined();
            expect(member.subFields).toHaveLength(2);

            const host = member.subFields!.find((f) => f.name === "host")!;
            expect(host.type).toBe("TypeString");
            expect(host.optional).toBe(true);
            expect(host.description).toBe("The backend server address.");

            const weight = member.subFields!.find((f) => f.name === "weight")!;
            expect(weight.type).toBe("TypeInt");
            expect(weight.defaultValue).toBe("1");
        });
    });

    describe("multi-function source", () => {
        it("should extract schemas from multiple resource functions", () => {
            const schemas = extractor.extract(MULTI_FUNC_SOURCE);
            expect(schemas).toHaveLength(2);
        });

        it("should skip functions without schema patterns", () => {
            const schemas = extractor.extract(MULTI_FUNC_SOURCE);
            const names = schemas.map((s) => s.functionName);
            expect(names).toContain("resourceApigGroup");
            expect(names).toContain("dataSourceApigApis");
            expect(names).not.toContain("helperFunction");
        });

        it("should infer resource names for data sources", () => {
            const schemas = extractor.extract(MULTI_FUNC_SOURCE);
            const ds = schemas.find((s) => s.functionName === "dataSourceApigApis")!;
            expect(ds.resourceName).toBe("apig_apis");
        });
    });

    describe("edge cases", () => {
        it("should return empty array for source without schemas", () => {
            const source = `
package main

func main() {
    fmt.Println("hello")
}
`;
            const schemas = extractor.extract(source);
            expect(schemas).toEqual([]);
        });

        it("should handle empty schema map", () => {
            const source = `
package test

import "github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"

func resourceEmpty() *schema.Resource {
    return &schema.Resource{
        Schema: map[string]*schema.Schema{},
    }
}
`;
            const schemas = extractor.extract(source);
            expect(schemas).toHaveLength(1);
            expect(schemas[0].fields).toEqual([]);
        });
    });

    describe("resource-level options", () => {
        it("should extract timeouts/importer/customizediff/deprecation", () => {
            const schemas = extractor.extract(RESOURCE_OPTIONS_SOURCE);
            expect(schemas).toHaveLength(1);
            const resource = schemas[0];
            const options = resource.resourceOptions;
            expect(options).toBeDefined();
            expect(options!.hasImporter).toBe(true);
            expect(options!.importerStateContext).toBe("schema.ImportStatePassthroughContext");
            expect(options!.customizeDiff).toBe('forceNewOnFields("instance_id")');
            expect(options!.deprecationMessage).toBe("resource is deprecated");
            expect(options!.timeouts).toEqual({
                create: "schema.DefaultTimeout(10 * time.Minute)",
                read: "schema.DefaultTimeout(5 * time.Minute)",
                update: "schema.DefaultTimeout(30 * time.Minute)",
                delete: "schema.DefaultTimeout(15 * time.Minute)",
            });
        });

        it("should extract importer/customizediff from real provider resource", () => {
            const schemas = extractor.extract(HUAWEICLOUD_CHANNEL_MEMBER_GROUP_SOURCE);
            const resource = schemas.find((s) => s.functionName === "ResourceChannelMemberGroup");
            expect(resource).toBeDefined();
            expect(resource!.resourceOptions?.hasImporter).toBe(true);
            expect(resource!.resourceOptions?.customizeDiff).toContain("config.FlexibleForceNew");
            expect(resource!.resourceOptions?.timeouts).toBeUndefined();
        });
    });
});
