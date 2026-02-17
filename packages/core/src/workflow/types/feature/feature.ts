/**
 * Represents a location in the source code where a feature was detected.
 */
export interface FeatureMatch {
    /**
     * The AST node that matched the feature.
     */
    node: unknown;

    /**
     * Start position of the matched code (line, column).
     */
    start: { line: number; column: number };

    /**
     * End position of the matched code (line, column).
     */
    end: { line: number; column: number };

    /**
     * The matched source code text.
     */
    text: string;

    /**
     * Optional metadata extracted from the AST node.
     */
    metadata?: Record<string, unknown>;
}

/**
 * Supported programming languages for AST parsing.
 */
export type FeatureLanguage = "typescript" | "javascript" | "json";

/**
 * Abstract base class for AST feature detectors.
 * 
 * A Feature is responsible for detecting specific code patterns in the AST.
 * When a pattern is detected, the Feature captures the relevant AST nodes
 * so that Rules can perform checks on them.
 */
export abstract class Feature {
    /**
     * Unique identifier for this feature.
     */
    public readonly id: string;

    /**
     * Human-readable description of what this feature detects.
     */
    public readonly description: string;

    /**
     * Creates a new Feature instance.
     */
    public constructor(id: string, description: string) {
        this.id = id;
        this.description = description;
    }

    /**
     * Detects matching patterns in the given AST.
     * 
     * @param ast - The parsed AST to analyze
     * @param sourceCode - The original source code
     * @returns An array of matches found in the AST
     */
    public abstract detect(ast: unknown, sourceCode: string): FeatureMatch[];
}
