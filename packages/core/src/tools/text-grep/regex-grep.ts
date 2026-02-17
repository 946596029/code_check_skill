/**
 * Regex-based text search result
 */
export interface RegexMatch {
    /** Matched full text */
    match: string;
    /** 0-based line number */
    line: number;
    /** 0-based column offset in the line */
    column: number;
    /** Capture groups (index 0 is full match) */
    groups: string[];
    /** Start index in the full text */
    index: number;
    /** End index in the full text */
    endIndex: number;
}

/**
 * Options for regex search
 */
export interface RegexGrepOptions {
    /** Regex flags: g (global), i (case insensitive), m (multiline), etc. */
    flags?: string;
    /** Maximum number of matches to return (default: unlimited) */
    maxMatches?: number;
}

/**
 * Regex-based text search tool
 *
 * Searches text content using regular expressions and returns matches with
 * line numbers, column positions, and capture groups.
 *
 * @example
 * ```typescript
 * import { RegexGrep } from "@code-check/core";
 *
 * const grep = new RegexGrep();
 * const text = "Hello world\nfoo bar\nworld hello";
 * const matches = grep.search(text, /world/gi);
 * // [{ match: "world", line: 0, column: 6, groups: ["world"], ... }, ...]
 *
 * // With capture groups
 * const emailMatches = grep.search(text, /(\w+)@(\w+\.\w+)/g);
 * ```
 */
export class RegexGrep {
    /**
     * Search text with a regex pattern
     *
     * @param text - Text content to search
     * @param pattern - RegExp or pattern string
     * @param options - Search options
     * @returns Array of matches, or null if pattern is invalid
     */
    public search(
        text: string,
        pattern: RegExp | string,
        options: RegexGrepOptions = {}
    ): RegexMatch[] | null {
        const { flags = "g", maxMatches } = options;

        let regex: RegExp;
        try {
            const effectiveFlags = flags.includes("g") ? flags : flags + "g";
            if (pattern instanceof RegExp) {
                regex = new RegExp(pattern.source, effectiveFlags);
            } else {
                regex = new RegExp(pattern, effectiveFlags);
            }
        } catch {
            return null;
        }

        const results: RegexMatch[] = [];
        const lineOffsets = this.buildLineOffsets(text);

        for (const match of text.matchAll(regex)) {
            if (maxMatches !== undefined && results.length >= maxMatches) {
                break;
            }

            const { line, column } = this.indexToLineColumn(match.index, lineOffsets);
            const matchEndIndex = match.index + match[0].length;

            results.push({
                match: match[0],
                line,
                column,
                groups: match.slice(0),
                index: match.index,
                endIndex: matchEndIndex,
            });
        }

        return results;
    }

    /**
     * Search text and return only the first match
     *
     * @param text - Text content to search
     * @param pattern - RegExp or pattern string
     * @param options - Search options (flags)
     * @returns First match or null
     */
    public searchFirst(
        text: string,
        pattern: RegExp | string,
        options: RegexGrepOptions = {}
    ): RegexMatch | null {
        const matches = this.search(text, pattern, {
            ...options,
            maxMatches: 1,
        });
        return matches && matches.length > 0 ? matches[0] : null;
    }

    /**
     * Check if text contains any match for the pattern
     *
     * @param text - Text content to search
     * @param pattern - RegExp or pattern string
     * @param options - Search options (flags)
     * @returns True if at least one match exists
     */
    public test(text: string, pattern: RegExp | string, options: RegexGrepOptions = {}): boolean {
        const match = this.searchFirst(text, pattern, options);
        return match !== null;
    }

    /**
     * Search multiple files and return matches with file path
     *
     * @param files - Map of file path to content
     * @param pattern - RegExp or pattern string
     * @param options - Search options
     * @returns Map of file path to matches
     */
    public searchFiles(
        files: Map<string, string> | Record<string, string>,
        pattern: RegExp | string,
        options: RegexGrepOptions = {}
    ): Map<string, RegexMatch[]> {
        const result = new Map<string, RegexMatch[]>();
        const entries =
            files instanceof Map ? files.entries() : Object.entries(files);

        for (const [path, content] of entries) {
            const matches = this.search(content, pattern, options);
            if (matches && matches.length > 0) {
                result.set(path, matches);
            }
        }

        return result;
    }

    /**
     * Build line start offsets for index-to-line/column conversion
     */
    private buildLineOffsets(text: string): number[] {
        const offsets: number[] = [0];
        const re = /\r?\n/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
            offsets.push(m.index + m[0].length);
        }
        return offsets;
    }

    /**
     * Convert character index to 0-based line and column
     */
    private indexToLineColumn(
        index: number,
        lineOffsets: number[]
    ): { line: number; column: number } {
        let line = 0;
        for (let i = 1; i < lineOffsets.length; i++) {
            if (index < lineOffsets[i]) {
                line = i - 1;
                break;
            }
            line = i;
        }
        const column = index - lineOffsets[line];
        return { line, column };
    }
}
