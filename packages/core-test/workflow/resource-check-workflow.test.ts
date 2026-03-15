import { describe, it, expect, beforeEach } from "vitest";
import path from "path";
import {
    CodeChecker,
    ResourceCheckWorkflow,
    parseResourceCheckInput,
    resolveResourcePaths,
} from "@code-check/core";
import type { ResourceCheckInput, CheckReport } from "@code-check/core";

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

    beforeEach(async () => {
        checker = new CodeChecker();
        await checker.initialize();
        checker.registerWorkflow(new ResourceCheckWorkflow());
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

    it("should run all 8 stages and produce results for real resource files", async () => {
        const input = makeInput();
        const report = await checker.check({
            code: toCode(input),
            workflowId: "resource-check",
        });

        expect(report.workflowId).toBe("resource-check");

        const names = report.results.map((r) => r.ruleName);
        expect(names).toContain("implement-structured-check");
        expect(names).toContain("doc-format-check");
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
});
