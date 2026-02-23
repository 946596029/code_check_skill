import { Rule, RuleCheckResult, RuleMeta } from "../../../../types/rule/rule";
import { Context } from "../../../../context/context";
import { CTX_EXPECTED_DESCRIPTION, CTX_H1_DESC_TEXT } from "../../context-keys";

const META: RuleMeta = {
    name: "h1-description-matches",
    description:
        "Description under H1 must match frontmatter description",
    messages: {
        mismatch: (expected: unknown) =>
            `Description under H1 does not match frontmatter. ` +
            `Expected: "${String(expected).slice(0, 60)}..."`,
    },
};

const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

export class H1DescriptionMatchesRule extends Rule {
    constructor() {
        super(META, "code");
    }

    public async test(
        code: string,
        _ast?: unknown,
        parentCtx?: Context
    ): Promise<RuleCheckResult[]> {
        const expected = parentCtx?.get<string>(CTX_EXPECTED_DESCRIPTION);
        const actual = parentCtx?.get<string>(CTX_H1_DESC_TEXT);
        if (!expected || actual === undefined) return [];

        if (normalize(actual) !== normalize(expected)) {
            return [this.fail("mismatch", code, undefined, expected)];
        }

        return [];
    }
}
