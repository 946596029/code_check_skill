import { GoParser } from "./parser";
import type { SyntaxNode } from "./parser";
import type { ResourceSchema, SchemaField, SchemaFieldType } from "./types";

/**
 * Mapping from `schema.Type*` selector expressions to our SchemaFieldType.
 */
const TYPE_MAP: Record<string, SchemaFieldType> = {
    "schema.TypeString": "TypeString",
    "schema.TypeBool": "TypeBool",
    "schema.TypeInt": "TypeInt",
    "schema.TypeFloat": "TypeFloat",
    "schema.TypeList": "TypeList",
    "schema.TypeSet": "TypeSet",
    "schema.TypeMap": "TypeMap",
};

function nonNullChildren(node: SyntaxNode): SyntaxNode[] {
    return node.namedChildren.filter((c): c is SyntaxNode => c !== null);
}

/**
 * Unwrap a `literal_element` wrapper node produced by tree-sitter-go.
 * In Go composite literals, `keyed_element` children are wrapped in
 * `literal_element` nodes. This returns the inner content node.
 */
function unwrap(node: SyntaxNode): SyntaxNode {
    if (node.type === "literal_element") {
        const inner = node.firstNamedChild;
        return inner ?? node;
    }
    return node;
}

/**
 * Extracts Terraform resource schemas from Go source files.
 *
 * Targets the common Terraform Plugin SDK pattern:
 * ```go
 * func resourceXxx() *schema.Resource {
 *     return &schema.Resource{
 *         Schema: map[string]*schema.Schema{
 *             "field": { Type: schema.TypeString, ... },
 *         },
 *     }
 * }
 * ```
 *
 * @example
 * ```typescript
 * const parser = await GoParser.create();
 * const extractor = new TerraformSchemaExtractor(parser);
 * const schemas = extractor.extract(goSourceCode);
 * ```
 */
export class TerraformSchemaExtractor {
    constructor(private parser: GoParser) {}

    /**
     * Extract all resource schemas from a Go source string.
     */
    public extract(goSource: string): ResourceSchema[] {
        const tree = this.parser.parse(goSource);
        const root = tree.rootNode;
        const results: ResourceSchema[] = [];

        const funcDecls = this.parser.findByType(root, "function_declaration");
        for (const fn of funcDecls) {
            const schema = this.extractFromFunction(fn);
            if (schema) {
                results.push(schema);
            }
        }

        tree.delete();
        return results;
    }

    private extractFromFunction(fn: SyntaxNode): ResourceSchema | null {
        const nameNode = fn.childForFieldName("name");
        if (!nameNode) return null;
        const funcName = nameNode.text;

        const body = fn.childForFieldName("body");
        if (!body) return null;

        const schemaMap = this.findSchemaMap(body);
        if (!schemaMap) return null;

        const fields = this.extractFieldsFromMap(schemaMap);

        return {
            resourceName: this.inferResourceName(funcName),
            functionName: funcName,
            fields,
        };
    }

    /**
     * Locate the `Schema: map[string]*schema.Schema{ ... }` composite
     * literal value within a function body.
     *
     * In tree-sitter-go, keyed_element children are:
     *   keyed_element -> literal_element (key) + literal_element (value)
     */
    private findSchemaMap(body: SyntaxNode): SyntaxNode | null {
        const keyedElements = this.parser.findByType(body, "keyed_element");

        for (const ke of keyedElements) {
            const children = nonNullChildren(ke);
            if (children.length < 2) continue;

            const keyNode = unwrap(children[0]);
            if (keyNode.text !== "Schema") continue;

            const valueNode = unwrap(children[1]);
            if (this.isSchemaMapLiteral(valueNode)) {
                return valueNode;
            }
        }

        return null;
    }

    /**
     * Check if a node is a composite_literal of type
     * `map[string]*schema.Schema{ ... }`.
     */
    private isSchemaMapLiteral(node: SyntaxNode): boolean {
        if (node.type !== "composite_literal") return false;
        const typeNode = node.childForFieldName("type");
        if (!typeNode) return false;
        return typeNode.text === "map[string]*schema.Schema";
    }

    /**
     * Extract all schema fields from a map literal
     * `map[string]*schema.Schema{ ... }`.
     */
    private extractFieldsFromMap(mapLiteral: SyntaxNode): SchemaField[] {
        const fields: SchemaField[] = [];
        const literalBody = mapLiteral.childForFieldName("body");
        if (!literalBody) return fields;

        for (const child of nonNullChildren(literalBody)) {
            if (child.type !== "keyed_element") continue;
            const field = this.parseSchemaField(child);
            if (field) {
                fields.push(field);
            }
        }

        return fields;
    }

