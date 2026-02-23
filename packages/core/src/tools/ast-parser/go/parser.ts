import {
    Parser,
    Language,
    Query,
    Node as TreeSitterNode,
    Tree,
} from "web-tree-sitter";
import type { QueryMatch, QueryCapture } from "web-tree-sitter";
import * as path from "path";

type SyntaxNode = TreeSitterNode;

let cachedLanguage: Language | null = null;
let initPromise: Promise<void> | null = null;

async function ensureParserInit(): Promise<void> {
    if (initPromise) return initPromise;
    initPromise = Parser.init();
    return initPromise;
}

async function loadGoLanguage(): Promise<Language> {
    if (cachedLanguage) return cachedLanguage;

    await ensureParserInit();

    const wasmPath = path.join(
        path.dirname(require.resolve("tree-sitter-wasms/package.json")),
        "out",
        "tree-sitter-go.wasm"
    );
    cachedLanguage = await Language.load(wasmPath);
    return cachedLanguage;
}

/**
 * GoParser wraps web-tree-sitter to parse Go source code into a full AST.
 *
 * Because WASM loading is async, instances must be created via the static
 * factory method {@link GoParser.create}.
 *
 * @example
 * ```typescript
 * const parser = await GoParser.create();
 * const tree = parser.parse(goSource);
 * const root = tree.rootNode;
 * ```
 */
export class GoParser {
    private parser: Parser;
    private language: Language;

    private constructor(parser: Parser, language: Language) {
        this.parser = parser;
        this.language = language;
    }

    /**
     * Create a new GoParser instance.
     * Loads the WASM runtime and Go grammar on first call;
     * subsequent calls reuse the cached language.
     */
    public static async create(): Promise<GoParser> {
        const language = await loadGoLanguage();
        const parser = new Parser();
        parser.setLanguage(language);
        return new GoParser(parser, language);
    }

    /**
     * Parse Go source code into a tree-sitter Tree.
     */
    public parse(source: string): Tree {
        const tree = this.parser.parse(source);
        if (!tree) {
            throw new Error("Failed to parse Go source");
        }
        return tree;
    }

    /**
     * Run a tree-sitter S-expression query against a syntax node.
     *
     * @returns All matches for the query patterns.
     */
    public query(node: SyntaxNode, pattern: string): QueryMatch[] {
        const q = new Query(this.language, pattern);
        try {
            return q.matches(node);
        } finally {
            q.delete();
        }
    }

    /**
     * Run a tree-sitter S-expression query and return flat captures.
     */
    public captures(node: SyntaxNode, pattern: string): QueryCapture[] {
        const q = new Query(this.language, pattern);
        try {
            return q.captures(node);
        } finally {
            q.delete();
        }
    }

    /**
     * Find all descendant nodes of a given type.
     */
    public findByType(node: SyntaxNode, type: string): SyntaxNode[] {
        return node.descendantsOfType(type).filter(
            (n): n is SyntaxNode => n !== null
        );
    }

    /**
     * Depth-first walk over the subtree rooted at `node`.
     */
    public walk(node: SyntaxNode, visitor: (n: SyntaxNode) => void): void {
        visitor(node);
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child) {
                this.walk(child, visitor);
            }
        }
    }

    /**
     * Clean up the underlying parser resources.
     * Call this when the parser is no longer needed.
     */
    public dispose(): void {
        this.parser.delete();
    }
}

export type { SyntaxNode, Tree, Language, Query, QueryMatch, QueryCapture };
