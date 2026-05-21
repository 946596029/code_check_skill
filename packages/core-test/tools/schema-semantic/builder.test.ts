import { describe, it, expect } from "vitest";
import { buildSchemaSemanticView } from "../../../core/src/workflow/implement/resource-check/tools/schema-semantic/builder";
import type { ResourceSchema, SchemaField } from "../../../core/src/workflow/implement/resource-check/tools/terraform-schema";

function createMockSchema(fields: SchemaField[]): ResourceSchema {
    return {
        resourceName: "test_resource",
        fields,
        resourceSemantics: {},
    };
}

describe("buildSchemaSemanticView - nested fields separation", () => {
    it("should separate computed subFields from argument subFields in nested object", () => {
        const schema = createMockSchema([
            {
                name: "configuration",
                type: "TypeList",
                optional: true,
                subFields: [
                    {
                        name: "name",
                        type: "TypeString",
                        required: true,
                    },
                    {
                        name: "created_at",
                        type: "TypeString",
                        computed: true,
                    },
                    {
                        name: "status",
                        type: "TypeString",
                        computed: true,
                    },
                ],
            },
        ]);

        const view = buildSchemaSemanticView(schema);

        expect(view.arguments.has("configuration")).toBe(true);
        expect(view.attributes.has("configuration")).toBe(true);

        const argConfig = view.arguments.get("configuration")!;
        const attrConfig = view.attributes.get("configuration")!;

        expect(argConfig.subFields).toHaveLength(1);
        expect(argConfig.subFields![0].name).toBe("name");
        expect(argConfig.subFields![0].required).toBe(true);

        expect(attrConfig.subFields).toHaveLength(2);
        const attrNames = attrConfig.subFields!.map((f) => f.name);
        expect(attrNames).toContain("created_at");
        expect(attrNames).toContain("status");
    });

    it("should handle multi-level nested computed fields", () => {
        const schema = createMockSchema([
            {
                name: "settings",
                type: "TypeList",
                optional: true,
                subFields: [
                    {
                        name: "basic",
                        type: "TypeList",
                        optional: true,
                        subFields: [
                            {
                                name: "enabled",
                                type: "TypeBool",
                                required: true,
                            },
                            {
                                name: "last_modified",
                                type: "TypeString",
                                computed: true,
                            },
                        ],
                    },
                ],
            },
        ]);

        const view = buildSchemaSemanticView(schema);

        const argSettings = view.arguments.get("settings")!;
        const attrSettings = view.attributes.get("settings")!;

        expect(argSettings.subFields).toHaveLength(1);
        expect(argSettings.subFields![0].name).toBe("basic");
        expect(argSettings.subFields![0].subFields).toHaveLength(1);
        expect(argSettings.subFields![0].subFields![0].name).toBe("enabled");

        expect(attrSettings.subFields).toHaveLength(1);
        expect(attrSettings.subFields![0].name).toBe("basic");
        expect(attrSettings.subFields![0].subFields).toHaveLength(1);
        expect(attrSettings.subFields![0].subFields![0].name).toBe("last_modified");
    });

    it("should handle TypeSet with nested computed fields", () => {
        const schema = createMockSchema([
            {
                name: "listeners",
                type: "TypeSet",
                optional: true,
                subFields: [
                    {
                        name: "port",
                        type: "TypeInt",
                        required: true,
                    },
                    {
                        name: "listener_id",
                        type: "TypeString",
                        computed: true,
                    },
                ],
            },
        ]);

        const view = buildSchemaSemanticView(schema);

        const argListeners = view.arguments.get("listeners")!;
        const attrListeners = view.attributes.get("listeners")!;

        expect(argListeners.subFields).toHaveLength(1);
        expect(argListeners.subFields![0].name).toBe("port");

        expect(attrListeners.subFields).toHaveLength(1);
        expect(attrListeners.subFields![0].name).toBe("listener_id");
    });

    it("should not add nested object to attributes when all subFields are arguments", () => {
        const schema = createMockSchema([
            {
                name: "config",
                type: "TypeList",
                optional: true,
                subFields: [
                    {
                        name: "name",
                        type: "TypeString",
                        required: true,
                    },
                    {
                        name: "value",
                        type: "TypeString",
                        optional: true,
                    },
                ],
            },
        ]);

        const view = buildSchemaSemanticView(schema);

        expect(view.arguments.has("config")).toBe(true);
        expect(view.attributes.has("config")).toBe(false);
    });

    it("should not add nested object to arguments when all subFields are computed", () => {
        const schema = createMockSchema([
            {
                name: "metadata",
                type: "TypeList",
                computed: true,
                subFields: [
                    {
                        name: "created_at",
                        type: "TypeString",
                        computed: true,
                    },
                    {
                        name: "updated_at",
                        type: "TypeString",
                        computed: true,
                    },
                ],
            },
        ]);

        const view = buildSchemaSemanticView(schema);

        expect(view.arguments.has("metadata")).toBe(false);
        expect(view.attributes.has("metadata")).toBe(true);
    });

    it("should handle mixed fields at top level", () => {
        const schema = createMockSchema([
            {
                name: "name",
                type: "TypeString",
                required: true,
            },
            {
                name: "description",
                type: "TypeString",
                optional: true,
            },
            {
                name: "id",
                type: "TypeString",
                computed: true,
            },
            {
                name: "status",
                type: "TypeString",
                computed: true,
            },
        ]);

        const view = buildSchemaSemanticView(schema);

        expect(view.arguments.size).toBe(2);
        expect(view.arguments.has("name")).toBe(true);
        expect(view.arguments.has("description")).toBe(true);

        expect(view.attributes.size).toBe(3);
        expect(view.attributes.has("id")).toBe(true);
        expect(view.attributes.has("status")).toBe(true);
    });

    it("should preserve parent field context in both arguments and attributes", () => {
        const schema = createMockSchema([
            {
                name: "configuration",
                type: "TypeList",
                optional: true,
                subFields: [
                    {
                        name: "name",
                        type: "TypeString",
                        required: true,
                    },
                    {
                        name: "created_at",
                        type: "TypeString",
                        computed: true,
                    },
                ],
            },
        ]);

        const view = buildSchemaSemanticView(schema);

        const argConfig = view.arguments.get("configuration")!;
        const attrConfig = view.attributes.get("configuration")!;

        expect(argConfig.name).toBe("configuration");
        expect(argConfig.optional).toBe(true);
        expect(argConfig.type).toBe("TypeList");

        expect(attrConfig.name).toBe("configuration");
        expect(attrConfig.optional).toBe(true);
        expect(attrConfig.type).toBe("TypeList");
    });

    it("should handle field with both optional and computed flags", () => {
        const schema = createMockSchema([
            {
                name: "tags",
                type: "TypeMap",
                optional: true,
                computed: true,
            },
        ]);

        const view = buildSchemaSemanticView(schema);

        expect(view.arguments.has("tags")).toBe(true);
        expect(view.attributes.has("tags")).toBe(true);
    });

    it("should handle nested field with both optional and computed flags", () => {
        const schema = createMockSchema([
            {
                name: "config",
                type: "TypeList",
                optional: true,
                subFields: [
                    {
                        name: "value",
                        type: "TypeString",
                        optional: true,
                        computed: true,
                    },
                ],
            },
        ]);

        const view = buildSchemaSemanticView(schema);

        const argConfig = view.arguments.get("config")!;
        const attrConfig = view.attributes.get("config")!;

        expect(argConfig.subFields).toHaveLength(1);
        expect(argConfig.subFields![0].name).toBe("value");
        expect(argConfig.subFields![0].optional).toBe(true);

        expect(attrConfig.subFields).toHaveLength(1);
        expect(attrConfig.subFields![0].name).toBe("value");
        expect(attrConfig.subFields![0].computed).toBe(true);
    });

    it("should skip internal fields in nested structures", () => {
        const schema = createMockSchema([
            {
                name: "config",
                type: "TypeList",
                optional: true,
                subFields: [
                    {
                        name: "name",
                        type: "TypeString",
                        required: true,
                    },
                    {
                        name: "internal_field",
                        type: "TypeString",
                        internal: true,
                    },
                    {
                        name: "created_at",
                        type: "TypeString",
                        computed: true,
                    },
                ],
            },
        ]);

        const view = buildSchemaSemanticView(schema);

        const argConfig = view.arguments.get("config")!;
        const attrConfig = view.attributes.get("config")!;

        expect(argConfig.subFields).toHaveLength(1);
        expect(argConfig.subFields![0].name).toBe("name");

        expect(attrConfig.subFields).toHaveLength(1);
        expect(attrConfig.subFields![0].name).toBe("created_at");
    });
});
