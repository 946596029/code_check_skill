import { Feature, FeatureMatch } from "../feature";
import { RegexGrep, RegexMatch } from "../../../../tools/text-grep";

/**
 * Adapter to convert RegexMatch to FeatureMatch.
 */
class RegexMatchAdapter {
    /**
     * Convert a RegexMatch to a FeatureMatch.
     * 
     * @param regexMatch - The regex match result
     * @param sourceCode - The original source code
     * @returns A FeatureMatch object
     */
    public static toFeatureMatch(
        regexMatch: RegexMatch,
        sourceCode: string
    ): FeatureMatch {
        const lines = sourceCode.split(/\r?\n/);
        const matchedLine = lines[regexMatch.line] || "";
        
        // Calculate end position
        const endLine = regexMatch.line;
        const endColumn = regexMatch.column + regexMatch.match.length;

        return {
            node: null, // Text-based search has no AST node
            start: {
                line: regexMatch.line + 1, // Convert to 1-based line number
                column: regexMatch.column + 1, // Convert to 1-based column number
            },
            end: {
                line: endLine + 1,
                column: endColumn + 1,
            },
            text: regexMatch.match,
            metadata: {
                groups: regexMatch.groups,
                index: regexMatch.index,
                endIndex: regexMatch.endIndex,
            },
        };
    }
}

/**
 * Text-based Feature using regex pattern matching.
 * 
 * This Feature uses RegexGrep to search for patterns in source code text.
 * It does not require AST parsing and works directly on the source code string.
 * 
 * @example
 * ```typescript
 * // Find all TODO comments
 * const todoFeature = new TextGrepFeature(
 *     "find-todos",
 *     "Find TODO comments in code",
 *     /\/\/\s*TODO:?\s*(.+)/gi
 * );
 * 
 * const matches = todoFeature.detect(null, sourceCode);
 * ```
 * 
 * @example
 * ```typescript
 * // Find console.log statements
 * const consoleLogFeature = new TextGrepFeature(
 *     "find-console-log",
 *     "Find console.log statements",
 *     /console\.log\([^)]*\)/g
 * );
 * ```
 */
export class TextGrepFeature extends Feature {
    private readonly grep: RegexGrep;
    private readonly pattern: RegExp | string;
    private readonly maxMatches?: number;

    /**
     * Creates a new TextGrepFeature instance.
     * 
     * @param id - Unique identifier for this feature
     * @param description - Human-readable description
     * @param pattern - Regular expression pattern to search for
     * @param maxMatches - Optional maximum number of matches to return
     */
    public constructor(
        id: string,
        description: string,
        pattern: RegExp | string,
        maxMatches?: number
    ) {
        super(id, description);
        this.grep = new RegexGrep();
        this.pattern = pattern;
        this.maxMatches = maxMatches;
    }

    /**
     * Detects matching patterns in the source code using regex.
     * 
     * Note: The ast parameter is ignored for text-based search.
     * 
     * @param ast - Ignored for text-based search
     * @param sourceCode - The source code to search
     * @returns Array of matches found in the source code
     */
    public detect(ast: unknown, sourceCode: string): FeatureMatch[] {
        const regexMatches = this.grep.search(sourceCode, this.pattern, {
            maxMatches: this.maxMatches,
        });

        if (!regexMatches || regexMatches.length === 0) {
            return [];
        }

        return regexMatches.map((match) =>
            RegexMatchAdapter.toFeatureMatch(match, sourceCode)
        );
    }
}
