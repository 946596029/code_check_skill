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

/** Lines of the "## Argument Reference" section (string[]) */
export const CTX_ARG_REF_LINES = "resource-doc.argRefLines";

/** 1-based line number where the Argument Reference section content starts */
export const CTX_ARG_REF_START_LINE = "resource-doc.argRefStartLine";

/** Bullet-list AST nodes (type "list") inside the Argument Reference section */
export const CTX_ARG_REF_BULLET_LISTS = "resource-doc.argRefBulletLists";

/** Actual H1 title text extracted from AST */
export const CTX_H1_TITLE = "resource-doc.h1Title";

/** Description text content under the H1 paragraph node */
export const CTX_H1_DESC_TEXT = "resource-doc.h1DescText";

/** Lines of the H1 section, excluding the heading line (string[]) */
export const CTX_H1_SECTION_LINES = "resource-doc.h1SectionLines";

/** 1-based line number where H1 section content starts */
export const CTX_H1_SECTION_START_LINE = "resource-doc.h1SectionStartLine";

/** Lines of the "## Attributes Reference" section (string[]) */
export const CTX_ATTR_REF_LINES = "resource-doc.attrRefLines";

/** 1-based line number where the Attributes Reference section content starts */
export const CTX_ATTR_REF_START_LINE = "resource-doc.attrRefStartLine";

/** Bullet-list AST nodes (type "list") inside the Attributes Reference section */
export const CTX_ATTR_REF_BULLET_LISTS = "resource-doc.attrRefBulletLists";
