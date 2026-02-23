import { Rule, RuleCheckResult, RuleMeta } from "../../../../types/rule/rule";
import { Context } from "../../../../context/context";
import { CTX_RESOURCE_NAME, CTX_H1_TITLE } from "../../context-keys";

const META: RuleMeta = {
    name: "h1-title-matches-resource",
    description: "H1 title must match frontmatter resource name",
    messages: {
        mismatch: (actual: unknown, expected: unknown) =>
            `H1 title "${actual}" does not match ` +
            `frontmatter resource name "${expected}"`,
    },
};

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class H1TitleMatchesResourceRule extends Rule {
    constructor() {
        super(META, "code");
    }

    public async test(
        code: string,
        _ast?: unknown,
        parentCtx?: Context
    ): Promise<RuleCheckResult[]> {
        const actualTitle = parentCtx?.get<string>(CTX_H1_TITLE);
        const resourceName = parentCtx?.get<string>(CTX_RESOURCE_NAME);
        if (!actualTitle || !resourceName) return [];

        if (actualTitle !== resourceName) {
            const suggested = code.replace(
                new RegExp(`^#\\s*${escapeRegex(actualTitle)}`, "m"),
                `# ${resourceName}`
            );
            return [
                this.fail(
                    "mismatch",
                    code,
                    suggested,
                    actualTitle,
                    resourceName
                ),
            ];
        }

        return [];
    }
}
