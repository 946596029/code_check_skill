/**
 * Markdown AST Parser Module
 *
 * This module provides a CommonMark compliant markdown parser that converts
 * markdown text into an Abstract Syntax Tree (AST) for analysis and manipulation.
 *
 * The parser uses commonmark.js, the official reference implementation of the
 * CommonMark specification.
 *
 * @example
 * ```typescript
 * import { MarkdownParser } from "@code-check/core";
 *
 * const parser = new MarkdownParser();
 * const ast = parser.parse(`
 * # Hello World
 *
 * This is a **paragraph** with [a link](https://example.com).
 *
 * \`\`\`typescript
 * const x = 1;
 * \`\`\`
 * `);
 *
 * // Get all headings
 * const headings = parser.getHeadings(ast);
 * console.log(headings); // [{ level: 1, text: "Hello World", node: {...} }]
 *
 * // Get all code blocks
 * const codeBlocks = parser.getCodeBlocks(ast);
 * console.log(codeBlocks); // [{ language: "typescript", code: "const x = 1;\n", node: {...} }]
 *
 * // Walk the AST
 * parser.walk(ast, (node, entering) => {
 *     if (entering && node.type === "link") {
 *         console.log(`Found link: ${node.destination}`);
 *     }
 * });
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
