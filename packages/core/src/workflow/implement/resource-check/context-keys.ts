/**
 * Context keys for ResourceCheckWorkflow stage artifacts.
 */

/** Parsed ResourceCheckInput object */
export const CTX_INPUT = "resource-check.stage.input";

/** Resolved implement go file path */
export const CTX_IMPLEMENT_GO_PATH = "resource-check.stage.implementGoPath";

/** Resolved markdown doc file path */
export const CTX_DOC_MD_PATH = "resource-check.stage.docMdPath";

/** Resolved go test file path */
export const CTX_TEST_GO_PATH = "resource-check.stage.testGoPath";

/** Loaded implement go source content */
export const CTX_IMPLEMENT_GO_SOURCE = "resource-check.stage.implementGoSource";

/** Loaded markdown source content */
export const CTX_DOC_MD_SOURCE = "resource-check.stage.docMdSource";

/** Loaded go test source content */
export const CTX_TEST_GO_SOURCE = "resource-check.stage.testGoSource";

/** Extracted ResourceSchema[] from implement go source */
export const CTX_IMPLEMENT_GO_SCHEMAS = "resource-check.stage.implementGoSchemas";

/** Parsed markdown AST */
export const CTX_DOC_MARKDOWN_AST = "resource-check.stage.docMarkdownAst";

/** Parsed frontmatter object from markdown doc */
export const CTX_DOC_FRONTMATTER = "resource-check.stage.docFrontmatter";

/** Resource name extracted from frontmatter page_title */
export const CTX_DOC_RESOURCE_NAME = "resource-check.stage.docResourceName";

/** Extracted DocStructure from markdown doc */
export const CTX_DOC_STRUCTURE = "resource-check.stage.docStructure";

/** Schema semantic view for doc validation (SchemaSemanticView) */
export const CTX_SCHEMA_SEMANTIC_VIEW = "resource-check.stage.schemaSemanticView";

/** Go test extraction summary */
export const CTX_TEST_GO_SUMMARY = "resource-check.stage.testGoSummary";

/** HCL stage status message */
export const CTX_HCL_STAGE_STATUS = "resource-check.stage.hclStatus";
