import fs from "fs/promises";
import { Workflow, type WorkflowStage } from "../../workflow";
import { GoParser, TerraformSchemaExtractor } from "../../../tools/ast-parser/go";
import type { ResourceSchema } from "../../../tools/ast-parser/go";
import { MarkdownParser } from "../../../tools/ast-parser/markdown";
import {
    parseResourceCheckInput,
    resolveResourcePaths,
} from "./types";
import type { ResourceCheckInput } from "./types";
import {
    CTX_DOC_MARKDOWN_AST,
    CTX_DOC_MD_PATH,
    CTX_DOC_MD_SOURCE,
    CTX_HCL_STAGE_STATUS,
    CTX_IMPLEMENT_GO_PATH,
    CTX_IMPLEMENT_GO_SCHEMAS,
    CTX_IMPLEMENT_GO_SOURCE,
    CTX_INPUT,
    CTX_TEST_GO_PATH,
    CTX_TEST_GO_SOURCE,
    CTX_TEST_GO_SUMMARY,
} from "./context-keys";
import { StagePlaceholderRule } from "./rules";

interface GoTestSummary {
    functionCount: number;
    testFunctionCount: number;
}

export class ResourceCheckWorkflow extends Workflow {
    public readonly id = "resource-check";
    public readonly description =
        "Staged checks for resource implement/doc/test files (Go + Markdown + HCL)";

    private readonly markdownParser = new MarkdownParser();

    protected defineStages(): WorkflowStage[] {
        return [
            this.stageResolveResourceFiles(),
            this.stageExtractGoSchema(),
            this.stageCheckGoImplement(),
            this.stageCheckMarkdownFormat(),
            this.stageCheckMarkdownSemantic(),
            this.stageExtractGoTest(),
            this.stageCheckGoTest(),
            this.stageCheckGoTestHclStyle(),
        ];
    }

    // ── Stage 1: resolve-resource-files ──

    private stageResolveResourceFiles(): WorkflowStage {
        return {
            id: "resolve-resource-files",
            description: "Parse input and resolve resource file paths",
            execute: async (runtime) => {
                const input = parseResourceCheckInput(runtime.code);
                runtime.setArtifact(CTX_INPUT, input);

                const paths = resolveResourcePaths(input);
                runtime.setArtifact(CTX_IMPLEMENT_GO_PATH, paths.implementGoPath);
                runtime.setArtifact(CTX_DOC_MD_PATH, paths.docMdPath);
                runtime.setArtifact(CTX_TEST_GO_PATH, paths.testGoPath);

                const [goSrc, mdSrc, testSrc] = await Promise.all([
                    readFileIfExists(paths.implementGoPath),
                    readFileIfExists(paths.docMdPath),
                    readFileIfExists(paths.testGoPath),
                ]);

                runtime.setArtifact(CTX_IMPLEMENT_GO_SOURCE, goSrc ?? "");
                runtime.setArtifact(CTX_DOC_MD_SOURCE, mdSrc ?? "");
                runtime.setArtifact(CTX_TEST_GO_SOURCE, testSrc ?? "");
            },
        };
    }

    // ── Stage 2: extract-go-schema ──

    private stageExtractGoSchema(): WorkflowStage {
        return {
            id: "extract-go-schema",
            description: "Extract Terraform schema from implement go file",
            execute: async (runtime) => {
                const source = runtime.getArtifact<string>(CTX_IMPLEMENT_GO_SOURCE) ?? "";
                if (!source.trim()) {
                    runtime.setArtifact<ResourceSchema[]>(CTX_IMPLEMENT_GO_SCHEMAS, []);
                    return;
                }

                const parser = await GoParser.create();
                try {
                    const extractor = new TerraformSchemaExtractor(parser);
                    const schemas = extractor.extract(source);
                    runtime.setArtifact(CTX_IMPLEMENT_GO_SCHEMAS, schemas);
                } finally {
                    parser.dispose();
                }
            },
        };
    }

    // ── Stage 3: check-go-implement ──

    private stageCheckGoImplement(): WorkflowStage {
        return {
            id: "check-go-implement",
            description: "Structured checks for implement go file",
            execute: async (runtime) => {
                const goPath = runtime.getArtifact<string>(CTX_IMPLEMENT_GO_PATH) ?? "";
                const source = runtime.getArtifact<string>(CTX_IMPLEMENT_GO_SOURCE) ?? "";
                const schemas = runtime.getArtifact<ResourceSchema[]>(CTX_IMPLEMENT_GO_SCHEMAS) ?? [];
                const missing = !source.trim();

                const message = missing
                    ? `Implement file is missing or empty: ${goPath}`
                    : `Implement check placeholder: extracted ${schemas.length} schema(s)`;

                await runtime.runRules({
                    rules: [
                        new StagePlaceholderRule({
                            name: "implement-structured-check",
                            description: "Structured check for implement go file",
                            message,
                            success: !missing,
                        }),
                    ],
                    strategy: "shared",
                });
            },
        };
    }

    // ── Stage 4: check-markdown-format ──

