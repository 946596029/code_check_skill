import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "path";
import { CodeChecker } from "@code-check/core";
import {
    parseResourceCheckInput,
    resolveResourcePaths,
    DocSemanticView,
} from "../../core/src/workflow/implement/resource-check/types";
import { buildSchemaSemanticView } from "../../core/src/workflow/implement/resource-check/tools/schema-semantic";
import { GoParser } from "../../core/src/tools/ast-parser/go";
import {
    TerraformSchemaExtractor,
    TerraformSchemaSemanticNormalizer,
} from "../../core/src/workflow/implement/resource-check/tools/terraform-schema";
import { SectionExistenceRule } from "../../core/src/workflow/implement/resource-check/rules/markdown-semantic/section-existence-rule";
import { ArgumentSectionSemanticRule } from "../../core/src/workflow/implement/resource-check/rules/markdown-semantic/argument-section-semantic-rule";
import { AttributeSectionSemanticRule } from "../../core/src/workflow/implement/resource-check/rules/markdown-semantic/attribute-section-semantic-rule";
import { MarkdownParser } from "../../core/src/tools/ast-parser/markdown";
import { Context } from "../../core/src/workflow/context/context";
import type { RuleCheckResult } from "../../core/src/workflow/types/rule/rule";
import type {
    CheckReport,
    SchemaSemanticView,
    SemanticField,
    ResourceSchema,
    Argument,
    Attribute,
    ArgumentList,
    AttributeList,
} from "../../core/src/workflow/implement/resource-check/types";
import type { ResourceCheckInput } from "../../core/src/workflow/implement/resource-check/types";

const EXAMPLE_ROOT = path.resolve(
    __dirname,
    "../terraform_provider_example"
);

function makeInput(overrides: Partial<ResourceCheckInput> = {}): ResourceCheckInput {
    return {
        providerRoot: EXAMPLE_ROOT,
        serviceName: "apig",
        resourceName: "apig_channel_member",
        resourceType: "resource",
        ...overrides,
    };
}

function toCode(input: ResourceCheckInput): string {
    return JSON.stringify(input);
}

describe("parseResourceCheckInput", () => {
    it("should parse valid JSON input", () => {
        const input = makeInput();
        const parsed = parseResourceCheckInput(JSON.stringify(input));
        expect(parsed.providerRoot).toBe(EXAMPLE_ROOT);
        expect(parsed.serviceName).toBe("apig");
        expect(parsed.resourceName).toBe("apig_channel_member");
        expect(parsed.resourceType).toBe("resource");
    });

    it("should throw on non-JSON input", () => {
        expect(() => parseResourceCheckInput("not json")).toThrow("JSON");
    });

    it("should throw on missing required fields", () => {
        expect(() => parseResourceCheckInput(JSON.stringify({}))).toThrow(
            "ResourceCheckInput requires"
        );
    });

    it("should throw on invalid resourceType", () => {
        const bad = { ...makeInput(), resourceType: "invalid" };
        expect(() => parseResourceCheckInput(JSON.stringify(bad))).toThrow(
            "ResourceCheckInput requires"
        );
    });

    it("should accept data-source resourceType", () => {
        const input = makeInput({ resourceType: "data-source" });
        const parsed = parseResourceCheckInput(JSON.stringify(input));
        expect(parsed.resourceType).toBe("data-source");
    });
});

describe("resolveResourcePaths", () => {
    it("should resolve resource paths correctly", () => {
        const input = makeInput();
        const paths = resolveResourcePaths(input);

        expect(paths.implementGoPath).toContain("services");
        expect(paths.implementGoPath).toContain("apig");
        expect(paths.implementGoPath).toMatch(
            /resource_huaweicloud_apig_channel_member\.go$/
        );
        expect(paths.implementGoPath).toContain(path.join("huaweicloud", "services"));
        expect(paths.docMdPath).toContain(path.join("docs", "resources"));
        expect(paths.docMdPath).toMatch(/apig_channel_member\.md$/);
        expect(paths.testGoPath).toContain("acceptance");
        expect(paths.testGoPath).toMatch(
            /resource_huaweicloud_apig_channel_member_test\.go$/
        );
    });

    it("should resolve data-source paths with correct prefix and directory", () => {
        const input = makeInput({
            resourceName: "apig_channel_members",
            resourceType: "data-source",
        });
        const paths = resolveResourcePaths(input);

        expect(paths.implementGoPath).toContain("data_source_");
        expect(paths.docMdPath).toContain(path.join("docs", "data-sources"));
        expect(paths.docMdPath).toMatch(/apig_channel_members\.md$/);
        expect(paths.testGoPath).toContain("data_source_");
        expect(paths.testGoPath).toContain("_test.go");
    });
});

