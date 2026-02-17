import { Feature, FeatureMatch } from "../feature";
import { MarkdownParser, MarkdownNode } from "../../../../tools/ast-parser/markdown";

/**
 * Predicate function type for matching AST nodes.
 */
export type NodePredicate = (node: MarkdownNode) => boolean;

/**
 * Adapter to convert MarkdownNode to FeatureMatch.
 */
class AstNodeAdapter {
    /**
     * Convert a MarkdownNode to a FeatureMatch.
     * 
     * @param node - The AST node
     * @param sourceCode - The original source code
     * @returns A FeatureMatch object
     */
    public static toFeatureMatch(
        node: MarkdownNode,
        sourceCode: string
    ): FeatureMatch {
        const start = node.sourceRange?.start ?? { line: 1, column: 1 };
        const end = node.sourceRange?.end ?? { line: 1, column: 1 };

        // Extract text from source code using position info
        const text = this.extractTextFromNode(node, sourceCode);

        return {
            node: node,
            start: {
                line: start.line,
                column: start.column,
            },
            end: {
                line: end.line,
                column: end.column,
            },
            text: text,
            metadata: {
                type: node.type,
                level: node.level,
                listType: node.listType,
                info: node.info,
                destination: node.destination,
                title: node.title,
            },
        };
    }

    /**
     * Extract text content from a node based on its position in source code.
     * 
     * @param node - The AST node
     * @param sourceCode - The original source code
     * @returns The text content of the node
     */
    private static extractTextFromNode(
        node: MarkdownNode,
        sourceCode: string
    ): string {
        if (!node.sourceRange) {
            return node.literal || "";
        }

        const lines = sourceCode.split(/\r?\n/);
        const startLine = node.sourceRange.start.line - 1; // Convert to 0-based
        const endLine = node.sourceRange.end.line - 1;
        const startColumn = node.sourceRange.start.column - 1;
        const endColumn = node.sourceRange.end.column - 1;

        if (startLine === endLine) {
            // Single line
            return lines[startLine]?.substring(startColumn, endColumn + 1) || "";
        } else {
            // Multiple lines
            const result: string[] = [];
            for (let i = startLine; i <= endLine; i++) {
                if (i === startLine) {
                    result.push(lines[i]?.substring(startColumn) || "");
                } else if (i === endLine) {
                    result.push(lines[i]?.substring(0, endColumn + 1) || "");
                } else {
                    result.push(lines[i] || "");
                }
            }
            return result.join("\n");
        }
    }
}

/**
 * AST-based Feature using node predicate matching.
 * 
 * This Feature uses MarkdownParser to traverse the AST and find nodes
 * that match a given predicate function. It requires a parsed AST to work.
 * 
 * @example
 * ```typescript
 * // Find all level 1 headings
 * const h1Feature = new AstMatcherFeature(
 *     "find-h1",
 *     "Find all H1 headings",
 *     (node) => node.type === "heading" && node.level === 1
 * );
 * 
 * const ast = parser.parse(markdown);
 * const matches = h1Feature.detect(ast, markdown);
 * ```
 * 
 * @example
 * ```typescript
 * // Find all code blocks with specific language
 * const tsCodeFeature = new AstMatcherFeature(
 *     "find-ts-code",
 *     "Find TypeScript code blocks",
 *     (node) => node.type === "code_block" && node.info === "typescript"
 * );
 * ```
 * 
 * @example
 * ```typescript
 * // Find all links
 * const linkFeature = new AstMatcherFeature(
 *     "find-links",
 *     "Find all links in markdown",
 *     (node) => node.type === "link"
 * );
 * ```
 */
export class AstMatcherFeature extends Feature {
    private readonly parser: MarkdownParser;
    private readonly predicate: NodePredicate;

    /**
     * Creates a new AstMatcherFeature instance.
     * 
     * @param id - Unique identifier for this feature
     * @param description - Human-readable description
     * @param predicate - Function that returns true for matching nodes
     */
    public constructor(
        id: string,
        description: string,
        predicate: NodePredicate
    ) {
        super(id, description);
        this.parser = new MarkdownParser();
        this.predicate = predicate;
    }

    /**
     * Detects matching nodes in the AST using the predicate function.
     * 
     * @param ast - The parsed AST (should be a MarkdownNode)
     * @param sourceCode - The original source code
     * @returns Array of matches found in the AST
     */
    public detect(ast: unknown, sourceCode: string): FeatureMatch[] {
        if (!ast) {
            return [];
        }

        // If ast is not a MarkdownNode, try to parse it
        let mdAst: MarkdownNode;
        if (this.isMarkdownNode(ast)) {
            mdAst = ast;
        } else if (typeof ast === "string") {
            mdAst = this.parser.parse(ast);
        } else {
            // Assume it's already a parsed AST
            mdAst = ast as MarkdownNode;
        }

        const nodes = this.parser.findAll(mdAst, this.predicate);

        return nodes.map((node) =>
            AstNodeAdapter.toFeatureMatch(node, sourceCode)
        );
    }

    /**
     * Type guard to check if an object is a MarkdownNode.
     */
    private isMarkdownNode(obj: unknown): obj is MarkdownNode {
        return (
            typeof obj === "object" &&
            obj !== null &&
            "type" in obj &&
            "children" in obj
        );
    }
}
