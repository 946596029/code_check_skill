import { Context } from "../../context/context";
import type { SourceRange } from "../../../tools/ast-parser/markdown";

export class RuleCheckResult {

    public success: boolean;
    public message: string;
    public original: string;
    public suggested: string;
    public children: RuleCheckResult[];
    public range?: SourceRange;

    public constructor(
        success: boolean,
        message: string,
        original: string,
        suggested: string,
        children: RuleCheckResult[] = [],
        range?: SourceRange
    ) {
        this.success = success;
        this.message = message;
        this.original = original;
        this.suggested = suggested;
        this.children = children;
        this.range = range;
    }

    static aggregate(children: RuleCheckResult[]): RuleCheckResult {
        return new RuleCheckResult(true, "", "", "", children);
    }

    static pass(
        message: string,
        range?: SourceRange,
        original: string = "",
        suggested?: string,
        children: RuleCheckResult[] = []
    ): RuleCheckResult {
        const normalizedSuggested = suggested ?? original;
        return new RuleCheckResult(
            true,
            message,
            original,
            normalizedSuggested,
            children,
            range
        );
    }

    static fromLine(line?: number): SourceRange | undefined {
        if (!line || line <= 0) return undefined;
        return {
            start: { line, column: 1 },
            end: { line, column: 1 },
        };
    }

    /**
     * Aggregate success: this result is successful only when itself
     * AND all descendant results are successful.
     */
    get aggregateSuccess(): boolean {
        if (!this.success) return false;
        return this.children.every((c) => c.aggregateSuccess);
    }

    /**
     * Collect all failing results across the tree (depth-first).
     */
    collectFailures(): RuleCheckResult[] {
        const failures: RuleCheckResult[] = [];
        if (!this.success) failures.push(this);
        for (const child of this.children) {
            failures.push(...child.collectFailures());
        }
        return failures;
    }
}

/**
 * Message templates keyed by a short identifier.
 * Values can be plain strings or functions that accept interpolation args.
 */
export type MessageTemplate = string | ((...args: unknown[]) => string);

export interface RuleMeta {
    name: string;
    description: string;
    messages: Record<string, MessageTemplate>;
}

/**
 * Abstract base class for code checking rules.
 *
 * Supports a tree structure: each rule can have child rules.
 * Subclasses override `test()` to implement their checking logic
 * and can call `executeChildren()` to dispatch child rules.
 *
 * Rule metadata (name, description, error message templates) is
 * declared separately via `RuleMeta` so that checking logic stays
 * focused on *what* to check rather than *how to describe* results.
 */
export abstract class Rule {

    public readonly name: string;
    public readonly description: string;
    public readonly type: string;
    public readonly meta: RuleMeta;
    protected readonly children: Rule[] = [];

    public constructor(meta: RuleMeta, type: string = "code") {
        this.meta = meta;
        this.name = meta.name;
        this.description = meta.description;
        this.type = type;
    }

    // ── Child rule management ──

    public addChild(rule: Rule): this {
        this.children.push(rule);
        return this;
    }

    public addChildren(rules: Rule[]): this {
        this.children.push(...rules);
        return this;
    }

    public getChildren(): ReadonlyArray<Rule> {
        return this.children;
    }

    // ── Result helpers ──

    /**
     * Build a failing `RuleCheckResult` from a registered message key.
     * Extra `args` are forwarded when the template is a function.
     */
    protected fail(
        key: string,
        original: string,
        suggested?: string,
        range?: SourceRange,
        ...args: unknown[]
    ): RuleCheckResult {
        return new RuleCheckResult(
            false,
            this.msg(key, ...args),
            original,
            suggested ?? original,
            [],
            range
        );
    }

    protected msg(key: string, ...args: unknown[]): string {
        const tpl = this.meta.messages[key];
        if (!tpl) return key;
        return typeof tpl === "function" ? tpl(...args) : tpl;
    }

    // ── Execution ──

    /**
     * Tests the given code against this rule.
     * Subclasses implement their own checking strategy here.
     */
    public abstract test(
        code: string,
        ast?: unknown,
        parentCtx?: Context
    ): Promise<RuleCheckResult[]>;

    /**
     * Dispatches child rules sequentially.
     * Available for parent rules that need to coordinate children.
     */
    protected async executeChildren(
        code: string,
        ast: unknown | undefined,
        ctx: Context
    ): Promise<RuleCheckResult[]> {
        const all: RuleCheckResult[] = [];
        for (const child of this.children) {
            const childResults = await child.test(code, ast, ctx);
            all.push(...childResults);
        }
        return all;
    }
}
