import { describe, it, expect } from "vitest";
import { getFormatSpec, type DescriptionIntent } from "@code-check/core";

describe("DescriptionFormatSpec — value-range", () => {
    const spec = getFormatSpec("value-range")!;

    it("should pass for correct format", () => {
        const result = spec.validate([
            "The valid value is range from `0` to `65,535`.",
        ]);
        expect(result.ok).toBe(true);
    });

    it("should pass for different range values", () => {
        const result = spec.validate([
            "The valid value is range from `1` to `100`.",
        ]);
        expect(result.ok).toBe(true);
    });

    it("should fail when missing backticks around numbers", () => {
        const result = spec.validate([
            "The valid value is range from 0 to 65535.",
        ]);
        expect(result.ok).toBe(false);
    });

    it("should fail for wrong wording", () => {
        const result = spec.validate([
            "Values range from `0` to `100`.",
        ]);
        expect(result.ok).toBe(false);
    });

    it("should find the relevant line among multiple lines", () => {
        const result = spec.validate([
            "Some unrelated description.",
            "The valid value is range from `0` to `255`.",
        ]);
        expect(result.ok).toBe(true);
    });
});

describe("DescriptionFormatSpec — enum-values", () => {
    const spec = getFormatSpec("enum-values")!;

    it("should pass for correct intro and items", () => {
        const result = spec.validate([
            "The valid values are as follow:",
            "+ **1**: Available",
            "+ **2**: Unavailable",
        ]);
        expect(result.ok).toBe(true);
    });

    it("should fail for wrong intro text", () => {
        const result = spec.validate([
            "Valid values include:",
            "+ **1**: Available",
        ]);
        expect(result.ok).toBe(false);
    });

    it("should fail when items don't use bold markers", () => {
        const result = spec.validate([
            "The valid values are as follow:",
            "+ 1: Available",
            "+ 2: Unavailable",
        ]);
        expect(result.ok).toBe(false);
    });
});

describe("DescriptionFormatSpec — char-restriction", () => {
    const spec = getFormatSpec("char-restriction")!;

    it("should pass for correct format", () => {
        const result = spec.validate([
            "Only the Chinese characters, English letters, numbers, underscores(_), hyphens(-) and dots(.) are allowed",
        ]);
        expect(result.ok).toBe(true);
    });

    it("should pass for simpler char type list", () => {
        const result = spec.validate([
            "Only the English letters, numbers, underscores(_) and hyphens(-) are allowed",
        ]);
        expect(result.ok).toBe(true);
    });

    it("should fail when not starting with 'Only the'", () => {
        const result = spec.validate([
            "Allowed characters: letters, numbers and underscores",
        ]);
        expect(result.ok).toBe(false);
    });
});

describe("DescriptionFormatSpec — max-length", () => {
    const spec = getFormatSpec("max-length")!;

    it("should pass for correct format", () => {
        const result = spec.validate([
            "The member_ip_address contain a maximum of `255` characters.",
        ]);
        expect(result.ok).toBe(true);
    });

    it("should fail when number is not backticked", () => {
        const result = spec.validate([
            "The member_ip_address contain a maximum of 255 characters.",
        ]);
        expect(result.ok).toBe(false);
    });
});

describe("DescriptionFormatSpec — default-value", () => {
    const spec = getFormatSpec("default-value")!;

    it("should pass for correct format with backticked value", () => {
        const result = spec.validate([
            "The default value is `false`.",
        ]);
        expect(result.ok).toBe(true);
    });

    it("should pass for numeric default", () => {
        const result = spec.validate([
            "The default value is `0`.",
        ]);
        expect(result.ok).toBe(true);
    });

    it("should fail when value is not backticked", () => {
        const result = spec.validate([
            "The default value is false.",
        ]);
        expect(result.ok).toBe(false);
    });

    it("should fail for wrong prefix", () => {
        const result = spec.validate([
            "Defaults to `false`.",
        ]);
        expect(result.ok).toBe(false);
    });
});

describe("getFormatSpec", () => {
    it("should return undefined for 'none' intent", () => {
        expect(getFormatSpec("none")).toBeUndefined();
    });

    it("should return a spec for each known intent", () => {
        const intents: DescriptionIntent[] = [
            "value-range", "enum-values", "char-restriction",
            "max-length", "default-value",
        ];
        for (const intent of intents) {
            expect(getFormatSpec(intent)).toBeDefined();
        }
    });
});