describe("ResourceCheckWorkflow", () => {
    let checker: CodeChecker;

    beforeEach(async () => {
        checker = new CodeChecker();
        await checker.initialize();
    });

    it("should appear in workflow list", () => {
        const workflows = checker.listWorkflows();
        const ids = workflows.map((w) => w.id);
        expect(ids).toContain("resource-check");
    });

    it("should have correct id and description", () => {
        const workflows = checker.listWorkflows();
        const wf = workflows.find((w) => w.id === "resource-check");
        expect(wf).toBeDefined();
        expect(wf!.description).toContain("Staged checks");
    });

    it("should run semantic markdown rules for real resource files", async () => {
        const input = makeInput();
        const report = await checker.check({
            code: toCode(input),
            workflowId: "resource-check",
        });

        expect(report.workflowId).toBe("resource-check");

        const names = report.results.map((r) => r.ruleName);
        expect(names).toContain("implement-structured-check");
        expect(names).toContain("md-frontmatter-check");
        expect(names).toContain("md-line-length");
        expect(names).toContain("md-number-format");
        expect(names).toContain("md-h1-exists");
        expect(names).toContain("md-example-section-exists");
        expect(names).toContain("section-existence");
        expect(names).toContain("argument-section-semantic");
        expect(names).toContain("attribute-section-semantic");
        expect(names).toContain("test-go-structured-check");
        expect(names).toContain("test-hcl-style-check");
    });

    it("should produce stage error on invalid JSON code input", async () => {
        const report = await checker.check({
            code: "not valid json",
            workflowId: "resource-check",
        });

        expect(report.results.length).toBeGreaterThanOrEqual(1);
        const stageError = report.results.find(
            (r) => r.ruleName === "stage:resolve-resource-files"
        );
        expect(stageError).toBeDefined();
        expect(stageError!.results[0].success).toBe(false);
        expect(stageError!.results[0].message).toContain("Stage execution error");
    });

    it("should mark HCL stage as not configured (success=false)", async () => {
        const input = makeInput();
        const report = await checker.check({
            code: toCode(input),
            workflowId: "resource-check",
        });

        const hcl = report.results.find((r) => r.ruleName === "test-hcl-style-check");
        expect(hcl).toBeDefined();
        expect(hcl!.results).toHaveLength(1);
        expect(hcl!.results[0].success).toBe(false);
        expect(hcl!.results[0].message).toContain("not configured");
    });

    it("should handle data-source type", async () => {
        const input = makeInput({
            resourceName: "apig_channel_members",
            resourceType: "data-source",
        });
        const report = await checker.check({
            code: toCode(input),
            workflowId: "resource-check",
        });

        expect(report.workflowId).toBe("resource-check");
        expect(report.results.length).toBeGreaterThanOrEqual(5);
    });

    it("should handle missing files gracefully", async () => {
        const input = makeInput({
            resourceName: "nonexistent_resource",
        });
        const report = await checker.check({
            code: toCode(input),
            workflowId: "resource-check",
        });

        expect(report.workflowId).toBe("resource-check");
        const implementCheck = report.results.find(
            (r) => r.ruleName === "implement-structured-check"
        );
        expect(implementCheck).toBeDefined();
        expect(implementCheck!.results[0].success).toBe(false);
        expect(implementCheck!.results[0].message).toContain("missing or empty");
    });

    describe("extract-doc-structure stage", () => {
        async function runAndGetReport(
            overrides: Partial<ResourceCheckInput> = {},
        ): Promise<CheckReport> {
            const input = makeInput(overrides);
            return checker.check({
                code: toCode(input),
                workflowId: "resource-check",
            });
        }

        it("should extract frontmatter from real markdown", async () => {
            const report = await runAndGetReport();
            const formatResult = report.results.find(
                (r) => r.ruleName === "md-frontmatter-check",
            );
            expect(formatResult).toBeDefined();
            expect(formatResult!.results[0].success).toBe(true);
        });

        it("should not produce stage error for extract-doc-structure", async () => {
            const report = await runAndGetReport();
            const stageError = report.results.find(
                (r) => r.ruleName === "stage:extract-doc-structure",
            );
            expect(stageError).toBeUndefined();
        });

        it("should produce empty doc structure when markdown is missing", async () => {
            const report = await runAndGetReport({
                resourceName: "nonexistent_resource",
            });
            const formatResult = report.results.find(
                (r) => r.ruleName === "doc-format-check",
            );
            expect(formatResult).toBeDefined();
            expect(formatResult!.results[0].success).toBe(false);
            expect(formatResult!.results[0].message).toContain("missing or empty");
        });
    });

    describe("check-markdown-semantic stage", () => {
        it("should skip semantic view when go schema is missing", async () => {
            const input = makeInput({ resourceName: "nonexistent_resource" });
            const report = await checker.check({
                code: toCode(input),
                workflowId: "resource-check",
            });

            const semanticResult = report.results.find(
                (r) => r.ruleName === "doc-semantic-check",
            );
            expect(semanticResult).toBeDefined();
            expect(semanticResult!.results[0].success).toBe(false);
            expect(semanticResult!.results[0].message).toContain("skipped");
        });
    });
});

