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
});
