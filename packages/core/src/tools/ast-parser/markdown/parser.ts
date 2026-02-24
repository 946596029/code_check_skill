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
        let lineOffset = 0;

        if (this.enableFrontmatter) {
            const extracted = this.extractFrontmatter(markdown);
            if (extracted) {
                frontmatterNode = extracted.node;
                body = extracted.body;
                lineOffset = extracted.node.sourceRange!.end.line;
            }
        }

        const rawAst = this.parser.parse(body);
        const document = convertNode(rawAst);

        if (lineOffset > 0) {
            this.offsetSourceRanges(document, lineOffset);
        }

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

    // ── Semantic query helpers ──

    /**
     * Return the document body children, excluding the frontmatter node.
     */
    public getBodyChildren(doc: MarkdownNode): MarkdownNode[] {
        return doc.children.filter((c) => c.type !== "frontmatter");
    }

    /**
     * Extract a heading section's content nodes.
     *
     * Finds the first heading at `level` whose text matches `title`,
     * then returns all sibling nodes from that heading up to (but not
     * including) the next heading at the same or higher level.
     *
     * @returns The content nodes, or null if the heading is not found.
     */
    public getSection(
        doc: MarkdownNode,
        level: number,
        title: string
    ): MarkdownNode[] | null {
        const body = this.getBodyChildren(doc);
        const idx = body.findIndex(
            (c) =>
                c.type === "heading" &&
                (c.level ?? 1) === level &&
                this.getTextContent(c).trim() === title
        );
        if (idx < 0) return null;

        const start = idx + 1;
        let end = body.length;
        for (let i = start; i < body.length; i++) {
            if (body[i].type === "heading" && (body[i].level ?? 1) <= level) {
                end = i;
                break;
            }
        }
        return body.slice(start, end);
    }

    /**
     * Text-line variant of getSection for rules that need raw-line
     * processing (e.g. regex-based bullet validation).
     *
     * @returns The lines within the section and the 1-based start line
     *          number, or null if the heading is not found.
     */
    public getSectionText(
        source: string,
        level: number,
        title: string
    ): { lines: string[]; startLine: number } | null {
        const prefix = "#".repeat(level);
        const heading = `${prefix} ${title}`;
        const allLines = source.split(/\r?\n/);

        const headingIdx = allLines.findIndex(
            (l) => l.trim() === heading
        );
        if (headingIdx < 0) return null;

        const sameOrHigher = new RegExp(`^#{1,${level}}\\s+`);
        let endIdx = allLines.length;
        for (let i = headingIdx + 1; i < allLines.length; i++) {
            if (sameOrHigher.test(allLines[i].trim())) {
                endIdx = i;
                break;
            }
        }

        return {
            lines: allLines.slice(headingIdx + 1, endIdx),
            startLine: headingIdx + 2,
        };
    }

    /**
     * Extract the original source lines that correspond to an AST node,
     * using its `sourceRange`.
     *
     * Returns the same shape as `getSectionText` so that rules can switch
     * seamlessly between section-level and node-level text processing.
     *
     * @param source - The full markdown source text
     * @param node   - An AST node with a non-null `sourceRange`
     * @returns The source lines spanning the node and the 1-based start
     *          line number, or null if the node has no `sourceRange`.
     */
    public getNodeText(
        source: string,
        node: MarkdownNode
    ): { lines: string[]; startLine: number } | null {
        const range = node.sourceRange;
        if (!range) return null;

        const allLines = source.split(/\r?\n/);
        const startIdx = range.start.line - 1;
        const endIdx = range.end.line - 1;

        if (startIdx < 0 || endIdx >= allLines.length || startIdx > endIdx) {
            return null;
        }

        return {
            lines: allLines.slice(startIdx, endIdx + 1),
            startLine: range.start.line,
        };
    }

    /**
     * Get the logical text lines of a node by walking its AST.
     *
     * Unlike {@link getNodeText}, which returns verbatim source lines,
     * this method merges soft-break wrapped lines into single logical
     * lines.  Hard line breaks (trailing double-space or backslash)
     * still produce separate logical lines.
     *
     * For container nodes (list, item, block_quote, document) the
     * method recurses into block-level children so that each
     * paragraph / heading yields its own set of logical lines.
     *
     * @param source - The full markdown source text
     * @param node   - An AST node with a non-null `sourceRange`
     * @returns Logical text lines and the 1-based start line number,
     *          or null if the node has no `sourceRange`.
     */
    public getLogicalLines(
        source: string,
        node: MarkdownNode
    ): { lines: string[]; startLine: number } | null {
        const range = node.sourceRange;
        if (!range) return null;

        if (node.type === "paragraph" || node.type === "heading") {
            const raw = this.getNodeText(source, node);
            if (!raw) return null;
            return {
                lines: this.mergeSoftWraps(raw.lines),
                startLine: raw.startLine,
            };
        }

        if (node.type === "code_block" || node.type === "html_block") {
            return this.getNodeText(source, node);
        }

        if (node.type === "thematic_break" || node.type === "frontmatter") {
            return null;
        }

        const lines: string[] = [];
        let startLine = range.start.line;
        let foundFirst = false;

        for (const child of node.children) {
            const childResult = this.getLogicalLines(source, child);
            if (childResult) {
                if (!foundFirst) {
                    startLine = childResult.startLine;
                    foundFirst = true;
                }
                lines.push(...childResult.lines);
            }
        }

        return { lines, startLine };
    }

    /**
     * Flatten markdown list nodes into their direct item nodes.
     */
    public getBulletItems(listNodes: MarkdownNode[]): MarkdownNode[] {
        const items: MarkdownNode[] = [];
        for (const listNode of listNodes) {
            if (listNode.type !== "list") continue;
            for (const child of listNode.children) {
                if (child.type === "item") {
                    items.push(child);
                }
            }
        }
        return items;
    }

    /**
     * Extract a bullet item's first line in normalized "* " form.
     */
    public getItemBulletLine(
        source: string,
        item: MarkdownNode
    ): { text: string; startLine: number } | null {
        if (item.type !== "item") return null;

        const nodeText = this.getNodeText(source, item);
        if (!nodeText || nodeText.lines.length === 0) return null;

        const firstLine = nodeText.lines[0].trim();
        if (!firstLine) return null;

        return {
            text: firstLine.startsWith("* ") ? firstLine : `* ${firstLine}`,
            startLine: nodeText.startLine,
        };
    }

    /**
     * Find the next sibling of `anchor` within `parent`'s children.
     *
     * If a predicate is given, skips siblings that don't match.
     * Only looks forward (nodes after `anchor`), returns the first match.
     */
    public getNextSibling(
        parent: MarkdownNode,
        anchor: MarkdownNode,
        predicate?: (node: MarkdownNode) => boolean
    ): MarkdownNode | null {
        const children = parent.type === "document"
            ? this.getBodyChildren(parent)
            : parent.children;
        const idx = children.indexOf(anchor);
        if (idx < 0 || idx + 1 >= children.length) return null;

        for (let i = idx + 1; i < children.length; i++) {
            if (!predicate || predicate(children[i])) {
                return children[i];
            }
        }
        return null;
    }

    /**
     * Filter nodes by type from a flat node list.
     */
    public filterByType(
        nodes: MarkdownNode[],
        type: MarkdownNodeType
    ): MarkdownNode[] {
        return nodes.filter((n) => n.type === type);
    }

    /**
     * Check whether `parent` has a direct child matching the predicate
     * at the given position.
     */
    public hasChild(
        parent: MarkdownNode,
        predicate: (node: MarkdownNode) => boolean,
        position: "first" | "last" | "any" = "any"
    ): boolean {
        const children = parent.children;
        if (children.length === 0) return false;

        switch (position) {
            case "first":
                return predicate(children[0]);
            case "last":
                return predicate(children[children.length - 1]);
            case "any":
                return children.some(predicate);
        }
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
     * Shift all sourceRange line numbers in the subtree by `offset`.
     * Used after frontmatter extraction so that body-node positions
     * are absolute with respect to the original document.
     */
    private offsetSourceRanges(node: MarkdownNode, offset: number): void {
        if (node.sourceRange) {
            node.sourceRange.start.line += offset;
            node.sourceRange.end.line += offset;
        }
        for (const child of node.children) {
            this.offsetSourceRanges(child, offset);
        }
    }

    /**
     * Merge soft-wrapped source lines into logical lines.
     *
     * A line ending with two or more trailing spaces or a backslash is
     * treated as a CommonMark hard line break — the logical line is
     * split there.  All other intra-paragraph newlines are soft breaks
     * and are collapsed into a single space.
     *
     * Continuation indentation (leading whitespace on lines after the
     * first) is stripped before merging so that list-item continuation
     * and block-quote prefixes do not leak into the logical text.
     */
    private mergeSoftWraps(rawLines: string[]): string[] {
        if (rawLines.length <= 1) return [...rawLines];

        const result: string[] = [];
        let buf = rawLines[0];

        for (let i = 1; i < rawLines.length; i++) {
            const isHardBreak = / {2,}$/.test(buf) || buf.endsWith("\\");
            const cont = rawLines[i].replace(/^\s+/, "");

            if (isHardBreak) {
                result.push(buf.replace(/( {2,}|\\)$/, ""));
                buf = cont;
            } else {
                buf += " " + cont;
            }
        }

        if (buf) {
            result.push(buf);
        }

        return result;
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
