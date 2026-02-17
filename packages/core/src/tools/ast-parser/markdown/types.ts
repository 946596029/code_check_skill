import type { Node } from "commonmark";

/**
 * Markdown node types defined in CommonMark specification,
 * extended with "frontmatter" for YAML front-matter blocks.
 */
export type MarkdownNodeType =
    | "document"
    | "block_quote"
    | "list"
    | "item"
    | "paragraph"
    | "heading"
    | "emph"
    | "strong"
    | "link"
    | "image"
    | "code"
    | "code_block"
    | "thematic_break"
    | "softbreak"
    | "linebreak"
    | "html_block"
    | "html_inline"
    | "text"
    | "custom_block"
    | "custom_inline"
    | "frontmatter";

/**
 * List type for list nodes
 */
export type ListType = "bullet" | "ordered";

/**
 * Position information for a node in the source document
 */
export interface SourcePosition {
    line: number;
    column: number;
}

/**
 * Source location range for a node
 */
export interface SourceRange {
    start: SourcePosition;
    end: SourcePosition;
}

/**
 * Simplified markdown AST node interface
 */
export interface MarkdownNode {
    /**
     * The type of the node
     */
    type: MarkdownNodeType;

    /**
     * Text content for text, code, code_block, and html nodes
     */
    literal: string | null;

    /**
     * Destination URL for link and image nodes
     */
    destination: string | null;

    /**
     * Title for link and image nodes
     */
    title: string | null;

    /**
     * Info string for code_block nodes (e.g., language identifier)
     */
    info: string | null;

    /**
     * Heading level (1-6) for heading nodes
     */
    level: number | null;

    /**
     * List type for list nodes
     */
    listType: ListType | null;

    /**
     * Whether the list is tight (no blank lines between items)
     */
    listTight: boolean | null;

    /**
     * Starting number for ordered lists
     */
    listStart: number | null;

    /**
     * Delimiter for ordered lists ("." or ")")
     */
    listDelimiter: string | null;

    /**
     * Parsed key-value data for frontmatter nodes (YAML content)
     */
    data: Record<string, unknown> | null;

    /**
     * Source location in the original document
     */
    sourceRange: SourceRange | null;

    /**
     * Child nodes
     */
    children: MarkdownNode[];
}

/**
 * Walker event for traversing the AST
 */
export interface WalkEvent {
    /**
     * Whether this is an entering or leaving event
     */
    entering: boolean;

    /**
     * The current node
     */
    node: MarkdownNode;
}

/**
 * Visitor callback function type
 */
export type NodeVisitor = (node: MarkdownNode, entering: boolean) => void;

/**
 * Type-specific visitor callbacks
 */
export type TypedVisitors = {
    [K in MarkdownNodeType]?: NodeVisitor;
};

/**
 * Options for the markdown parser
 */
export interface ParserOptions {
    /**
     * Whether to enable smart punctuation (e.g., converting quotes)
     */
    smart?: boolean;

    /**
     * Maximum nesting level for nested content
     */
    maxNesting?: number;

    /**
     * Whether to enable YAML front-matter parsing.
     * When enabled, the parser extracts the leading `---...---` block,
     * parses its YAML content, and inserts a "frontmatter" node as
     * the first child of the document node.
     *
     * @default true
     */
    enableFrontmatter?: boolean;
}

/**
 * Re-export the original commonmark Node type for advanced usage
 */
export type { Node as CommonMarkNode };