describe("buildSchemaSemanticView", () => {
    const CHANNEL_MEMBER_GROUP_SOURCE = readFileSync(
        new URL(
            "../terraform_provider_example/resource_huaweicloud_apig_channel_member_group.go",
            import.meta.url,
        ),
        "utf8",
    );

    let parser: GoParser;
    let normalizedSchema: ResourceSchema;

    beforeAll(async () => {
        parser = await GoParser.create();
        const extractor = new TerraformSchemaExtractor(parser);
        const normalizer = new TerraformSchemaSemanticNormalizer();
        const schemas = extractor.extract(CHANNEL_MEMBER_GROUP_SOURCE);
        const target = schemas.find((s) => s.functionName === "ResourceChannelMemberGroup")!;
        [normalizedSchema] = normalizer.normalizeSchemas(
            CHANNEL_MEMBER_GROUP_SOURCE,
            [target],
        );
    });

    afterAll(() => {
        parser.dispose();
    });

    it("should classify required and optional fields as arguments", () => {
        const view = buildSchemaSemanticView(normalizedSchema);

        expect(view.arguments.has("instance_id")).toBe(true);
        expect(view.arguments.has("vpc_channel_id")).toBe(true);
        expect(view.arguments.has("name")).toBe(true);
        expect(view.arguments.has("description")).toBe(true);
        expect(view.arguments.has("weight")).toBe(true);
        expect(view.arguments.has("region")).toBe(true);

        const instanceId = view.arguments.get("instance_id")!;
        expect(instanceId.required).toBe(true);
        expect(instanceId.optional).toBe(false);

        const description = view.arguments.get("description")!;
        expect(description.required).toBe(false);
        expect(description.optional).toBe(true);
    });

    it("should classify computed-only fields as attributes", () => {
        const view = buildSchemaSemanticView(normalizedSchema);

        expect(view.attributes.has("create_time")).toBe(true);
        expect(view.attributes.has("update_time")).toBe(true);

        const createTime = view.attributes.get("create_time")!;
        expect(createTime.computed).toBe(true);
        expect(createTime.required).toBe(false);
        expect(createTime.optional).toBe(false);
    });

    it("should merge forceNew from schema-level and customizeDiff sources", () => {
        const view = buildSchemaSemanticView(normalizedSchema);

        const region = view.arguments.get("region")!;
        expect(region.forceNew).toBe(true);

        const instanceId = view.arguments.get("instance_id")!;
        expect(instanceId.forceNew).toBe(true);

        const vpcChannelId = view.arguments.get("vpc_channel_id")!;
        expect(vpcChannelId.forceNew).toBe(true);
    });

    it("should populate importInfo from provider resource", () => {
        const view = buildSchemaSemanticView(normalizedSchema);

        expect(view.importInfo.importable).toBe(true);
        expect(view.importInfo.stateFunc).toBe("resourceChannelMemberGroupImportState");
        expect(view.importInfo.idParts).toBeDefined();
        expect(view.importInfo.idParts!).toEqual(["instance_id", "vpc_channel_id", "id"]);
    });

    it("should include subFields for nested block arguments", () => {
        const view = buildSchemaSemanticView(normalizedSchema);

        const labels = view.arguments.get("microservice_labels");
        expect(labels).toBeDefined();
        expect(labels!.subFields).toBeDefined();
        expect(labels!.subFields!.length).toBe(2);

        const nameField = labels!.subFields!.find((f) => f.name === "name")!;
        expect(nameField.type).toBe("TypeString");
        expect(nameField.required).toBe(true);

        const valueField = labels!.subFields!.find((f) => f.name === "value")!;
        expect(valueField.type).toBe("TypeString");
        expect(valueField.required).toBe(true);
    });

    it("should set timeouts to null when no timeout semantics present", () => {
        const view = buildSchemaSemanticView(normalizedSchema);
        expect(view.timeouts).toBeNull();
    });

    it("should set resourceName from schema", () => {
        const view = buildSchemaSemanticView(normalizedSchema);
        expect(view.resourceName).toBe("channel_member_group");
    });

    it("should handle schema without resourceSemantics", () => {
        const bareSchema: ResourceSchema = {
            resourceName: "test_resource",
            functionName: "resourceTest",
            fields: [
                {
                    name: "name",
                    type: "TypeString",
                    required: true,
                    optional: false,
                    computed: false,
                    forceNew: false,
                    description: "The name.",
                },
                {
                    name: "id_field",
                    type: "TypeString",
                    required: false,
                    optional: false,
                    computed: true,
                    forceNew: false,
                    description: "The ID.",
                },
            ],
        };

        const view = buildSchemaSemanticView(bareSchema);

        expect(view.resourceName).toBe("test_resource");
        expect(view.arguments.size).toBe(1);
        expect(view.arguments.has("name")).toBe(true);
        expect(view.attributes.size).toBe(1);
        expect(view.attributes.has("id_field")).toBe(true);
        expect(view.timeouts).toBeNull();
        expect(view.importInfo.importable).toBe(false);
    });
});

