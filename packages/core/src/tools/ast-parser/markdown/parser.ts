import { Parser, Node, NodeWalker } from "commonmark";
import { parse as parseYaml } from "yaml";
import type {
    MarkdownNode,
    MarkdownNodeType,
    ListType,
    SourceRange,
    ParserOptions,
    WalkEvent,
    NodeVisitor,
    TypedVisitors,
} from "./types";

/**
 * Pattern to match YAML front-matter block at the start of the document.
 * Captures the YAML content between the opening and closing `---` fences.
 */
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---/;

/**
 * Convert commonmark Node to simplified MarkdownNode
 */
function convertNode(node: Node): MarkdownNode {
    const sourceRange: SourceRange | null = node.sourcepos
        ? {
              start: {
                  line: node.sourcepos[0][0],
                  column: node.sourcepos[0][1],
              },
              end: {
                  line: node.sourcepos[1][0],
                  column: node.sourcepos[1][1],
              },
          }
        : null;

    const markdownNode: MarkdownNode = {
        type: node.type as MarkdownNodeType,
        literal: node.literal,
        destination: node.destination,
        title: node.title,
        info: node.info,
        level: node.level,
        listType: node.listType as ListType | null,
        listTight: node.listTight,
        listStart: node.listStart,
        listDelimiter: node.listDelimiter,
        data: null,
        sourceRange,
        children: [],
    };

    // Convert children
    let child = node.firstChild;
    while (child) {
        markdownNode.children.push(convertNode(child));
        child = child.next;
    }

    return markdownNode;
}

/**
 * MarkdownParser - CommonMark compliant markdown AST parser
 *
 * This parser uses the official commonmark.js library which is the reference
 * implementation of the CommonMark specification.
 *
 * @example
 * ```typescript
 * const parser = new MarkdownParser();
 * const ast = parser.parse("# Hello World\n\nThis is a paragraph.");
 *
 * // Walk the AST
 * parser.walk(ast, (node, entering) => {
 *     if (entering && node.type === "heading") {
 *         console.log(`Found heading level ${node.level}`);
 *     }
 * });
 * ```
 */
export class MarkdownParser {
    private parser: Parser;
    private enableFrontmatter: boolean;

    /**
     * Create a new MarkdownParser instance
     *
     * @param options - Parser configuration options
     */
    public constructor(options: ParserOptions = {}) {
        this.parser = new Parser({
            smart: options.smart ?? false,
        });
        this.enableFrontmatter = options.enableFrontmatter ?? true;
    }

    /**
     * Parse markdown text into an AST
     *
     * When front-matter parsing is enabled (default), the leading
     * `---...---` YAML block is extracted, parsed, and inserted as a
     * "frontmatter" node at the beginning of the document's children.
     *
     * @param markdown - The markdown text to parse
     * @returns The root node of the AST (document node)
     */
    public parse(markdown: string): MarkdownNode {
        let frontmatterNode: MarkdownNode | null = null;
        let body = markdown;

        if (this.enableFrontmatter) {
            const extracted = this.extractFrontmatter(markdown);
            if (extracted) {
                frontmatterNode = extracted.node;
                body = extracted.body;
            }
        }

        const rawAst = this.parser.parse(body);
        const document = convertNode(rawAst);

        if (frontmatterNode) {
            document.children.unshift(frontmatterNode);
        }

        return document;
    }

    /**
     * Parse markdown and return the raw commonmark Node
     *
     * This is useful when you need access to the full commonmark API
     *
     * @param markdown - The markdown text to parse
     * @returns The raw commonmark Node
     */
    public parseRaw(markdown: string): Node {
        return this.parser.parse(markdown);
    }

    /**
     * Walk the AST and call the visitor function for each node
     *
     * @param ast - The root node to start walking from
     * @param visitor - Function called for each node (entering and leaving)
     */
    public walk(ast: MarkdownNode, visitor: NodeVisitor): void {
        this.walkNode(ast, visitor);
    }

    /**
     * Walk the AST with type-specific visitors
     *
     * @param ast - The root node to start walking from
     * @param visitors - Object mapping node types to visitor functions
     */
    public walkTyped(ast: MarkdownNode, visitors: TypedVisitors): void {
        this.walk(ast, (node, entering) => {
            const visitor = visitors[node.type];
            if (visitor) {
                visitor(node, entering);
            }
        });
    }

    /**
     * Find all nodes of a specific type
     *
     * @param ast - The root node to search from
     * @param type - The node type to find
     * @returns Array of matching nodes
     */
    public findByType(ast: MarkdownNode, type: MarkdownNodeType): MarkdownNode[] {
        const results: MarkdownNode[] = [];
        this.walk(ast, (node, entering) => {
            if (entering && node.type === type) {
                results.push(node);
            }
        });
        return results;
    }

    /**
     * Find all nodes matching a predicate
     *
     * @param ast - The root node to search from
     * @param predicate - Function that returns true for matching nodes
     * @returns Array of matching nodes
     */
    public findAll(
        ast: MarkdownNode,
        predicate: (node: MarkdownNode) => boolean
    ): MarkdownNode[] {
        const results: MarkdownNode[] = [];
        this.walk(ast, (node, entering) => {
            if (entering && predicate(node)) {
                results.push(node);
            }
        });
        return results;
    }

