import { describe, it, expect } from "vitest";
import { MarkdownParser } from "../../../core/src/tools/ast-parser/markdown";
import {
    buildArgumentList,
    buildAttributeList,
    buildDocSemanticView,
    type BuildDiagnostic,
} from "../../../core/src/workflow/implement/resource-check/tools/doc-semantic";

const parser = new MarkdownParser();

function parseArgList(md: string) {
    const ast = parser.parse(md);
    const diagnostics: BuildDiagnostic[] = [];
    const block = buildArgumentList(parser, ast, md, diagnostics);
    return { block, diagnostics };
}

function parseAttrList(md: string, sectionTitle: string = "Attributes Reference") {
    const mdWithSection = md.replace("## SECTION_TITLE", `## ${sectionTitle}`);
    const ast = parser.parse(mdWithSection);
    const diagnostics: BuildDiagnostic[] = [];
    const block = buildAttributeList(parser, ast, mdWithSection, diagnostics);
    return { block, diagnostics };
}

describe("doc-semantic builder - Arguments", () => {
    describe("1. No nested arguments", () => {
        it("should parse flat argument list without nesting", () => {
            const md = [
                "## Argument Reference",
                "",
                "* `name` - (Required, String) Specifies the name of the resource.",
                "* `region` - (Optional, String) Specifies the region.",
                "* `description` - (Optional, String) Specifies the description.",
            ].join("\n");

            const { block, diagnostics } = parseArgList(md);

            expect(block).not.toBeNull();
            expect(diagnostics).toHaveLength(0);
            const args = block!.node.arguments;
            expect(args).toHaveLength(3);
            expect(args[0].name).toBe("name");
            expect(args[0].tags).toEqual(["Required", "String"]);
            expect(args[0].description).toBe("Specifies the name of the resource.");
            expect(args[0].children).toEqual([]);
            expect(args[1].name).toBe("region");
            expect(args[2].name).toBe("description");
        });

        it("should return null when Argument Reference section is missing", () => {
            const md = "## Some Other Section\n\nSome content.";
            const { block } = parseArgList(md);
            expect(block).toBeNull();
        });
    });

    describe("2.1 One level of nested arguments", () => {
        it("should parse one-level nested arguments via 'block supports' declaration", () => {
            const md = [
                "## Argument Reference",
                "",
                "* `name` - (Required, String) Specifies the name.",
                "* `steps` - (Optional, List) Specifies the steps.",
                "  The [steps](#resource_steps) structure is documented below.",
                "",
                "The `steps` block supports:",
                "",
                "* `name` - (Required, String) Step name.",
                "* `type` - (Optional, String) Step type.",
            ].join("\n");

            const { block, diagnostics } = parseArgList(md);

            expect(block).not.toBeNull();
            expect(diagnostics).toHaveLength(0);
            const args = block!.node.arguments;
            expect(args).toHaveLength(2);
            expect(args[0].name).toBe("name");
            expect(args[0].children).toEqual([]);

            const stepsArg = args[1];
            expect(stepsArg.name).toBe("steps");
            expect(stepsArg.children).toHaveLength(2);
            expect(stepsArg.children[0].name).toBe("name");
            expect(stepsArg.children[0].tags).toEqual(["Required", "String"]);
            expect(stepsArg.children[1].name).toBe("type");
        });

        it("should parse nested arguments with anchor ID from HTML", () => {
            const md = [
                "## Argument Reference",
                "",
                "* `name` - (Required, String) Specifies the name.",
                "* `conditions` - (Optional, List) Specifies the conditions.",
                "  The [conditions](#modelartsv2_workflow_step_conditions) structure is documented below.",
                "",
                '<a name="modelartsv2_workflow_step_conditions"></a>',
                "The `conditions` block supports:",
                "",
                "* `type` - (Required, String) Condition type.",
                "* `value` - (Optional, String) Condition value.",
            ].join("\n");

            const { block, diagnostics } = parseArgList(md);

            expect(block).not.toBeNull();
            expect(diagnostics).toHaveLength(0);
            const args = block!.node.arguments;
            expect(args).toHaveLength(2);

            const conditionsArg = args[1];
            expect(conditionsArg.name).toBe("conditions");
            expect(conditionsArg.anchorId).toBe("modelartsv2_workflow_step_conditions");
            expect(conditionsArg.children).toHaveLength(2);
            expect(conditionsArg.children[0].name).toBe("type");
            expect(conditionsArg.children[1].name).toBe("value");
        });
    });

    describe("2.2 Multi-level nested arguments (more than two levels)", () => {
        it("should parse three-level nested arguments", () => {
            const md = [
                "## Argument Reference",
                "",
                "* `name` - (Required, String) Specifies the name.",
                "* `workflow` - (Optional, List) Specifies the workflow.",
                "  The [workflow](#resource_workflow) structure is documented below.",
                "",
                '<a name="resource_workflow"></a>',
                "The `workflow` block supports:",
                "",
                "* `enabled` - (Required, Bool) Whether enabled.",
                "* `steps` - (Optional, List) Specifies the steps.",
                "  The [steps](#resource_workflow_steps) structure is documented below.",
                "",
                '<a name="resource_workflow_steps"></a>',
                "The `steps` block supports:",
                "",
                "* `name` - (Required, String) Step name.",
                "* `config` - (Optional, List) Specifies the config.",
                "  The [config](#resource_workflow_steps_config) structure is documented below.",
                "",
                '<a name="resource_workflow_steps_config"></a>',
                "The `config` block supports:",
                "",
                "* `key` - (Required, String) Config key.",
                "* `value` - (Optional, String) Config value.",
            ].join("\n");

            const { block, diagnostics } = parseArgList(md);

            expect(block).not.toBeNull();
            expect(diagnostics).toHaveLength(0);
            const args = block!.node.arguments;
            expect(args).toHaveLength(2);

            const workflowArg = args[1];
            expect(workflowArg.name).toBe("workflow");
            expect(workflowArg.anchorId).toBe("resource_workflow");
            expect(workflowArg.children).toHaveLength(2);

            const stepsArg = workflowArg.children[1];
            expect(stepsArg.name).toBe("steps");
            expect(stepsArg.anchorId).toBe("resource_workflow_steps");
            expect(stepsArg.children).toHaveLength(2);

            const configArg = stepsArg.children[1];
            expect(configArg.name).toBe("config");
            expect(configArg.anchorId).toBe("resource_workflow_steps_config");
            expect(configArg.children).toHaveLength(2);
            expect(configArg.children[0].name).toBe("key");
            expect(configArg.children[1].name).toBe("value");
        });
    });

    describe("2.3 Two parent arguments referencing the same child argument object", () => {
        it("should handle two parent arguments referencing the same nested block anchor", () => {
            const md = [
                "## Argument Reference",
                "",
                "* `create_steps` - (Optional, List) Specifies the create steps.",
                "  The [create_steps](#shared_steps_block) structure is documented below.",
                "* `delete_steps` - (Optional, List) Specifies the delete steps.",
                "  The [delete_steps](#shared_steps_block) structure is documented below.",
                "",
                '<a name="shared_steps_block"></a>',
                "The `shared_steps_block` block supports:",
                "",
                "* `name` - (Required, String) Step name.",
                "* `type` - (Optional, String) Step type.",
            ].join("\n");

            const { block, diagnostics } = parseArgList(md);

            expect(block).not.toBeNull();
            expect(diagnostics).toHaveLength(0);
            const args = block!.node.arguments;
            expect(args).toHaveLength(2);

            expect(args[0].name).toBe("create_steps");
            expect(args[0].anchorId).toBe("shared_steps_block");
            expect(args[0].children).toHaveLength(2);
            expect(args[0].children[0].name).toBe("name");
            expect(args[0].children[1].name).toBe("type");

            expect(args[1].name).toBe("delete_steps");
            expect(args[1].anchorId).toBe("shared_steps_block");
            expect(args[1].children).toHaveLength(2);
            expect(args[1].children[0].name).toBe("name");
            expect(args[1].children[1].name).toBe("type");
        });
    });
});