describe("ArgumentSectionSemanticRule", () => {
    const CTX_SCHEMA_SEMANTIC_VIEW = "resource-check.stage.schemaSemanticView";
    const CTX_DOC_SEMANTIC_VIEW = "resource-check.stage.docSemanticView";

    function makeField(overrides: Partial<SemanticField> = {}): SemanticField {
        return {
            name: "test_field",
            type: "TypeString",
            required: true,
            optional: false,
            computed: false,
            forceNew: false,
            nonUpdatable: false,
            description: "The test field.",
            ...overrides,
        };
    }

    function makeView(args: Map<string, SemanticField>): SchemaSemanticView {
        return {
            resourceName: "test_resource",
            arguments: args,
            attributes: new Map(),
            timeouts: null,
            importInfo: { importable: false },
        };
    }

    function makeArg(overrides: Partial<Argument> = {}): Argument {
        return {
            name: "test_field",
            tags: [],
            description: "the test field.",
            details: { text: "", children: [] },
            arguments: [],
            sourceRange: { start: { line: 10, column: 1 }, end: { line: 10, column: 1 } },
            ...overrides,
        };
    }

    function makeArgList(args: Argument[]): ArgumentList {
        return {
            title: "Argument Reference",
            description: "",
            isComputed: () => false,
            arguments: args,
        };
    }

    function makeDocSemanticView(args: Argument[]): DocSemanticView {
        return new DocSemanticView([
            {
                kind: "ArgumentList",
                astRef: [],
                node: makeArgList(args),
            },
        ]);
    }

    function buildCtx(view: SchemaSemanticView, docView: DocSemanticView): Context {
        const ctx = new Context();
        ctx.set(CTX_SCHEMA_SEMANTIC_VIEW, view);
        ctx.set(CTX_DOC_SEMANTIC_VIEW, docView);
        return ctx;
    }

    function collectFailureMessages(results: RuleCheckResult[]): string[] {
        const messages: string[] = [];
        for (const r of results) {
            if (!r.success) {
                messages.push(r.message);
                if (r.children) {
                    for (const child of r.children) {
                        if (!child.success) messages.push(child.message);
                    }
                }
            }
        }
        return messages;
    }

    it("should not report Computed tag as missing for computed+optional field", async () => {
        const field = makeField({
            name: "status",
            required: false,
            optional: true,
            computed: true,
            description: "The status.",
        });
        const view = makeView(new Map([["status", field]]));
        const docView = makeDocSemanticView([
            makeArg({
                name: "status",
                tags: [],
                description: "the status.",
            }),
        ]);

        const rule = new ArgumentSectionSemanticRule();
        const results = await rule.test("", undefined, buildCtx(view, docView));
        const msgs = collectFailureMessages(results);
        expect(msgs.every((m) => !m.includes("Computed"))).toBe(true);
    });

    it("should not report Computed tag as extra when doc includes it", async () => {
        const field = makeField({
            name: "status",
            required: false,
            optional: true,
            computed: true,
            description: "The status.",
        });
        const view = makeView(new Map([["status", field]]));
        const docView = makeDocSemanticView([
            makeArg({
                name: "status",
                tags: ["Computed"],
                description: "the status.",
            }),
        ]);

        const rule = new ArgumentSectionSemanticRule();
        const results = await rule.test("", undefined, buildCtx(view, docView));
        const msgs = collectFailureMessages(results);
        expect(msgs.every((m) => !m.includes("Computed"))).toBe(true);
    });

    it("should pass when description matches 'Specifies' + lowercased schema description", async () => {
        const field = makeField({
            name: "instance_id",
            description: "The ID of the dedicated instance.",
        });
        const view = makeView(new Map([["instance_id", field]]));
        const docView = makeDocSemanticView([
            makeArg({
                name: "instance_id",
                description: "the ID of the dedicated instance.",
            }),
        ]);

        const rule = new ArgumentSectionSemanticRule();
        const results = await rule.test("", undefined, buildCtx(view, docView));
        const msgs = collectFailureMessages(results);
        expect(msgs.every((m) => !m.includes("description"))).toBe(true);
    });

    it("should fail when description does not start with expected prefix", async () => {
        const field = makeField({
            name: "instance_id",
            description: "The ID of the dedicated instance.",
        });
        const view = makeView(new Map([["instance_id", field]]));
        const docView = makeDocSemanticView([
            makeArg({
                name: "instance_id",
                description: "the identifier of the instance.",
            }),
        ]);

        const rule = new ArgumentSectionSemanticRule();
        const results = await rule.test("", undefined, buildCtx(view, docView));
        const msgs = collectFailureMessages(results);
        expect(msgs.some((m) => m.includes("description should start with"))).toBe(true);
    });

    it("should lowercase only the first character of schema description", async () => {
        const field = makeField({
            name: "name",
            description: "An unique name of the resource.",
        });
        const view = makeView(new Map([["name", field]]));
        const docView = makeDocSemanticView([
            makeArg({
                name: "name",
                description: "an unique name of the resource.",
            }),
        ]);

        const rule = new ArgumentSectionSemanticRule();
        const results = await rule.test("", undefined, buildCtx(view, docView));
        const msgs = collectFailureMessages(results);
        expect(msgs.every((m) => !m.includes("description"))).toBe(true);
    });
});

