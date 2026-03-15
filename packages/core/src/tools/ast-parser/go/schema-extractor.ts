import { GoParser } from "./parser";
import type { SyntaxNode } from "./parser";
import type {
    ResourceOptions,
    ResourceSchema,
    ResourceTimeouts,
    SchemaField,
    SchemaFieldType,
} from "./types";

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
    private currentRoot: SyntaxNode | null = null;

    constructor(private parser: GoParser) {}

    /**
     * Extract all resource schemas from a Go source string.
     */
    public extract(goSource: string): ResourceSchema[] {
        const tree = this.parser.parse(goSource);
        const root = tree.rootNode;
        this.currentRoot = root;
        const results: ResourceSchema[] = [];

        try {
            const funcDecls = this.parser.findByType(root, "function_declaration");
            for (const fn of funcDecls) {
                const schema = this.extractFromFunction(fn);
                if (schema) {
                    results.push(schema);
                }
            }
        } finally {
            this.currentRoot = null;
            tree.delete();
        }

        return results;
    }

    private extractFromFunction(fn: SyntaxNode): ResourceSchema | null {
        const nameNode = fn.childForFieldName("name");
        if (!nameNode) return null;
        const funcName = nameNode.text;

        const body = fn.childForFieldName("body");
        if (!body) return null;

        const resourceLiteral = this.findResourceLiteral(body);
        if (!resourceLiteral) return null;

        const schemaMap = this.findSchemaMap(resourceLiteral);
        if (!schemaMap) return null;

        const fields = this.extractFieldsFromMap(schemaMap);
        const resourceOptions = this.extractResourceOptions(resourceLiteral);

        return {
            resourceName: this.inferResourceName(funcName),
            functionName: funcName,
            fields,
            resourceOptions,
        };
    }

    /**
     * Locate the returned `&schema.Resource{ ... }` composite literal
     * in a function body.
     */
    private findResourceLiteral(body: SyntaxNode): SyntaxNode | null {
        const literals = this.parser.findByType(body, "composite_literal");
        for (const literal of literals) {
            if (!this.isResourceCompositeLiteral(literal)) continue;
            const schemaMap = this.findSchemaMap(literal);
            if (!schemaMap) continue;
            return literal;
        }
        return null;
    }

    /**
     * Locate the `Schema: map[string]*schema.Schema{ ... }` value from
     * a resource composite literal.
     */
    private findSchemaMap(resourceLiteral: SyntaxNode): SyntaxNode | null {
        const valueNode = this.findTopLevelValueByKey(resourceLiteral, "Schema");
        if (!valueNode) return null;
        if (this.isSchemaMapLiteral(valueNode)) return valueNode;
        return null;
    }

    private isResourceCompositeLiteral(node: SyntaxNode): boolean {
        const typeNode = node.childForFieldName("type");
        if (!typeNode) return false;
        const typeText = typeNode.text;
        return typeText === "schema.Resource" || typeText === "*schema.Resource";
    }

    /**
     * Find a top-level keyed value from a composite literal body by key.
     */
    private findTopLevelValueByKey(
        compositeLiteral: SyntaxNode,
        targetKey: string
    ): SyntaxNode | null {
        const body = compositeLiteral.childForFieldName("body");
        if (!body) return null;

        for (const child of nonNullChildren(body)) {
            if (child.type !== "keyed_element") continue;
            const keyedChildren = nonNullChildren(child);
            if (keyedChildren.length < 2) continue;
            const key = unwrap(keyedChildren[0]);
            if (key.text !== targetKey) continue;
            return unwrap(keyedChildren[1]);
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
     * Parse the `Elem` property which can be:
     * - `&schema.Schema{ Type: schema.TypeString }` (simple element type)
     * - `&schema.Resource{ Schema: map[string]*schema.Schema{ ... } }` (nested block)
     * - `someSchemaFunc()` (function call returning *schema.Resource)
     */
    private parseElem(field: SchemaField, elemNode: SyntaxNode): void {
        let inner = elemNode;
        if (inner.type === "unary_expression") {
            const operand = inner.childForFieldName("operand");
            if (!operand) return;
            inner = operand;
        }

        if (inner.type === "call_expression") {
            const resolved = this.resolveSchemaFuncCall(inner);
            if (resolved) {
                field.subFields = resolved;
            }
            return;
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
     * Resolve an `Elem: someFunc()` call expression by locating the
     * function definition in the same file and extracting its returned
     * schema fields.
     */
    private resolveSchemaFuncCall(callNode: SyntaxNode): SchemaField[] | undefined {
        if (!this.currentRoot) return undefined;

        const funcNode = callNode.childForFieldName("function");
        if (!funcNode) return undefined;
        const funcName = funcNode.text;

        const funcDecls = this.parser.findByType(this.currentRoot, "function_declaration");

        for (const fn of funcDecls) {
            const nameNode = fn.childForFieldName("name");
            if (!nameNode || nameNode.text !== funcName) continue;

            const body = fn.childForFieldName("body");
            if (!body) continue;

            const resourceLiteral = this.findResourceLiteral(body);
            if (!resourceLiteral) continue;

            const schemaMap = this.findSchemaMap(resourceLiteral);
            if (schemaMap) {
                return this.extractFieldsFromMap(schemaMap);
            }
        }
        return undefined;
    }

    private extractResourceOptions(resourceLiteral: SyntaxNode): ResourceOptions {
        const options: ResourceOptions = {
            hasImporter: false,
        };

        const importerNode = this.findTopLevelValueByKey(resourceLiteral, "Importer");
        if (importerNode && importerNode.text !== "nil") {
            options.hasImporter = true;
            const stateContext = this.extractImporterStateContext(importerNode);
            if (stateContext) {
                options.importerStateContext = stateContext;
            }
        }

        const customizeDiffNode = this.findTopLevelValueByKey(resourceLiteral, "CustomizeDiff");
        if (customizeDiffNode) {
            options.customizeDiff = customizeDiffNode.text;
        }

        const deprecationNode = this.findTopLevelValueByKey(resourceLiteral, "DeprecationMessage");
        if (deprecationNode) {
            options.deprecationMessage = this.extractStringLiteral(deprecationNode) ?? deprecationNode.text;
        }

        const timeoutsNode = this.findTopLevelValueByKey(resourceLiteral, "Timeouts");
        if (timeoutsNode) {
            const timeouts = this.extractTimeouts(timeoutsNode);
            if (timeouts) {
                options.timeouts = timeouts;
            }
        }

        return options;
    }

    private extractImporterStateContext(importerNode: SyntaxNode): string | undefined {
        let node = importerNode;
        if (node.type === "unary_expression") {
            const operand = node.childForFieldName("operand");
            if (!operand) return undefined;
            node = operand;
        }

        if (node.type !== "composite_literal") return undefined;
        const typeNode = node.childForFieldName("type");
        if (!typeNode) return undefined;
        const typeText = typeNode.text;
        if (typeText !== "schema.ResourceImporter" && typeText !== "*schema.ResourceImporter") {
            return undefined;
        }

        const stateContextNode = this.findTopLevelValueByKey(node, "StateContext");
        if (stateContextNode) return stateContextNode.text;

        const stateNode = this.findTopLevelValueByKey(node, "State");
        if (stateNode) return stateNode.text;

        return undefined;
    }

    private extractTimeouts(timeoutsNode: SyntaxNode): ResourceTimeouts | undefined {
        let node = timeoutsNode;
        if (node.type === "unary_expression") {
            const operand = node.childForFieldName("operand");
            if (!operand) return undefined;
            node = operand;
        }

        if (node.type !== "composite_literal") return undefined;
        const typeNode = node.childForFieldName("type");
        if (!typeNode) return undefined;
        const typeText = typeNode.text;
        if (typeText !== "schema.ResourceTimeout" && typeText !== "*schema.ResourceTimeout") {
            return undefined;
        }

        const timeouts: ResourceTimeouts = {};
        const mapping: Record<string, keyof ResourceTimeouts> = {
            Create: "create",
            Read: "read",
            Update: "update",
            Delete: "delete",
            Default: "default",
        };

        const body = node.childForFieldName("body");
        if (!body) return undefined;
        for (const child of nonNullChildren(body)) {
            if (child.type !== "keyed_element") continue;
            const keyedChildren = nonNullChildren(child);
            if (keyedChildren.length < 2) continue;
            const keyNode = unwrap(keyedChildren[0]);
            const valueNode = unwrap(keyedChildren[1]);
            const mapped = mapping[keyNode.text];
            if (!mapped) continue;
            timeouts[mapped] = valueNode.text;
        }

        if (Object.keys(timeouts).length === 0) return undefined;
        return timeouts;
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
