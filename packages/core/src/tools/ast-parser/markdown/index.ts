/**
 * Markdown AST Parser Module
 *
 * CommonMark compliant parser that converts markdown text into an AST.
 *
 * @example
 * ```typescript
 * import { MarkdownParser } from "@code-check/core";
 *
 * const parser = new MarkdownParser();
 * const doc = parser.parse("# Hello\n\nParagraph text.");
 *
 * // Semantic queries
 * const body    = parser.getBodyChildren(doc);
 * const section = parser.getSection(doc, 2, "Example Usage");
 * const next    = parser.getNextSibling(doc, heading, n => n.type === "paragraph");
 *
 * // Convenience accessors
 * const headings   = parser.getHeadings(doc);
 * const codeBlocks = parser.getCodeBlocks(doc);
 * const fm         = parser.getFrontmatter(doc);
 * ```
 *
 * @module ast-parser/markdown
 */

export { MarkdownParser } from "./parser";
export type {
    MarkdownNode,
    MarkdownNodeType,
    ListType,
    SourcePosition,
    SourceRange,
    WalkEvent,
    NodeVisitor,
    TypedVisitors,
    ParserOptions,
    CommonMarkNode,
} from "./types";