describe("AttributeSectionSemanticRule", () => {
    const CTX_SCHEMA_SEMANTIC_VIEW = "resource-check.stage.schemaSemanticView";
    const CTX_DOC_SEMANTIC_VIEW = "resource-check.stage.docSemanticView";

    function makeAttrField(overrides: Partial<SemanticField> = {}): SemanticField {
        return {
            name: "test_attr",
            type: "TypeString",
            required: false,
            optional: false,
            computed: true,
            forceNew: false,
            nonUpdatable: false,
            description: "The test attribute.",
            ...overrides,
        };
    }

    function makeAttrView(attrs: Map<string, SemanticField>): SchemaSemanticView {
        return {
            resourceName: "test_resource",
            arguments: new Map(),
            attributes: attrs,
            timeouts: null,
            importInfo: { importable: false },
        };
    }

    function makeAttr(overrides: Partial<Attribute> = {}): Attribute {
        return {
            name: "test_attr",
            description: "The test attribute.",
            details: { text: "", children: [] },
            attributes: [],
            sourceRange: { start: { line: 50, column: 1 }, end: { line: 50, column: 1 } },
            ...overrides,
        };
    }

    function makeAttrList(attrs: Attribute[]): AttributeList {
        return {
            title: "Attribute Reference",
            description: "",
            attributes: attrs,
        };
    }

    function makeAttrDocSemanticView(attrs: Attribute[]): DocSemanticView {
        return new DocSemanticView([
            {
                kind: "AttributeList",
                astRef: [],
                node: makeAttrList(attrs),
            },
        ]);
    }

    function buildCtx(view: SchemaSemanticView, docView: DocSemanticView): Context {
        const ctx = new Context();
        ctx.set(CTX_SCHEMA_SEMANTIC_VIEW, view);
        ctx.set(CTX_DOC_SEMANTIC_VIEW, docView);
        return ctx;
    }

    function collectFailureMessages(results: RuleCheckResult[]): string[] {
        const messages: string[] = [];
        for (const r of results) {
            if (!r.success) {
                messages.push(r.message);
                if (r.children) {
                    for (const child of r.children) {
                        if (!child.success) messages.push(child.message);
                    }
                }
            }
        }
        return messages;
    }

    it("should pass when attribute description matches schema description", async () => {
        const field = makeAttrField({
            name: "weight",
            description: "The weight value of the channel member.",
        });
        const view = makeAttrView(new Map([["weight", field]]));
        const docView = makeAttrDocSemanticView([
            makeAttr({
                name: "weight",
                description: "The weight value of the channel member.",
            }),
        ]);

        const rule = new AttributeSectionSemanticRule();
        const results = await rule.test("", undefined, buildCtx(view, docView));
        expect(results[0].success).toBe(true);
    });

    it("should fail when attribute description does not match schema", async () => {
        const field = makeAttrField({
            name: "weight",
            description: "The weight value of the channel member.",
        });
        const view = makeAttrView(new Map([["weight", field]]));
        const docView = makeAttrDocSemanticView([
            makeAttr({
                name: "weight",
                description: "The member weight.",
            }),
        ]);

        const rule = new AttributeSectionSemanticRule();
        const results = await rule.test("", undefined, buildCtx(view, docView));
        const msgs = collectFailureMessages(results);
        expect(msgs.some((m) => m.includes("description should be"))).toBe(true);
    });

    it("should skip description check when schema has no description", async () => {
        const field = makeAttrField({
            name: "weight",
            description: "",
        });
        const view = makeAttrView(new Map([["weight", field]]));
        const docView = makeAttrDocSemanticView([
            makeAttr({
                name: "weight",
                description: "Some arbitrary text.",
            }),
        ]);

        const rule = new AttributeSectionSemanticRule();
        const results = await rule.test("", undefined, buildCtx(view, docView));
        expect(results[0].success).toBe(true);
    });

    it("should still detect missing and extra attributes alongside description checks", async () => {
        const field = makeAttrField({
            name: "create_time",
            description: "The creation time.",
        });
        const view = makeAttrView(new Map([["create_time", field]]));
        const docView = makeAttrDocSemanticView([
            makeAttr({
                name: "unknown_attr",
                description: "Something.",
            }),
        ]);

        const rule = new AttributeSectionSemanticRule();
        const results = await rule.test("", undefined, buildCtx(view, docView));
        const msgs = collectFailureMessages(results);
        expect(msgs.some((m) => m.includes("missing from the document"))).toBe(true);
        expect(msgs.some((m) => m.includes("not found in the schema"))).toBe(true);
    });
});

