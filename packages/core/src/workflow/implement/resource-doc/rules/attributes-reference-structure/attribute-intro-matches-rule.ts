import { Rule, RuleCheckResult, RuleMeta } from "../../../../types/rule/rule";
import { Context } from "../../../../context/context";
import { CTX_ATTR_REF_LINES } from "../../context-keys";

const EXPECTED_INTRO =
    "In addition to all arguments above, the following attributes are exported:";

const META: RuleMeta = {
    name: "attribute-intro-matches",
    description:
        `Attributes Reference must start with "${EXPECTED_INTRO}"`,
    messages: {
        wrongIntro:
            `Attributes Reference must start with "${EXPECTED_INTRO}".`,
    },
};

export class AttributeIntroMatchesRule extends Rule {
    constructor() {
        super(META, "code");
    }

    public async test(
        code: string,
        _ast?: unknown,
        parentCtx?: Context
    ): Promise<RuleCheckResult[]> {
        const lines = parentCtx?.get<string[]>(CTX_ATTR_REF_LINES);
        if (!lines) return [];

        const firstNonEmptyIndex = lines.findIndex(
            (l) => l.trim().length > 0
        );
        if (firstNonEmptyIndex < 0) return [];

        const firstNonEmpty = lines[firstNonEmptyIndex].trim();
        if (firstNonEmpty !== EXPECTED_INTRO) {
            return [this.fail("wrongIntro", code)];
        }

        return [];
    }
}
