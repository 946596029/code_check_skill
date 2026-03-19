import type { CheckFailure } from "../../../../../../tools/section-check";
import { RuleCheckResult } from "../../../../../types/rule/rule";

interface SectionRuleResultOptions {
    passMessage: string;
    summaryMessage: (count: number) => string;
}

export function toSectionRuleResults(
    failures: CheckFailure[],
    options: SectionRuleResultOptions,
): RuleCheckResult[] {
    if (failures.length === 0) {
        return [RuleCheckResult.pass(options.passMessage)];
    }

    const children = failures.map((failure) => {
        const range = failure.line
            ? RuleCheckResult.fromLine(failure.line)
            : undefined;
        return new RuleCheckResult(false, failure.message, "", "", [], range);
    });

    return [
        new RuleCheckResult(
            false,
            options.summaryMessage(children.length),
            "",
            "",
            children,
        ),
    ];
}