    /**
     * Find the first node matching a predicate
     *
     * @param ast - The root node to search from
     * @param predicate - Function that returns true for matching nodes
     * @returns The first matching node, or null if not found
     */
    public findFirst(
        ast: MarkdownNode,
        predicate: (node: MarkdownNode) => boolean
    ): MarkdownNode | null {
        let result: MarkdownNode | null = null;
        this.walk(ast, (node, entering) => {
            if (result === null && entering && predicate(node)) {
                result = node;
            }
        });
        return result;
    }

    /**
     * Get all text content from the AST
     *
     * @param ast - The root node to extract text from
     * @returns Combined text content
     */
    public getTextContent(ast: MarkdownNode): string {
        const texts: string[] = [];
        this.walk(ast, (node, entering) => {
            if (entering) {
                if (node.type === "text" || node.type === "code") {
                    if (node.literal) {
                        texts.push(node.literal);
                    }
                } else if (node.type === "softbreak") {
                    texts.push(" ");
                } else if (node.type === "linebreak") {
                    texts.push("\n");
                }
            }
        });
        return texts.join("");
    }

    /**
     * Get all headings from the document
     *
     * @param ast - The root node
     * @returns Array of heading nodes with their text content
     */
    public getHeadings(ast: MarkdownNode): Array<{ level: number; text: string; node: MarkdownNode }> {
        const headings = this.findByType(ast, "heading");
        return headings.map((node) => ({
            level: node.level ?? 1,
            text: this.getTextContent(node),
            node,
        }));
    }

    /**
     * Get all links from the document
     *
     * @param ast - The root node
     * @returns Array of link information
     */
    public getLinks(
        ast: MarkdownNode
    ): Array<{ url: string; title: string | null; text: string; node: MarkdownNode }> {
        const links = this.findByType(ast, "link");
        return links.map((node) => ({
            url: node.destination ?? "",
            title: node.title,
            text: this.getTextContent(node),
            node,
        }));
    }

    /**
     * Get all images from the document
     *
     * @param ast - The root node
     * @returns Array of image information
     */
    public getImages(
        ast: MarkdownNode
    ): Array<{ src: string; alt: string; title: string | null; node: MarkdownNode }> {
        const images = this.findByType(ast, "image");
        return images.map((node) => ({
            src: node.destination ?? "",
            alt: this.getTextContent(node),
            title: node.title,
            node,
        }));
    }

    /**
     * Get all code blocks from the document
     *
     * @param ast - The root node
     * @returns Array of code block information
     */
    public getCodeBlocks(
        ast: MarkdownNode
    ): Array<{ language: string | null; code: string; node: MarkdownNode }> {
        const codeBlocks = this.findByType(ast, "code_block");
        return codeBlocks.map((node) => ({
            language: node.info || null,
            code: node.literal ?? "",
            node,
        }));
    }

    /**
     * Get the parsed front-matter data from the document AST
     *
     * @param ast - The root document node
     * @returns The parsed YAML data object, or null if no
     *          front-matter is present
     */
    public getFrontmatter(
        ast: MarkdownNode
    ): Record<string, unknown> | null {
        const node = this.findFirst(
            ast,
            (n) => n.type === "frontmatter"
        );
        return node?.data ?? null;
    }

    /**
     * Extract front-matter from the beginning of a markdown string.
     *
     * @returns An object containing the frontmatter MarkdownNode and
     *          the remaining body text, or null if no front-matter
     *          was found.
     */
    private extractFrontmatter(
        markdown: string
    ): { node: MarkdownNode; body: string } | null {
        const match = markdown.match(FRONTMATTER_PATTERN);
        if (!match) {
            return null;
        }

        const fullMatch = match[0];
        const yamlContent = match[1];

        const linesBefore = fullMatch.split(/\r?\n/);
        const endLine = linesBefore.length;

        const endColumn =
            linesBefore[linesBefore.length - 1].length;

        const sourceRange: SourceRange = {
            start: { line: 1, column: 1 },
            end: { line: endLine, column: endColumn },
        };

        let parsedData: Record<string, unknown> | null = null;
        try {
            const result = parseYaml(yamlContent);
            if (
                result !== null &&
                typeof result === "object" &&
                !Array.isArray(result)
            ) {
                parsedData = result as Record<string, unknown>;
            }
        } catch {
            // YAML parse failure — keep data as null
        }

        const node: MarkdownNode = {
            type: "frontmatter",
            literal: yamlContent,
            destination: null,
            title: null,
            info: null,
            level: null,
            listType: null,
            listTight: null,
            listStart: null,
            listDelimiter: null,
            data: parsedData,
            sourceRange,
            children: [],
        };

        const body = markdown.slice(fullMatch.length).replace(
            /^\r?\n/,
            ""
        );

        return { node, body };
    }

    /**
     * Internal recursive walk implementation
     */
    private walkNode(node: MarkdownNode, visitor: NodeVisitor): void {
        visitor(node, true);
        for (const child of node.children) {
            this.walkNode(child, visitor);
        }
        visitor(node, false);
    }
}
