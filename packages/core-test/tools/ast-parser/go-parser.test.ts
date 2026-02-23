import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GoParser } from "@code-check/core";

describe("GoParser", () => {
    let parser: GoParser;

    beforeAll(async () => {
        parser = await GoParser.create();
    });

    afterAll(() => {
        parser.dispose();
    });

    it("should parse a simple Go function", () => {
        const source = `
package main

func hello() string {
    return "world"
}
`;
        const tree = parser.parse(source);
        const root = tree.rootNode;

        expect(root.type).toBe("source_file");

        const funcDecls = parser.findByType(root, "function_declaration");
        expect(funcDecls).toHaveLength(1);
        expect(funcDecls[0].childForFieldName("name")?.text).toBe("hello");

        tree.delete();
    });

    it("should find nodes by type", () => {
        const source = `
package main

import "fmt"

func a() {}
func b() {}
`;
        const tree = parser.parse(source);
        const funcs = parser.findByType(tree.rootNode, "function_declaration");
        expect(funcs).toHaveLength(2);
        tree.delete();
    });

    it("should walk all nodes depth-first", () => {
        const source = `package main

func f() { return }
`;
        const tree = parser.parse(source);
        const types: string[] = [];
        parser.walk(tree.rootNode, (n) => {
            if (n.isNamed) types.push(n.type);
        });

        expect(types[0]).toBe("source_file");
        expect(types).toContain("function_declaration");
        tree.delete();
    });

    it("should run tree-sitter queries", () => {
        const source = `
package main

func resourceAwsInstance() *schema.Resource {
    return nil
}

func helperFunc() {}
`;
        const tree = parser.parse(source);
        const pattern = `(function_declaration name: (identifier) @name)`;
        const matches = parser.query(tree.rootNode, pattern);

        const names = matches.map(
            (m) => m.captures.find((c) => c.name === "name")?.node.text
        );
        expect(names).toContain("resourceAwsInstance");
        expect(names).toContain("helperFunc");
        tree.delete();
    });

    it("should support captures() for flat results", () => {
        const source = `
package main

func foo() {}
func bar() {}
`;
        const tree = parser.parse(source);
        const captures = parser.captures(
            tree.rootNode,
            `(function_declaration name: (identifier) @fn_name)`
        );

        const names = captures.map((c) => c.node.text);
        expect(names).toEqual(["foo", "bar"]);
        tree.delete();
    });

    it("should reuse cached language on second create()", async () => {
        const parser2 = await GoParser.create();
        const tree = parser2.parse(`package main\nfunc x() {}`);
        expect(tree.rootNode.type).toBe("source_file");
        tree.delete();
        parser2.dispose();
    });
});
