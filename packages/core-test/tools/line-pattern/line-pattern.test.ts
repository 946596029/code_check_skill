import { describe, it, expect } from "vitest";
import {
    LinePattern,
    literal,
    backticked,
    parenthesized,
    csvParenthesized,
    spaces,
    keyword,
    rest,
    optional,
} from "../../../core/src/tools/line-pattern";

const MODIFIERS = ["Required", "Optional"];
const TYPES = ["String", "Int", "Bool", "List", "Map", "Float", "Set"];
const TAGS = ["ForceNew", "NonUpdatable", "Deprecated", "Computed", "Sensitive"];

/**
 * Pattern under test:
 *   * `arg_name` - (Modifier, Type[, Tag...]) Specifies description
 */
const argBulletPattern = new LinePattern([
    literal("* "),
    backticked("arg_name"),
    spaces(),
    literal("-"),
    spaces(),
    csvParenthesized([
        { name: "Modifier", values: MODIFIERS },
        { name: "Type", values: TYPES },
        { name: "Tag", values: TAGS, zeroOrMore: true },
    ]),
    spaces(),
    keyword("Specifies"),
    spaces(),
    rest("description"),
]);

/**
 * Simpler pattern under test:
 *   * `attr_name` - description
 */
const attrBulletPattern = new LinePattern([
    literal("* "),
    backticked("attr_name"),
    spaces(),
    literal("-"),
    spaces(),
    rest("description"),
]);

describe("LinePattern", () => {
    describe("toDisplayFormat", () => {
        it("should produce human-readable format for arg bullet", () => {
            expect(argBulletPattern.toDisplayFormat()).toBe(
                "* `arg_name` - (Modifier, Type[, Tag...]) Specifies description"
            );
        });

        it("should produce human-readable format for attr bullet", () => {
            expect(attrBulletPattern.toDisplayFormat()).toBe(
                "* `attr_name` - description"
            );
        });
    });

    describe("test (arg bullet)", () => {
        it("should match a valid argument bullet", () => {
            const line =
                "* `name` - (Required, String) Specifies the resource name";
            expect(argBulletPattern.test(line)).toBe(true);
        });

        it("should match with one trailing tag", () => {
            const line =
                "* `cidr` - (Required, String, ForceNew) " +
                "Specifies the CIDR block";
            expect(argBulletPattern.test(line)).toBe(true);
        });

        it("should match with multiple trailing tags", () => {
            const line =
                "* `cidr` - (Optional, String, ForceNew, Deprecated) " +
                "Specifies the CIDR block";
            expect(argBulletPattern.test(line)).toBe(true);
        });

        it("should match Optional modifier", () => {
            const line =
                "* `region` - (Optional, String) Specifies the region";
            expect(argBulletPattern.test(line)).toBe(true);
        });

        it("should match non-String types", () => {
            expect(
                argBulletPattern.test(
                    "* `port` - (Required, Int) Specifies the port"
                )
            ).toBe(true);
            expect(
                argBulletPattern.test(
                    "* `enabled` - (Optional, Bool) Specifies whether enabled"
                )
            ).toBe(true);
            expect(
                argBulletPattern.test(
                    "* `tags` - (Optional, Map) Specifies the tags"
                )
            ).toBe(true);
        });

        it("should reject an unknown modifier", () => {
            const line =
                "* `name` - (Mandatory, String) Specifies the name";
            expect(argBulletPattern.test(line)).toBe(false);
        });

        it("should reject an unknown type", () => {
            const line =
                "* `name` - (Required, Number) Specifies the name";
            expect(argBulletPattern.test(line)).toBe(false);
        });

        it("should reject an unknown trailing tag", () => {
            const line =
                "* `name` - (Required, String, ReadOnly) Specifies the name";
            expect(argBulletPattern.test(line)).toBe(false);
        });

        it("should reject a line missing the parenthesized group", () => {
            const line = "* `name` - Specifies the resource name";
            expect(argBulletPattern.test(line)).toBe(false);
        });

        it("should reject a line missing 'Specifies'", () => {
            const line =
                "* `name` - (Required, String) the resource name";
            expect(argBulletPattern.test(line)).toBe(false);
        });

        it("should reject a line without backticked name", () => {
            const line =
                "* name - (Required, String) Specifies the resource name";
            expect(argBulletPattern.test(line)).toBe(false);
        });

        it("should reject a plain paragraph line", () => {
            expect(argBulletPattern.test("some plain text")).toBe(false);
        });

        it("should reject an empty string", () => {
            expect(argBulletPattern.test("")).toBe(false);
        });
    });

    describe("test (attr bullet)", () => {
        it("should match a valid attribute bullet", () => {
            const line = "* `id` - The resource ID";
            expect(attrBulletPattern.test(line)).toBe(true);
        });

        it("should reject a line without the dash separator", () => {
            const line = "* `id` The resource ID";
            expect(attrBulletPattern.test(line)).toBe(false);
        });
    });

    describe("match — captures", () => {
        it("should capture each segment individually", () => {
            const line =
                "* `vpc_id` - (Required, String) Specifies the VPC ID";
            const result = argBulletPattern.match(line);

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const c = result.value.captures;
            expect(c[0]).toBe("* ");
            expect(c[1]).toBe("`vpc_id`");
            expect(c[3]).toBe("-");
            expect(c[5]).toBe("(Required, String)");
            expect(c[7]).toBe("Specifies");
            expect(c[9]).toBe("the VPC ID");
        });
    });

    describe("match — failure details", () => {
        it("should report which segment failed", () => {
            const line = "* `name` - Required Specifies foo";
            const result = argBulletPattern.match(line);

            expect(result.ok).toBe(false);
            if (result.ok) return;

            expect(result.error.segmentIndex).toBe(5);
            expect(result.error.expectedDisplay).toBe(
                "(Modifier, Type[, Tag...])"
            );
        });
    });

    describe("describeFailure", () => {
        it("should return null for a matching line", () => {
            const line =
                "* `name` - (Required, String) Specifies the name";
            expect(argBulletPattern.describeFailure(line)).toBeNull();
        });

        it("should return a readable message for a mismatch", () => {
            const line = "* name - broken";
            const msg = argBulletPattern.describeFailure(line);
            expect(msg).toContain("Mismatch at position");
            expect(msg).toContain("expected");
        });
    });

    describe("optional segments", () => {
        const patternWithOptional = new LinePattern([
            literal("* "),
            backticked("name"),
            spaces(),
            literal("-"),
            spaces(),
            optional(parenthesized("Tags")),
            optional(spaces()),
            rest("description"),
        ]);

        it("should match when optional segment is present", () => {
            const line = "* `foo` - (Required) some description";
            expect(patternWithOptional.test(line)).toBe(true);
        });

        it("should match when optional segment is absent", () => {
            const line = "* `foo` - some description";
            expect(patternWithOptional.test(line)).toBe(true);
        });
    });
});
