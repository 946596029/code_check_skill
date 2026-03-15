import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "path";
import {
    CodeChecker,
    ResourceCheckWorkflow,
    parseResourceCheckInput,
    resolveResourcePaths,
    buildSchemaSemanticView,
    GoParser,
    TerraformSchemaExtractor,
    TerraformSchemaSemanticNormalizer,
} from "@code-check/core";
import type {
    ResourceCheckInput,
    CheckReport,
    DocStructure,
    SchemaSemanticView,
    ResourceSchema,
} from "@code-check/core";

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
            /resource_terraform_provider_example_apig_channel_member\.go$/
        );
        expect(paths.docMdPath).toContain(path.join("docs", "resources"));
        expect(paths.docMdPath).toMatch(/apig_channel_member\.md$/);
        expect(paths.testGoPath).toContain("acceptance");
        expect(paths.testGoPath).toMatch(
            /resource_terraform_provider_example_apig_channel_member_test\.go$/
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
    let workflow: ResourceCheckWorkflow;

    beforeEach(async () => {
        checker = new CodeChecker();
        await checker.initialize();
        workflow = new ResourceCheckWorkflow();
        checker.registerWorkflow(workflow);
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

    it("should run all 9 stages and produce results for real resource files", async () => {
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
        expect(names).toContain("doc-semantic-check");
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
