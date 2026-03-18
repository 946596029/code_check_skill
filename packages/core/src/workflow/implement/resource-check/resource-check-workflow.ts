import fs from "fs/promises";
import { Workflow, type WorkflowStage } from "../../workflow";
import { Rule, RuleCheckResult } from "../../types/rule/rule";
import type { Context } from "../../context/context";
import { GoParser } from "../../../tools/ast-parser/go";
import { TerraformSchemaExtractor } from "./tools/terraform-schema";
import type { ResourceSchema } from "./tools/terraform-schema";
import { MarkdownParser } from "../../../tools/ast-parser/markdown";
import type { MarkdownNode } from "../../../tools/ast-parser/markdown";
import { buildDocSemanticView, DocSemanticView } from "./tools/doc-semantic";
import {
    parseResourceCheckInput,
    resolveResourcePaths,
} from "./types";
import { buildSchemaSemanticView } from "./tools/schema-semantic";
import {
    CTX_DOC_MARKDOWN_AST,
    CTX_DOC_MD_PATH,
    CTX_DOC_MD_SOURCE,
    CTX_DOC_SEMANTIC_VIEW,
    CTX_HCL_STAGE_STATUS,
    CTX_IMPLEMENT_GO_PATH,
    CTX_IMPLEMENT_GO_SCHEMAS,
    CTX_IMPLEMENT_GO_SOURCE,
    CTX_INPUT,
    CTX_SCHEMA_SEMANTIC_VIEW,
    CTX_TEST_GO_PATH,
    CTX_TEST_GO_SOURCE,
    CTX_TEST_GO_SUMMARY,
} from "./context-keys";
import { StagePlaceholderRule } from "./rules";
import { MARKDOWN_FORMAT_RULES } from "./rules/markdown-format";
import { MARKDOWN_SEMANTIC_RULES } from "./rules/markdown-semantic";

interface GoTestSummary {
    functionCount: number;
    testFunctionCount: number;
}

export class ResourceCheckWorkflow extends Workflow {
    public readonly id = "resource-check";
    public readonly description =
        "Staged checks for resource implement/doc/test files (Go + Markdown + HCL)";

    private readonly markdownParser = new MarkdownParser();

    protected override async executeRule(
        rule: Rule,
        ctx?: Context
    ): Promise<RuleCheckResult[]> {
        const ast = ctx?.get<MarkdownNode>(CTX_DOC_MARKDOWN_AST)
            ?? this.context.get<MarkdownNode>(CTX_DOC_MARKDOWN_AST);
        return rule.test(this.code, ast ?? undefined, ctx);
    }

    protected defineStages(): WorkflowStage[] {
        return [
            this.stageResolveResourceFiles(),
            this.stageExtractGoSchema(),
            this.stageExtractDocStructure(),
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

    // ── Stage 3: extract-doc-structure ──

    private stageExtractDocStructure(): WorkflowStage {
        return {
            id: "extract-doc-structure",
            description: "Parse markdown and extract document structure",
            execute: async (runtime) => {
                const source = runtime.getArtifact<string>(CTX_DOC_MD_SOURCE) ?? "";
                if (!source.trim()) {
                    runtime.setArtifact(CTX_DOC_SEMANTIC_VIEW, new DocSemanticView());
                    return;
                }

                const ast = this.markdownParser.parse(source);
                runtime.setArtifact(CTX_DOC_MARKDOWN_AST, ast);
                const docSemanticView = buildDocSemanticView(
                    ast,
                    source,
                    this.markdownParser,
                );
                runtime.setArtifact(CTX_DOC_SEMANTIC_VIEW, docSemanticView);
            },
        };
    }

    // ── Stage 4: check-go-implement ──

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

    // ── Stage 5: check-markdown-format ──

    private stageCheckMarkdownFormat(): WorkflowStage {
        return {
            id: "check-markdown-format",
            description: "Markdown format checks without semantic context",
            execute: async (runtime) => {
                const source = runtime.getArtifact<string>(CTX_DOC_MD_SOURCE) ?? "";
                const ast = runtime.getArtifact<MarkdownNode>(CTX_DOC_MARKDOWN_AST);

                if (!ast || !source.trim()) {
                    const docPath = runtime.getArtifact<string>(CTX_DOC_MD_PATH) ?? "";
                    await runtime.runRules({
                        rules: [
                            new StagePlaceholderRule({
                                name: "doc-format-check",
                                description: "Markdown format checks without semantic context",
                                message: `Document file is missing or empty: ${docPath}`,
                                success: false,
                            }),
                        ],
                        strategy: "shared",
                    });
                    return;
                }

                const savedCode = runtime.code;
                runtime.updateCode(source);

                const checkCtx = runtime.createChildContext();
                checkCtx.set(CTX_DOC_MARKDOWN_AST, ast);

                try {
                    await runtime.runRules({
                        rules: MARKDOWN_FORMAT_RULES,
                        baseContext: checkCtx,
                        strategy: "shared",
                    });
                } finally {
                    runtime.updateCode(savedCode);
                }
            },
        };
    }

    // ── Stage 6: check-markdown-semantic ──

    private stageCheckMarkdownSemantic(): WorkflowStage {
        return {
            id: "check-markdown-semantic",
            description: "Build schema semantic view and run doc-semantic rules",
            execute: async (runtime) => {
                const source = runtime.getArtifact<string>(CTX_DOC_MD_SOURCE) ?? "";
                const schemas = runtime.getArtifact<ResourceSchema[]>(CTX_IMPLEMENT_GO_SCHEMAS) ?? [];
                const missingDoc = !source.trim();
                const missingSemantic = schemas.length === 0;

                if (missingDoc || missingSemantic) {
                    const message = missingDoc
                        ? "Semantic doc check skipped: markdown source missing"
                        : "Semantic doc check skipped: go schema extraction context missing";

                    await runtime.runRules({
                        rules: [
                            new StagePlaceholderRule({
                                name: "doc-semantic-check",
                                description: "Markdown checks with semantic context",
                                message,
                                success: false,
                            }),
                        ],
                        strategy: "shared",
                    });
                    return;
                }

                const view = buildSchemaSemanticView(schemas[0]);
                runtime.setArtifact(CTX_SCHEMA_SEMANTIC_VIEW, view);

                const ast = runtime.getArtifact<MarkdownNode>(CTX_DOC_MARKDOWN_AST);
                const docSemanticView = runtime.getArtifact<DocSemanticView>(
                    CTX_DOC_SEMANTIC_VIEW,
                );

                const checkCtx = runtime.createChildContext();
                checkCtx.set(CTX_SCHEMA_SEMANTIC_VIEW, view);
                checkCtx.set(CTX_DOC_SEMANTIC_VIEW, docSemanticView);
                checkCtx.set(CTX_DOC_MARKDOWN_AST, ast);

                const savedCode = runtime.code;
                runtime.updateCode(source);

                try {
                    await runtime.runRules({
                        rules: MARKDOWN_SEMANTIC_RULES,
                        baseContext: checkCtx,
                        strategy: "shared",
                    });
                } finally {
                    runtime.updateCode(savedCode);
                }
            },
        };
    }

    // ── Stage 7: extract-go-test ──

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

    // ── Stage 8: check-go-test ──

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

    // ── Stage 9: check-go-test-hcl-style ──

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

