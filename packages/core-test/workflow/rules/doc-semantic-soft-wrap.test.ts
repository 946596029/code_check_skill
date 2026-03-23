import { describe, it, expect } from "vitest";
import { MarkdownParser } from "../../../core/src/tools/ast-parser/markdown";
import {
    buildArgumentList,
    buildAttributeList,
    type BuildDiagnostic,
} from "../../../core/src/workflow/implement/resource-check/tools/doc-semantic";

describe("Doc semantic builder - soft wrapped bullet description", () => {
    const parser = new MarkdownParser();

    it("should keep full argument description when bullet text wraps softly", () => {
        const md = [
            "## Argument Reference",
            "",
            "* `instance_id` - (Required, String, NonUpdatable) Specifies the ID of the dedicated instance to which the channel",
            "  member belongs.",
        ].join("\n");

        const ast = parser.parse(md);
        const diagnostics: BuildDiagnostic[] = [];
        const block = buildArgumentList(parser, ast, md, diagnostics);

        expect(block).not.toBeNull();
        expect(diagnostics).toHaveLength(0);
        expect(block!.node.arguments).toHaveLength(1);
        expect(block!.node.arguments[0].description).toBe(
            "Specifies the ID of the dedicated instance to which the channel member belongs.",
        );
        expect(block!.node.arguments[0].details.text).toBe(
            "Specifies the ID of the dedicated instance to which the channel member belongs.",
        );
    });

    it("should keep full attribute description when bullet text wraps softly", () => {
        const md = [
            "## Attributes Reference",
            "",
            "* `status` - The status of the channel member in API responses when",
            "  the resource operation succeeds.",
        ].join("\n");

        const ast = parser.parse(md);
        const diagnostics: BuildDiagnostic[] = [];
        const block = buildAttributeList(parser, ast, md, diagnostics);

        expect(block).not.toBeNull();
        expect(diagnostics).toHaveLength(0);
        expect(block!.node.attributes).toHaveLength(1);
        expect(block!.node.attributes[0].description).toBe(
            "The status of the channel member in API responses when the resource operation succeeds.",
        );
        expect(block!.node.attributes[0].details.text).toBe(
            "The status of the channel member in API responses when the resource operation succeeds.",
        );
    });

    it("should merge argument bullets from multiple top-level lists separated by a -> note paragraph", () => {
        const md = [
            "## Argument Reference",
            "",
            "The following arguments are supported:",
            "",
            "* `region` - (Optional, String) Region.",
            "",
            "* `cluster_id` - (Required, String) Cluster.",
            "",
            "-> Currently, only regular cluster is supported.",
            "",
            "* `name` - (Required, String) Name.",
        ].join("\n");

        const ast = parser.parse(md);
        const diagnostics: BuildDiagnostic[] = [];
        const block = buildArgumentList(parser, ast, md, diagnostics);

        expect(block).not.toBeNull();
        expect(block!.node.arguments.map((a) => a.name)).toEqual([
            "region",
            "cluster_id",
            "name",
        ]);
    });

    it("should merge nested attributes when a supported block list is interrupted by a -> note paragraph", () => {
        const md = [
            "## Attribute Reference",
            "",
            "In addition to all arguments above, the following attributes are exported:",
            "",
            "* `members` - The list of channel members.",
            "  The [members](#apig_channel_members) structure is documented below.",
            "",
            '<a name="apig_channel_members"></a>',
            "The `members` block supports:",
            "",
            "* `first` - First nested attribute.",
            "",
            "-> This note interrupts the nested list.",
            "",
            "* `second` - Second nested attribute.",
        ].join("\n");

        const ast = parser.parse(md);
        const diagnostics: BuildDiagnostic[] = [];
        const block = buildAttributeList(parser, ast, md, diagnostics);

        expect(block).not.toBeNull();
        expect(diagnostics).toHaveLength(0);
        expect(block!.node.title).toBe("Attribute Reference");
        const members = block!.node.attributes.find((a) => a.name === "members");
        expect(members).toBeDefined();
        expect(members!.attributes.map((a) => a.name)).toEqual(["first", "second"]);
    });

    it("should merge nested arguments when a supported block list is interrupted by a -> note paragraph", () => {
        const md = [
            "## Argument Reference",
            "",
            "The following arguments are supported:",
            "",
            "* `members` - (Optional, List) The list of channel members.",
            "  The [members](#apig_channel_members) structure is documented below.",
            "",
            '<a name="apig_channel_members"></a>',
            "The `members` block supports:",
            "",
            "* `first` - (Required, String) First nested argument.",
            "",
            "-> This note interrupts the nested list.",
            "",
            "* `second` - (Optional, String) Second nested argument.",
        ].join("\n");

        const ast = parser.parse(md);
        const diagnostics: BuildDiagnostic[] = [];
        const block = buildArgumentList(parser, ast, md, diagnostics);

        expect(block).not.toBeNull();
        expect(diagnostics).toHaveLength(0);
        const members = block!.node.arguments.find((a) => a.name === "members");
        expect(members).toBeDefined();
        expect(members!.arguments.map((a) => a.name)).toEqual(["first", "second"]);
    });

    it("should stop merging top-level attribute lists at a named HTML anchor", () => {
        const md = [
            "## Attributes Reference",
            "",
            "* `id` - The resource ID.",
            "",
            "* `nested` - Nested block.",
            "",
            '<a name="nested_block"></a>',
            "",
            "The `nested` block supports:",
            "",
            "* `child` - Nested attribute only.",
        ].join("\n");

        const ast = parser.parse(md);
        const diagnostics: BuildDiagnostic[] = [];
        const block = buildAttributeList(parser, ast, md, diagnostics);

        expect(block).not.toBeNull();
        expect(block!.node.attributes.map((a) => a.name)).toEqual([
            "id",
            "nested",
        ]);
        const nested = block!.node.attributes.find((a) => a.name === "nested");
        expect(nested?.attributes).toHaveLength(1);
        expect(nested?.attributes[0].name).toBe("child");
    });
});