    /**
     * Parse a single schema field from a keyed_element like:
     * `"field_name": { Type: schema.TypeString, Required: true, ... }`
     *
     * keyed_element -> literal_element(key) + literal_element(value)
     *   key unwraps to: interpreted_string_literal
     *   value unwraps to: literal_value (shorthand for the struct literal)
     */
    private parseSchemaField(keyedElement: SyntaxNode): SchemaField | null {
        const children = nonNullChildren(keyedElement);
        if (children.length < 2) return null;

        const keyNode = unwrap(children[0]);
        const name = this.extractStringLiteral(keyNode);
        if (name === null) return null;

        const valueNode = unwrap(children[1]);
        return this.parseFieldProperties(name, valueNode);
    }

    /**
     * Parse the properties (Type, Required, Optional, etc.) from
     * a literal_value or composite_literal node containing the field's
     * key-value pairs.
     */
    private parseFieldProperties(
        name: string,
        bodyOrLiteral: SyntaxNode
    ): SchemaField {
        const field: SchemaField = {
            name,
            type: "",
            required: false,
            optional: false,
            computed: false,
            forceNew: false,
            description: "",
        };

        const body = bodyOrLiteral.type === "literal_value"
            ? bodyOrLiteral
            : (bodyOrLiteral.type === "composite_literal"
                ? bodyOrLiteral.childForFieldName("body")
                : null);
        if (!body) return field;

        for (const child of nonNullChildren(body)) {
            if (child.type !== "keyed_element") continue;

            const childNamed = nonNullChildren(child);
            if (childNamed.length < 2) continue;
            const propKey = unwrap(childNamed[0]);
            const propVal = unwrap(childNamed[1]);

            const key = propKey.text;
            switch (key) {
                case "Type":
                    field.type = TYPE_MAP[propVal.text] ?? propVal.text;
                    break;
                case "Required":
                    field.required = propVal.text === "true";
                    break;
                case "Optional":
                    field.optional = propVal.text === "true";
                    break;
                case "Computed":
                    field.computed = propVal.text === "true";
                    break;
                case "ForceNew":
                    field.forceNew = propVal.text === "true";
                    break;
                case "Description":
                    field.description = this.extractStringLiteral(propVal) ?? "";
                    break;
                case "Default":
                    field.defaultValue = propVal.text;
                    break;
                case "Elem":
                    this.parseElem(field, propVal);
                    break;
            }
        }

        return field;
    }

    /**
     * Parse the `Elem` property which can be either:
     * - `&schema.Schema{ Type: schema.TypeString }` (simple element type)
     * - `&schema.Resource{ Schema: map[string]*schema.Schema{ ... } }` (nested block)
     */
    private parseElem(field: SchemaField, elemNode: SyntaxNode): void {
        let inner = elemNode;
        if (inner.type === "unary_expression") {
            const operand = inner.childForFieldName("operand");
            if (!operand) return;
            inner = operand;
        }

        if (inner.type !== "composite_literal") return;

        const typeNode = inner.childForFieldName("type");
        if (!typeNode) return;

        const typeText = typeNode.text;

        if (typeText === "schema.Schema" || typeText === "*schema.Schema") {
            const body = inner.childForFieldName("body");
            if (!body) return;
            for (const child of nonNullChildren(body)) {
                if (child.type !== "keyed_element") continue;
                const childNamed = nonNullChildren(child);
                if (childNamed.length < 2) continue;
                const k = unwrap(childNamed[0]);
                const v = unwrap(childNamed[1]);
                if (k.text === "Type") {
                    field.elemType = TYPE_MAP[v.text] ?? v.text;
                }
            }
        } else if (typeText === "schema.Resource" || typeText === "*schema.Resource") {
            const schemaMap = this.findSchemaMap(inner);
            if (schemaMap) {
                field.subFields = this.extractFieldsFromMap(schemaMap);
            }
        }
    }

    /**
     * Extract the content of a Go interpreted string literal,
     * stripping the surrounding double quotes.
     */
    private extractStringLiteral(node: SyntaxNode): string | null {
        const text = node.text;
        if (text.startsWith('"') && text.endsWith('"')) {
            return text.slice(1, -1);
        }
        if (text.startsWith('`') && text.endsWith('`')) {
            return text.slice(1, -1);
        }
        return null;
    }

    /**
     * Infer a Terraform resource name from a Go function name.
     *
     * `resourceAwsInstance`     -> `aws_instance`
     * `dataSourceAwsAmi`       -> `aws_ami`
     * `ResourceAwsVpcSubnet`   -> `aws_vpc_subnet`
     */
    private inferResourceName(funcName: string): string {
        let name = funcName;

        const prefixes = ["resource", "dataSource", "Resource", "DataSource"];
        for (const prefix of prefixes) {
            if (name.startsWith(prefix)) {
                name = name.slice(prefix.length);
                break;
            }
        }

        if (!name) return funcName;

        return name
            .replace(/([A-Z])/g, "_$1")
            .toLowerCase()
            .replace(/^_/, "");
    }
}