describe("doc-semantic builder - Attributes", () => {
    describe("3. No nested attributes", () => {
        it("should parse flat attribute list without nesting", () => {
            const md = [
                "## Attributes Reference",
                "",
                "* `id` - The resource ID.",
                "* `name` - The resource name.",
                "* `status` - The resource status.",
            ].join("\n");

            const { block, diagnostics } = parseAttrList(md);

            expect(block).not.toBeNull();
            expect(diagnostics).toHaveLength(0);
            const attrs = block!.node.attributes;
            expect(attrs).toHaveLength(3);
            expect(attrs[0].name).toBe("id");
            expect(attrs[0].description).toBe("The resource ID.");
            expect(attrs[0].children).toEqual([]);
            expect(attrs[1].name).toBe("name");
            expect(attrs[2].name).toBe("status");
        });

        it("should also work with 'Attribute Reference' section title", () => {
            const md = [
                "## Attribute Reference",
                "",
                "* `id` - The resource ID.",
            ].join("\n");

            const { block } = parseAttrList(md, "Attribute Reference");
            expect(block).not.toBeNull();
            expect(block!.node.attributes).toHaveLength(1);
        });
    });

    describe("4.1 One level of nested attributes", () => {
        it("should parse one-level nested attributes via 'block supports' declaration", () => {
            const md = [
                "## Attributes Reference",
                "",
                "* `id` - The resource ID.",
                "* `configuration` - The configuration.",
                "  The [configuration](#attr_configuration) structure is documented below.",
                "",
                '<a name="attr_configuration"></a>',
                "The `configuration` block supports:",
                "",
                "* `name` - The configuration name.",
                "* `value` - The configuration value.",
            ].join("\n");

            const { block, diagnostics } = parseAttrList(md);

            expect(block).not.toBeNull();
            expect(diagnostics).toHaveLength(0);
            const attrs = block!.node.attributes;
            expect(attrs).toHaveLength(2);

            const configAttr = attrs[1];
            expect(configAttr.name).toBe("configuration");
            expect(configAttr.anchorId).toBe("attr_configuration");
            expect(configAttr.children).toHaveLength(2);
            expect(configAttr.children[0].name).toBe("name");
            expect(configAttr.children[1].name).toBe("value");
        });
    });

    describe("4.2 Multi-level nested attributes (more than two levels)", () => {
        it("should parse three-level nested attributes", () => {
            const md = [
                "## Attributes Reference",
                "",
                "* `id` - The resource ID.",
                "* `metadata` - The metadata.",
                "  The [metadata](#attr_metadata) structure is documented below.",
                "",
                '<a name="attr_metadata"></a>',
                "The `metadata` block supports:",
                "",
                "* `created_at` - The creation time.",
                "* `labels` - The labels.",
                "  The [labels](#attr_metadata_labels) structure is documented below.",
                "",
                '<a name="attr_metadata_labels"></a>',
                "The `labels` block supports:",
                "",
                "* `key` - The label key.",
                "* `value` - The label value.",
            ].join("\n");

            const { block, diagnostics } = parseAttrList(md);

            expect(block).not.toBeNull();
            expect(diagnostics).toHaveLength(0);
            const attrs = block!.node.attributes;
            expect(attrs).toHaveLength(2);

            const metadataAttr = attrs[1];
            expect(metadataAttr.name).toBe("metadata");
            expect(metadataAttr.anchorId).toBe("attr_metadata");
            expect(metadataAttr.children).toHaveLength(2);

            const labelsAttr = metadataAttr.children[1];
            expect(labelsAttr.name).toBe("labels");
            expect(labelsAttr.anchorId).toBe("attr_metadata_labels");
            expect(labelsAttr.children).toHaveLength(2);
            expect(labelsAttr.children[0].name).toBe("key");
            expect(labelsAttr.children[1].name).toBe("value");
        });
    });

    describe("4.3 Two parent attributes referencing the same child attribute object", () => {
        it("should handle two parent attributes referencing the same nested block anchor", () => {
            const md = [
                "## Attributes Reference",
                "",
                "* `source_config` - The source configuration.",
                "  The [source_config](#shared_config_block) structure is documented below.",
                "* `target_config` - The target configuration.",
                "  The [target_config](#shared_config_block) structure is documented below.",
                "",
                '<a name="shared_config_block"></a>',
                "The `shared_config_block` block supports:",
                "",
                "* `endpoint` - The endpoint.",
                "* `protocol` - The protocol.",
            ].join("\n");

            const { block, diagnostics } = parseAttrList(md);

            expect(block).not.toBeNull();
            expect(diagnostics).toHaveLength(0);
            const attrs = block!.node.attributes;
            expect(attrs).toHaveLength(2);

            expect(attrs[0].name).toBe("source_config");
            expect(attrs[0].anchorId).toBe("shared_config_block");
            expect(attrs[0].children).toHaveLength(2);
            expect(attrs[0].children[0].name).toBe("endpoint");
            expect(attrs[0].children[1].name).toBe("protocol");

            expect(attrs[1].name).toBe("target_config");
            expect(attrs[1].anchorId).toBe("shared_config_block");
            expect(attrs[1].children).toHaveLength(2);
            expect(attrs[1].children[0].name).toBe("endpoint");
            expect(attrs[1].children[1].name).toBe("protocol");
        });
    });
});