    private stageCheckMarkdownFormat(): WorkflowStage {
        return {
            id: "check-markdown-format",
            description: "Markdown format checks without semantic context",
            execute: async (runtime) => {
                const docPath = runtime.getArtifact<string>(CTX_DOC_MD_PATH) ?? "";
                const source = runtime.getArtifact<string>(CTX_DOC_MD_SOURCE) ?? "";
                const missing = !source.trim();

                if (!missing) {
                    const ast = this.markdownParser.parse(source);
                    runtime.setArtifact(CTX_DOC_MARKDOWN_AST, ast);
                }

                const message = missing
                    ? `Document file is missing or empty: ${docPath}`
                    : "Markdown format check placeholder (without semantic context)";

                await runtime.runRules({
                    rules: [
                        new StagePlaceholderRule({
                            name: "doc-format-check",
                            description: "Markdown format checks without semantic context",
                            message,
                            success: !missing,
                        }),
                    ],
                    strategy: "shared",
                });
            },
        };
    }

    // ── Stage 5: check-markdown-semantic ──

    private stageCheckMarkdownSemantic(): WorkflowStage {
        return {
            id: "check-markdown-semantic",
            description: "Markdown checks with semantic context from go schema",
            execute: async (runtime) => {
                const source = runtime.getArtifact<string>(CTX_DOC_MD_SOURCE) ?? "";
                const schemas = runtime.getArtifact<ResourceSchema[]>(CTX_IMPLEMENT_GO_SCHEMAS) ?? [];
                const missingDoc = !source.trim();
                const missingSemantic = schemas.length === 0;
                const success = !missingDoc && !missingSemantic;

                const message = missingDoc
                    ? "Semantic doc check skipped: markdown source missing"
                    : missingSemantic
                        ? "Semantic doc check placeholder: go schema extraction context missing"
                        : `Semantic doc check placeholder: ${schemas.length} schema(s) available`;

                await runtime.runRules({
                    rules: [
                        new StagePlaceholderRule({
                            name: "doc-semantic-check",
                            description: "Markdown checks with semantic context",
                            message,
                            success,
                        }),
                    ],
                    strategy: "shared",
                });
            },
        };
    }

    // ── Stage 6: extract-go-test ──

    private stageExtractGoTest(): WorkflowStage {
        return {
            id: "extract-go-test",
            description: "Extract go test structure",
            execute: async (runtime) => {
                const source = runtime.getArtifact<string>(CTX_TEST_GO_SOURCE) ?? "";
                if (!source.trim()) {
                    runtime.setArtifact<GoTestSummary>(CTX_TEST_GO_SUMMARY, {
                        functionCount: 0,
                        testFunctionCount: 0,
                    });
                    return;
                }

                const parser = await GoParser.create();
                try {
                    const tree = parser.parse(source);
                    const funcs = parser.findByType(tree.rootNode, "function_declaration");
                    const testFuncCount = funcs.filter((fn) => {
                        const nameNode = fn.childForFieldName("name");
                        return /^Test[A-Z0-9_]/.test(nameNode?.text ?? "");
                    }).length;

                    runtime.setArtifact<GoTestSummary>(CTX_TEST_GO_SUMMARY, {
                        functionCount: funcs.length,
                        testFunctionCount: testFuncCount,
                    });
                    tree.delete();
                } finally {
                    parser.dispose();
                }
            },
        };
    }

    // ── Stage 7: check-go-test ──

    private stageCheckGoTest(): WorkflowStage {
        return {
            id: "check-go-test",
            description: "Structured checks for go test file",
            execute: async (runtime) => {
                const testPath = runtime.getArtifact<string>(CTX_TEST_GO_PATH) ?? "";
                const source = runtime.getArtifact<string>(CTX_TEST_GO_SOURCE) ?? "";
                const summary = runtime.getArtifact<GoTestSummary>(CTX_TEST_GO_SUMMARY) ?? {
                    functionCount: 0,
                    testFunctionCount: 0,
                };
                const missing = !source.trim();

                const message = missing
                    ? `Go test file is missing or empty: ${testPath}`
                    : `Go test check placeholder: ${summary.functionCount} function(s), ` +
                      `${summary.testFunctionCount} test function(s)`;

                await runtime.runRules({
                    rules: [
                        new StagePlaceholderRule({
                            name: "test-go-structured-check",
                            description: "Structured check for go test file",
                            message,
                            success: !missing,
                        }),
                    ],
                    strategy: "shared",
                });
            },
        };
    }

    // ── Stage 8: check-go-test-hcl-style ──

    private stageCheckGoTestHclStyle(): WorkflowStage {
        return {
            id: "check-go-test-hcl-style",
            description: "Run existing go test hcl style script when configured",
            execute: async (runtime) => {
                const status =
                    "HCL style check script is not configured yet; stage kept as placeholder";
                runtime.setArtifact(CTX_HCL_STAGE_STATUS, status);

                await runtime.runRules({
                    rules: [
                        new StagePlaceholderRule({
                            name: "test-hcl-style-check",
                            description: "Go test HCL style check",
                            message: status,
                            success: false,
                        }),
                    ],
                    strategy: "shared",
                });
            },
        };
    }
}

async function readFileIfExists(filePath: string): Promise<string | undefined> {
    try {
        return await fs.readFile(filePath, "utf-8");
    } catch {
        return undefined;
    }
}
