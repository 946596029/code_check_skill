import { Rule, RuleCheckResult, RuleMeta } from "../../../types/rule/rule";
import type { Context } from "../../../context/context";

export interface StagePlaceholderOptions {
    name: string;
    description: string;
    message: string;
    success?: boolean;
    rangeLine?: number;
}

function createMeta(opts: StagePlaceholderOptions): RuleMeta {
    return {
        name: opts.name,
        description: opts.description,
        messages: { result: opts.message },
    };
}

/**
 * Placeholder rule used during staged resource-check flow.
 * Keeps the report contract stable while real checks are pending.
 */
export class StagePlaceholderRule extends Rule {
    private readonly opts: StagePlaceholderOptions;

    constructor(opts: StagePlaceholderOptions) {
        super(createMeta(opts), "code");
        this.opts = opts;
    }

    public async test(
        _code: string,
        _ast?: unknown,
        _parentCtx?: Context
    ): Promise<RuleCheckResult[]> {
        const success = this.opts.success ?? true;
        const range = RuleCheckResult.fromLine(this.opts.rangeLine ?? 1);

        if (success) {
            return [RuleCheckResult.pass(this.msg("result"), range)];
        }
        return [this.fail("result", "", undefined, range)];
    }
}