describe("doc-semantic builder - Arguments with Attributes in schema context", () => {
    describe("5.1 Argument object containing attributes with object value", () => {
        it("should parse same parameter name in both Argument and Attribute sections with nested object attributes", () => {
            const md = [
                "---",
                "subcategory: Compute",
                "page_title: Test Resource",
                "---",
                "",
                "# test_resource",
                "",
                "Test resource description.",
                "",
                "## Argument Reference",
                "",
                "* `name` - (Required, String) Specifies the name.",
                "* `configuration` - (Optional, List) Specifies the configuration.",
                "  The [configuration](#resource_configuration) structure is documented below.",
                "",
                '<a name="resource_configuration"></a>',
                "The `configuration` block supports:",
                "",
                "* `type` - (Required, String) The type of configuration.",
                "* `enabled` - (Optional, Bool) Whether to enable.",
                "",
                "## Attributes Reference",
                "",
                "* `id` - The resource ID.",
                "* `configuration` - The configuration.",
                "  The [configuration](#attr_configuration) structure is documented below.",
                "",
                '<a name="attr_configuration"></a>',
                "The `configuration` block supports:",
                "",
                "* `status` - The configuration status.",
                "* `created_at` - The creation time.",
                "* `details` - The details.",
                "  The [details](#attr_configuration_details) structure is documented below.",
                "",
                '<a name="attr_configuration_details"></a>',
                "The `details` block supports:",
                "",
                "* `key` - The detail key.",
                "* `value` - The detail value.",
            ].join("\n");

            const ast = parser.parse(md);
            const view = buildDocSemanticView(ast, md, parser);

            expect(view.diagnostics).toHaveLength(0);

            const argLists = view.argumentLists;
            expect(argLists).toHaveLength(1);
            const args = argLists[0].arguments;
            expect(args).toHaveLength(2);
            expect(args[1].name).toBe("configuration");
            expect(args[1].anchorId).toBe("resource_configuration");
            expect(args[1].children).toHaveLength(2);
            expect(args[1].children[0].name).toBe("type");
            expect(args[1].children[1].name).toBe("enabled");

            const attrLists = view.attributeLists;
            expect(attrLists).toHaveLength(1);
            const attrs = attrLists[0].attributes;
            expect(attrs).toHaveLength(2);
            expect(attrs[1].name).toBe("configuration");
            expect(attrs[1].anchorId).toBe("attr_configuration");
            expect(attrs[1].children).toHaveLength(3);
            expect(attrs[1].children[0].name).toBe("status");
            expect(attrs[1].children[1].name).toBe("created_at");
            expect(attrs[1].children[2].name).toBe("details");
            expect(attrs[1].children[2].anchorId).toBe("attr_configuration_details");
            expect(attrs[1].children[2].children).toHaveLength(2);
            expect(attrs[1].children[2].children[0].name).toBe("key");
            expect(attrs[1].children[2].children[1].name).toBe("value");
        });
    });

    describe("5.2 Argument object containing attributes with non-object value", () => {
        it("should parse argument section with object args and attribute section with scalar attrs for same name", () => {
            const md = [
                "---",
                "subcategory: Compute",
                "page_title: Test Resource",
                "---",
                "",
                "# test_resource",
                "",
                "Test resource description.",
                "",
                "## Argument Reference",
                "",
                "* `name` - (Required, String) Specifies the name.",
                "* `tags` - (Optional, Map) Specifies the key/value pairs.",
                "* `basic_config` - (Optional, List) Specifies the basic config.",
                "  The [basic_config](#resource_basic_config) structure is documented below.",
                "",
                '<a name="resource_basic_config"></a>',
                "The `basic_config` block supports:",
                "",
                "* `enabled` - (Required, Bool) Whether to enable.",
                "* `count` - (Optional, Int) The count.",
                "",
                "## Attributes Reference",
                "",
                "* `id` - The resource ID.",
                "* `tags` - The tags of the resource.",
                "* `basic_config` - The basic config.",
                "  The [basic_config](#attr_basic_config) structure is documented below.",
                "",
                '<a name="attr_basic_config"></a>',
                "The `basic_config` block supports:",
                "",
                "* `created_at` - The creation time.",
                "* `updated_at` - The update time.",
            ].join("\n");

            const ast = parser.parse(md);
            const view = buildDocSemanticView(ast, md, parser);

            expect(view.diagnostics).toHaveLength(0);

            const args = view.argumentLists[0].arguments;
            expect(args).toHaveLength(3);

            expect(args[1].name).toBe("tags");
            expect(args[1].tags).toContain("Optional");
            expect(args[1].tags).toContain("Map");
            expect(args[1].children).toEqual([]);

            const configArg = args[2];
            expect(configArg.name).toBe("basic_config");
            expect(configArg.anchorId).toBe("resource_basic_config");
            expect(configArg.children).toHaveLength(2);
            expect(configArg.children[0].name).toBe("enabled");
            expect(configArg.children[0].children).toEqual([]);
            expect(configArg.children[1].name).toBe("count");
            expect(configArg.children[1].children).toEqual([]);

            const attrs = view.attributeLists[0].attributes;
            expect(attrs).toHaveLength(3);

            expect(attrs[1].name).toBe("tags");
            expect(attrs[1].children).toEqual([]);

            const configAttr = attrs[2];
            expect(configAttr.name).toBe("basic_config");
            expect(configAttr.anchorId).toBe("attr_basic_config");
            expect(configAttr.children).toHaveLength(2);
            expect(configAttr.children[0].name).toBe("created_at");
            expect(configAttr.children[0].children).toEqual([]);
            expect(configAttr.children[1].name).toBe("updated_at");
            expect(configAttr.children[1].children).toEqual([]);
        });
    });
});

