import { Feature, FeatureMatch } from "../feature/feature";

export class RuleCheckResult {

    public success: boolean;
    public message: string;
    public original: string;
    public suggested: string;
    public match?: FeatureMatch;

    public constructor(
        success: boolean,
        message: string,
        original: string,
        suggested: string,
        match?: FeatureMatch
    ) {
        this.success = success;
        this.message = message;
        this.original = original;
        this.suggested = suggested;
        this.match = match;
    }
}

export type RuleType = "code" | "prompt";

/**
 * Matcher function type.
 * Receives features, code and AST, returns whether rule should trigger.
 */
export type MatcherFn = (
    features: Feature[],
    code: string,
    ast: unknown
) => boolean;

/**
 * Abstract base class for code checking rules.
 */
export abstract class Rule {

    public readonly name: string;
    public readonly description: string;
    public readonly type: RuleType;
    public readonly features: Feature[];
    protected readonly matcher: MatcherFn | null;

    public constructor(
        name: string,
        description: string,
        type: RuleType,
        features: Feature[] = [],
        matcher: MatcherFn | null = null
    ) {
        this.name = name;
        this.description = description;
        this.type = type;
        this.features = features;

        this.matcher = matcher;
    }

    /**
     * Tests the given code against this rule.
     */
    public async test(code: string, ast?: unknown): Promise<RuleCheckResult[]> {
        const targets = this.resolveCheckTargets(code, ast);
        if (!targets) return [];

        const results: RuleCheckResult[] = [];
        for (const { text, match } of targets) {
            const result = await this.check(text);
            if (result) {
                if (match) result.match = match;
                results.push(result);
            }
        }
        return results;
    }

    /**
     * Resolves what code portions to check. Encapsulates feature/matcher logic:
     * - No features: check entire code
     * - Features but no AST: skip
     * - Matcher rejects: skip
     * - No matches: skip
     */
    private resolveCheckTargets(
        code: string,
        ast?: unknown
    ): Array<{ text: string; match?: FeatureMatch }> | null {
        if (this.features.length === 0) {
            return [{ text: code }];
        }
        if (!ast) return null;
        if (this.matcher && !this.matcher(this.features, code, ast)) return null;

        const matches = this.collectMatches(code, ast);
        if (matches.length === 0) return null;

        return matches.map((m) => ({ text: m.text, match: m }));
    }

    private collectMatches(code: string, ast: unknown): FeatureMatch[] {
        const allMatches: FeatureMatch[] = [];
        const seen = new Set<string>();

        for (const feature of this.features) {
            const matches = feature.detect(ast, code);
            for (const match of matches) {
                const key = `${match.start.line}:${match.start.column}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    allMatches.push(match);
                }
            }
        }

        return allMatches;
    }

    /**
     * Core check logic to be implemented by subclasses.
     */
    protected abstract check(code: string): Promise<RuleCheckResult | null>;
}
