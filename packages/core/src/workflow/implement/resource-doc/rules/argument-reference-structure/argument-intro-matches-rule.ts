import { Rule, RuleCheckResult, RuleMeta } from "../../../../types/rule/rule";
import { Context } from "../../../../context/context";
import { CTX_ARG_REF_LINES } from "../../context-keys";

const EXPECTED_INTRO = "The following arguments are supported:";

const META: RuleMeta = {
    name: "argument-intro-matches",
    description:
        `Argument Reference must start with "${EXPECTED_INTRO}"`,
    messages: {
        wrongIntro:
            `Argument Reference must start with "${EXPECTED_INTRO}".`,
    },
};

export class ArgumentIntroMatchesRule extends Rule {
    constructor() {
        super(META, "code");
    }

    public async test(
        code: string,
        _ast?: unknown,
        parentCtx?: Context
    ): Promise<RuleCheckResult[]> {
        const lines = parentCtx?.get<string[]>(CTX_ARG_REF_LINES);
        if (!lines) return [];

        const firstNonEmpty = lines.find((l) => l.trim().length > 0);
        if (firstNonEmpty && firstNonEmpty.trim() !== EXPECTED_INTRO) {
            return [this.fail("wrongIntro", code)];
        }

        return [];
    }
}