describe("doc-semantic builder - Edge cases", () => {
    it("should handle Argument Reference section with only description and no items", () => {
        const md = [
            "## Argument Reference",
            "",
            "No arguments are supported for this resource.",
        ].join("\n");

        const { block, diagnostics } = parseArgList(md);

        expect(block).not.toBeNull();
        expect(diagnostics).toHaveLength(0);
        expect(block!.node.arguments).toHaveLength(0);
    });

    it("should handle multiple separate nested blocks", () => {
        const md = [
            "## Argument Reference",
            "",
            "* `name` - (Required, String) Specifies the name.",
            "* `vpc` - (Optional, List) Specifies the VPC.",
            "  The [vpc](#resource_vpc) structure is documented below.",
            "* `subnet` - (Optional, List) Specifies the subnet.",
            "  The [subnet](#resource_subnet) structure is documented below.",
            "",
            '<a name="resource_vpc"></a>',
            "The `vpc` block supports:",
            "",
            "* `vpc_id` - (Required, String) VPC ID.",
            "* `vpc_name` - (Optional, String) VPC name.",
            "",
            '<a name="resource_subnet"></a>',
            "The `subnet` block supports:",
            "",
            "* `subnet_id` - (Required, String) Subnet ID.",
            "* `cidr` - (Optional, String) CIDR block.",
        ].join("\n");

        const { block, diagnostics } = parseArgList(md);

        expect(block).not.toBeNull();
        expect(diagnostics).toHaveLength(0);
        const args = block!.node.arguments;
        expect(args).toHaveLength(3);

        expect(args[0].name).toBe("name");
        expect(args[0].children).toEqual([]);

        expect(args[1].name).toBe("vpc");
        expect(args[1].anchorId).toBe("resource_vpc");
        expect(args[1].children).toHaveLength(2);
        expect(args[1].children[0].name).toBe("vpc_id");
        expect(args[1].children[1].name).toBe("vpc_name");

        expect(args[2].name).toBe("subnet");
        expect(args[2].anchorId).toBe("resource_subnet");
        expect(args[2].children).toHaveLength(2);
        expect(args[2].children[0].name).toBe("subnet_id");
        expect(args[2].children[1].name).toBe("cidr");
    });

    it("should compute isComputed correctly for nested arguments", () => {
        const md = [
            "## Argument Reference",
            "",
            "* `name` - (Required, String) Specifies the name.",
            "* `config` - (Optional, List, Computed) Specifies the config.",
            "  The [config](#resource_config) structure is documented below.",
            "",
            '<a name="resource_config"></a>',
            "The `config` block supports:",
            "",
            "* `key` - (Required, String) Config key.",
        ].join("\n");

        const { block } = parseArgList(md);

        expect(block).not.toBeNull();
        expect(block!.node.isComputed()).toBe(true);
    });

    it("should return false for isComputed when no Computed tag exists", () => {
        const md = [
            "## Argument Reference",
            "",
            "* `name` - (Required, String) Specifies the name.",
            "* `region` - (Optional, String) Specifies the region.",
        ].join("\n");

        const { block } = parseArgList(md);

        expect(block).not.toBeNull();
        expect(block!.node.isComputed()).toBe(false);
    });

    it("should handle ForceNew and NonUpdatable tags on nested arguments", () => {
        const md = [
            "## Argument Reference",
            "",
            "* `name` - (Required, String, ForceNew) Specifies the name.",
            "* `config` - (Optional, List) Specifies the config.",
            "  The [config](#resource_config) structure is documented below.",
            "",
            '<a name="resource_config"></a>',
            "The `config` block supports:",
            "",
            "* `key` - (Required, String, NonUpdatable) Config key.",
            "* `value` - (Optional, String, ForceNew) Config value.",
        ].join("\n");

        const { block, diagnostics } = parseArgList(md);

        expect(block).not.toBeNull();
        expect(diagnostics).toHaveLength(0);
        const args = block!.node.arguments;
        expect(args[0].tags).toContain("ForceNew");

        const configArg = args[1];
        expect(configArg.children[0].tags).toContain("NonUpdatable");
        expect(configArg.children[1].tags).toContain("ForceNew");
    });
});
