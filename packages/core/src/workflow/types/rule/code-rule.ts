import { Feature } from "../feature/feature";
import { Rule, RuleType, MatcherFn } from "./rule";

export abstract class CodeRule extends Rule {
    protected readonly pattern: RegExp | null;
    protected readonly errorMessage: string;

    public constructor(
        name: string,
        description: string,
        pattern: RegExp | null = null,
        errorMessage: string = "",
        features: Feature[] = [],
        matcher: MatcherFn | null = null
    ) {
        const ruleType: RuleType = "code";
        super(name, description, ruleType, features, matcher);
        this.pattern = pattern;
        this.errorMessage = errorMessage;
    }
}
