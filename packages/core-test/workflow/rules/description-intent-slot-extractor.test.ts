import { describe, it, expect } from "vitest";
import { extractSlotsForIntent } from "../../../core/src/tools/llm/description-intent";

describe("extractSlotsForIntent", () => {
    it("extracts value-range slots", () => {
        const slots = extractSlotsForIntent(
            "value-range",
            "The valid value is range from `1` to `65,535`."
        );
        expect(slots).toEqual({ min: "1", max: "65,535" });
    });

    it("extracts enum-values slots", () => {
        const slots = extractSlotsForIntent(
            "enum-values",
            "The valid values are as follow:\n+ **1**: Available\n+ **2**: Unavailable"
        );
        expect(slots).toEqual({ valueSet: ["1", "2"] });
    });

    it("extracts default-value slots", () => {
        const slots = extractSlotsForIntent(
            "default-value",
            "The default value is `false`."
        );
        expect(slots).toEqual({ defaultValue: "false" });
    });
});
