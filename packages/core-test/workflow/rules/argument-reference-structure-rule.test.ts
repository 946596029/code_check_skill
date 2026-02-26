import { describe, it, expect, vi } from "vitest";
import { MarkdownParser, RESOURCE_DOC_RULES } from "@code-check/core";

const parser = new MarkdownParser();

describe("ArgumentReferenceStructureRule", () => {
    it("should pass continuation constraint text to detector", async () => {
        const rule = RESOURCE_DOC_RULES.find(
            (item) => item.name === "argument-reference-structure"
        );
        expect(rule).toBeDefined();

        const detect = vi.fn().mockResolvedValue({
            status: "none",
            intents: [],
        });

        const ruleAny = rule as any;
        const originalGetDetector = ruleAny.getDetector.bind(ruleAny);
        ruleAny.getDetector = () => ({ detect });

        const md = [
            "## Argument Reference",
            "",
            "The following arguments are supported:",
            "",
            "* `ecs_name` - (Optional, String) Specifies the name of the ECS instance.  ",
            "  Only the Chinese characters, English letters, numbers, underscores(_), hyphens(-) and dots(.) are allowed",
            "  and the valid value is range from `0` to `255`.",
        ].join("\n");

        try {
            const ast = parser.parse(md);
            await rule!.test(md, ast);
        } finally {
            ruleAny.getDetector = originalGetDetector;
        }

        expect(detect).toHaveBeenCalledWith(
            "ecs_name",
            "Only the Chinese characters, English letters, numbers, underscores(_), hyphens(-) and dots(.) are allowed and the valid value is range from `0` to `255`."
        );
    });
});
