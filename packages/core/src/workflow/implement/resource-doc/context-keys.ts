/**
 * Context keys for ResourceDocWorkflow.
 * Rules share data via these keys to avoid re-parsing and enable cross-rule coordination.
 */

/** Parsed frontmatter object (page_title, description, etc.) */
export const CTX_FRONTMATTER = "resource-doc.frontmatter";

/** Resource name extracted from frontmatter page_title (e.g. "aws_instance") */
export const CTX_RESOURCE_NAME = "resource-doc.resourceName";

/** Expected description from frontmatter, normalized for comparison */
export const CTX_EXPECTED_DESCRIPTION = "resource-doc.expectedDescription";

/** Actual H1 title text extracted from AST */
export const CTX_H1_TITLE = "resource-doc.h1Title";

/** Description text content under the H1 paragraph node */
export const CTX_H1_DESC_TEXT = "resource-doc.h1DescText";

