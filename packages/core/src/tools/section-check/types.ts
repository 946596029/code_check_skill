import type { LinePattern } from "../line-pattern";
import type { MarkdownNode } from "../ast-parser/markdown";

/** Returned by SectionCheck.run(). */
export interface CheckFailure {
    message: string;
    line?: number;
}

export class BulletLine {
    public readonly text: string;
    public readonly startLine: number;
    private lastPattern: LinePattern | null = null;

    public constructor(text: string, startLine: number) {
        this.text = text;
        this.startLine = startLine;
    }

    /**
     * Record the pattern used by this check so the chain can produce
     * a useful default error message if the caller just returns false.
     */
    public matches(pattern: LinePattern): boolean {
        this.lastPattern = pattern;
        return pattern.test(this.text);
    }

    public getLastPattern(): LinePattern | null {
        return this.lastPattern;
    }

    /**
     * Produce a human-readable failure description using the last pattern.
     * Returns null if the line matches or no pattern has been recorded.
     */
    public describeFailure(): string | null {
        return this.lastPattern?.describeFailure(this.text) ?? null;
    }
}

/** Passed to eachBulletItemAsync callback. */
export interface BulletItem {
    readonly firstLine: BulletLine;
    readonly argName: string;
    readonly descriptionLines: string[];
    readonly descriptionText: string;
    readonly node: MarkdownNode;
    readonly startLine: number;
}

/** Passed to validate callback. */
export interface SectionData {
    readonly nodes: MarkdownNode[];
    readonly lines: string[];
    readonly startLine: number;
}