describe("SectionExistenceRule - intro line validation", () => {
    const CTX_SCHEMA_SEMANTIC_VIEW = "resource-check.stage.schemaSemanticView";
    const mdParser = new MarkdownParser();

    function makeView(overrides: Partial<SchemaSemanticView> = {}): SchemaSemanticView {
        return {
            resourceName: "test_resource",
            arguments: new Map([["name", {
                name: "name",
                type: "TypeString",
                required: true,
                optional: false,
                computed: false,
                forceNew: false,
                nonUpdatable: false,
                description: "The name.",
            }]]),
            attributes: new Map(),
            timeouts: null,
            importInfo: { importable: false },
            ...overrides,
        };
    }

    function buildCtx(view: SchemaSemanticView): Context {
        const ctx = new Context();
        ctx.set(CTX_SCHEMA_SEMANTIC_VIEW, view);
        return ctx;
    }

    it("should pass when Argument Reference has correct intro line", async () => {
        const md = [
            "## Argument Reference",
            "",
            "The following arguments are supported:",
            "",
            "* `name` - (Required, String) Specifies the name.",
        ].join("\n");

        const ast = mdParser.parse(md);
        const rule = new SectionExistenceRule();
        const results = await rule.test(md, ast, buildCtx(makeView()));

        const argResult = results.find((r) =>
            r.message.includes("Argument Reference"),
        );
        expect(argResult).toBeDefined();
        expect(argResult!.success).toBe(true);
        expect(argResult!.message).toContain("correct intro line");
    });

    it("should fail when Argument Reference has wrong intro line", async () => {
        const md = [
            "## Argument Reference",
            "",
            "These are the arguments:",
            "",
            "* `name` - (Required, String) Specifies the name.",
        ].join("\n");

        const ast = mdParser.parse(md);
        const rule = new SectionExistenceRule();
        const results = await rule.test(md, ast, buildCtx(makeView()));

        const argResult = results.find((r) =>
            r.message.includes("Argument Reference") && !r.success,
        );
        expect(argResult).toBeDefined();
        expect(argResult!.success).toBe(false);
        expect(argResult!.message).toContain("intro line should be");
        expect(argResult!.message).toContain("The following arguments are supported:");
    });

    it("should fail when Argument Reference has no paragraph before list", async () => {
        const md = [
            "## Argument Reference",
            "",
            "* `name` - (Required, String) Specifies the name.",
        ].join("\n");

        const ast = mdParser.parse(md);
        const rule = new SectionExistenceRule();
        const results = await rule.test(md, ast, buildCtx(makeView()));

        const argResult = results.find((r) =>
            r.message.includes("Argument Reference") && !r.success,
        );
        expect(argResult).toBeDefined();
        expect(argResult!.success).toBe(false);
        expect(argResult!.message).toContain("missing the required intro line");
    });

    it("should pass when Attribute Reference has correct intro line", async () => {
        const view = makeView({
            attributes: new Map([["id", {
                name: "id",
                type: "TypeString",
                required: false,
                optional: false,
                computed: true,
                forceNew: false,
                nonUpdatable: false,
                description: "The ID.",
            }]]),
        });

        const md = [
            "## Argument Reference",
            "",
            "The following arguments are supported:",
            "",
            "* `name` - (Required, String) Specifies the name.",
            "",
            "## Attribute Reference",
            "",
            "In addition to all arguments above, the following attributes are exported:",
            "",
            "* `id` - The ID.",
        ].join("\n");

        const ast = mdParser.parse(md);
        const rule = new SectionExistenceRule();
        const results = await rule.test(md, ast, buildCtx(view));

        const attrResult = results.find((r) =>
            r.message.includes("Attribute Reference"),
        );
        expect(attrResult).toBeDefined();
        expect(attrResult!.success).toBe(true);
        expect(attrResult!.message).toContain("correct intro line");
    });

    it("should fail when Attribute Reference has wrong intro line", async () => {
        const view = makeView({
            attributes: new Map([["id", {
                name: "id",
                type: "TypeString",
                required: false,
                optional: false,
                computed: true,
                forceNew: false,
                nonUpdatable: false,
                description: "The ID.",
            }]]),
        });

        const md = [
            "## Argument Reference",
            "",
            "The following arguments are supported:",
            "",
            "* `name` - (Required, String) Specifies the name.",
            "",
            "## Attribute Reference",
            "",
            "The following attributes are exported:",
            "",
            "* `id` - The ID.",
        ].join("\n");

        const ast = mdParser.parse(md);
        const rule = new SectionExistenceRule();
        const results = await rule.test(md, ast, buildCtx(view));

        const attrResult = results.find((r) =>
            r.message.includes("Attribute Reference") && !r.success,
        );
        expect(attrResult).toBeDefined();
        expect(attrResult!.success).toBe(false);
        expect(attrResult!.message).toContain("intro line should be");
        expect(attrResult!.message).toContain(
            "In addition to all arguments above, the following attributes are exported:",
        );
    });

    it("should fail when Attribute Reference has no paragraph before list", async () => {
        const view = makeView({
            attributes: new Map([["id", {
                name: "id",
                type: "TypeString",
                required: false,
                optional: false,
                computed: true,
                forceNew: false,
                nonUpdatable: false,
                description: "The ID.",
            }]]),
        });

        const md = [
            "## Argument Reference",
            "",
            "The following arguments are supported:",
            "",
            "* `name` - (Required, String) Specifies the name.",
            "",
            "## Attribute Reference",
            "",
            "* `id` - The ID.",
        ].join("\n");

        const ast = mdParser.parse(md);
        const rule = new SectionExistenceRule();
        const results = await rule.test(md, ast, buildCtx(view));

        const attrResult = results.find((r) =>
            r.message.includes("Attribute Reference") && !r.success,
        );
        expect(attrResult).toBeDefined();
        expect(attrResult!.success).toBe(false);
        expect(attrResult!.message).toContain("missing the required intro line");
    });
});
