import { describe, it, expect } from "vitest";
import {
    NodePattern,
    heading,
    codeBlock,
    nodeType,
    nodeWhere,
    anyNode,
    optionalNode,
    zeroOrMore,
    oneOrMore,
    tagged,
    list,
    group,
    optionalGroup,
    zeroOrMoreGroup,
    oneOrMoreGroup,
} from "../../../core/src/tools/node-pattern";
import type { MarkdownNode } from "../../../core/src/tools/ast-parser/markdown";

function mkNode(
    overrides: Partial<MarkdownNode> & Pick<MarkdownNode, "type">
): MarkdownNode {
    return {
        type: overrides.type,
        literal: null,
        destination: null,
        title: null,
        info: null,
        level: null,
        listType: null,
        listTight: null,
        listStart: null,
        listDelimiter: null,
        data: null,
        sourceRange: null,
        children: [],
        ...overrides,
    };
}

const h3 = mkNode({ type: "heading", level: 3 });
const h2 = mkNode({ type: "heading", level: 2 });
const h1 = mkNode({ type: "heading", level: 1 });
const code = mkNode({ type: "code_block", info: "hcl" });
const codeGo = mkNode({ type: "code_block", info: "go" });
const para = mkNode({ type: "paragraph" });
const fm = mkNode({ type: "frontmatter", data: { title: "test" } });
const bulletList = mkNode({ type: "list", listType: "bullet" });

describe("NodePattern", () => {
    describe("basic matching", () => {
        it("should match a single node by type", () => {
            const pattern = new NodePattern([nodeType("paragraph")]);
            expect(pattern.test([para])).toBe(true);
        });

        it("should reject when type does not match", () => {
            const pattern = new NodePattern([nodeType("paragraph")]);
            expect(pattern.test([h3])).toBe(false);
        });

        it("should match an exact two-node sequence", () => {
            const pattern = new NodePattern([heading(3), codeBlock()]);
            expect(pattern.test([h3, code])).toBe(true);
        });

        it("should reject a reversed sequence", () => {
            const pattern = new NodePattern([heading(3), codeBlock()]);
            expect(pattern.test([code, h3])).toBe(false);
        });

        it("should reject when sequence is shorter than pattern", () => {
            const pattern = new NodePattern([heading(3), codeBlock()]);
            expect(pattern.test([h3])).toBe(false);
        });
    });

    describe("heading matcher", () => {
        it("should match correct heading level", () => {
            const pattern = new NodePattern([heading(1)]);
            expect(pattern.test([h1])).toBe(true);
        });

        it("should reject wrong heading level", () => {
            const pattern = new NodePattern([heading(1)]);
            expect(pattern.test([h3])).toBe(false);
        });
    });

    describe("codeBlock matcher", () => {
        it("should match any code block without info constraint", () => {
            const pattern = new NodePattern([codeBlock()]);
            expect(pattern.test([code])).toBe(true);
            expect(pattern.test([codeGo])).toBe(true);
        });

        it("should match code block with specific info", () => {
            const pattern = new NodePattern([codeBlock("hcl")]);
            expect(pattern.test([code])).toBe(true);
            expect(pattern.test([codeGo])).toBe(false);
        });
    });

    describe("list matcher", () => {
        it("should match any list without type constraint", () => {
            const pattern = new NodePattern([list()]);
            expect(pattern.test([bulletList])).toBe(true);
        });

        it("should match list with specific type", () => {
            const pattern = new NodePattern([list("bullet")]);
            expect(pattern.test([bulletList])).toBe(true);
        });

        it("should reject list with wrong type", () => {
            const pattern = new NodePattern([list("ordered")]);
            expect(pattern.test([bulletList])).toBe(false);
        });
    });

    describe("nodeWhere matcher", () => {
        it("should match using custom predicate", () => {
            const pattern = new NodePattern([
                nodeWhere(
                    (n) => n.type === "frontmatter" && n.data?.title === "test",
                    "frontmatter(title=test)"
                ),
            ]);
            expect(pattern.test([fm])).toBe(true);
        });

        it("should reject when predicate returns false", () => {
            const pattern = new NodePattern([
                nodeWhere(
                    (n) => n.type === "frontmatter" && n.data?.title === "other",
                    "frontmatter(title=other)"
                ),
            ]);
            expect(pattern.test([fm])).toBe(false);
        });
    });

    describe("anyNode matcher", () => {
        it("should match any single node", () => {
            const pattern = new NodePattern([anyNode()]);
            expect(pattern.test([para])).toBe(true);
            expect(pattern.test([h3])).toBe(true);
            expect(pattern.test([code])).toBe(true);
        });

        it("should not match empty array", () => {
            const pattern = new NodePattern([anyNode()]);
            expect(pattern.test([])).toBe(false);
        });
    });

    describe("optionalNode quantifier", () => {
        it("should match when optional node is present", () => {
            const pattern = new NodePattern([
                heading(3),
                optionalNode(nodeType("paragraph")),
                codeBlock(),
            ]);
            expect(pattern.test([h3, para, code])).toBe(true);
        });

        it("should match when optional node is absent", () => {
            const pattern = new NodePattern([
                heading(3),
                optionalNode(nodeType("paragraph")),
                codeBlock(),
            ]);
            expect(pattern.test([h3, code])).toBe(true);
        });
    });

    describe("zeroOrMore quantifier", () => {
        it("should match zero occurrences", () => {
            const pattern = new NodePattern([
                heading(3),
                zeroOrMore(nodeType("paragraph")),
                codeBlock(),
            ]);
            expect(pattern.test([h3, code])).toBe(true);
        });

        it("should match multiple occurrences", () => {
            const pattern = new NodePattern([
                heading(3),
                zeroOrMore(nodeType("paragraph")),
                codeBlock(),
            ]);
            expect(pattern.test([h3, para, para, para, code])).toBe(true);
        });
    });

    describe("oneOrMore quantifier", () => {
        it("should reject zero occurrences", () => {
            const pattern = new NodePattern([
                heading(3),
                oneOrMore(nodeType("paragraph")),
                codeBlock(),
            ]);
            expect(pattern.test([h3, code])).toBe(false);
        });

        it("should match one occurrence", () => {
            const pattern = new NodePattern([
                heading(3),
                oneOrMore(nodeType("paragraph")),
                codeBlock(),
            ]);
            expect(pattern.test([h3, para, code])).toBe(true);
        });

        it("should match multiple occurrences", () => {
            const pattern = new NodePattern([
                heading(3),
                oneOrMore(nodeType("paragraph")),
                codeBlock(),
            ]);
            expect(pattern.test([h3, para, para, code])).toBe(true);
        });
    });

    describe("tagged captures", () => {
        it("should capture nodes by tag name", () => {
            const pattern = new NodePattern([
                tagged("title", heading(3)),
                tagged("code", codeBlock()),
            ]);
            const result = pattern.match([h3, code]);

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            expect(result.value.tagged["title"]).toEqual([h3]);
            expect(result.value.tagged["code"]).toEqual([code]);
        });

        it("should capture multiple nodes with zeroOrMore", () => {
            const pattern = new NodePattern([
                heading(3),
                tagged("between", zeroOrMore(nodeType("paragraph"))),
                codeBlock(),
            ]);
            const result = pattern.match([h3, para, para, code]);

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            expect(result.value.tagged["between"]).toEqual([para, para]);
        });

        it("should have empty array for zero-match tagged capture", () => {
            const pattern = new NodePattern([
                heading(3),
                tagged("between", zeroOrMore(nodeType("paragraph"))),
                codeBlock(),
            ]);
            const result = pattern.match([h3, code]);

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            expect(result.value.tagged["between"]).toEqual([]);
        });
    });

    describe("captures (parallel to matchers)", () => {
        it("should provide captures array aligned with matchers", () => {
            const pattern = new NodePattern([
                heading(3),
                zeroOrMore(nodeType("paragraph")),
                codeBlock(),
            ]);
            const result = pattern.match([h3, para, code]);

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            expect(result.value.captures).toEqual([
                [h3],
                [para],
                [code],
            ]);
        });
    });

    describe("match — failure details", () => {
        it("should report which matcher failed", () => {
            const pattern = new NodePattern([heading(3), codeBlock()]);
            const result = pattern.match([h3, para]);

            expect(result.ok).toBe(false);
            if (result.ok) return;

            expect(result.error.matcherIndex).toBe(1);
            expect(result.error.expectedDisplay).toBe("code_block");
            expect(result.error.actual).toBe(para);
        });

        it("should report end-of-sequence when input is too short", () => {
            const pattern = new NodePattern([heading(3), codeBlock()]);
            const result = pattern.match([h3]);

            expect(result.ok).toBe(false);
            if (result.ok) return;

            expect(result.error.matcherIndex).toBe(1);
            expect(result.error.remainingCount).toBe(0);
            expect(result.error.actual).toBeUndefined();
        });
    });

    describe("describeFailure", () => {
        it("should return null on success", () => {
            const pattern = new NodePattern([heading(3), codeBlock()]);
            expect(pattern.describeFailure([h3, code])).toBeNull();
        });

        it("should return readable message on failure", () => {
            const pattern = new NodePattern([heading(3), codeBlock()]);
            const msg = pattern.describeFailure([h3, para]);
            expect(msg).toContain("matcher #1");
            expect(msg).toContain("code_block");
            expect(msg).toContain("paragraph");
        });
    });

    describe("toDisplayFormat", () => {
        it("should join matcher display strings", () => {
            const pattern = new NodePattern([
                heading(3),
                zeroOrMore(nodeType("paragraph")),
                codeBlock(),
            ]);
            expect(pattern.toDisplayFormat()).toBe(
                "heading(3) [paragraph]* code_block"
            );
        });
    });

    describe("findAll", () => {
        it("should find all non-overlapping matches", () => {
            const pattern = new NodePattern([
                tagged("title", heading(3)),
                tagged("code", codeBlock()),
            ]);

            const nodes = [h3, code, para, h3, code];
            const matches = pattern.findAll(nodes);

            expect(matches).toHaveLength(2);
            expect(matches[0].startIndex).toBe(0);
            expect(matches[0].tagged["title"]).toEqual([h3]);
            expect(matches[1].startIndex).toBe(3);
        });

        it("should skip nodes that don't start a match", () => {
            const pattern = new NodePattern([
                tagged("title", heading(3)),
                tagged("code", codeBlock()),
            ]);

            const nodes = [para, para, h3, code, para];
            const matches = pattern.findAll(nodes);

            expect(matches).toHaveLength(1);
            expect(matches[0].startIndex).toBe(2);
        });

        it("should return empty when no matches exist", () => {
            const pattern = new NodePattern([
                heading(3),
                codeBlock(),
            ]);

            const nodes = [para, code, para];
            const matches = pattern.findAll(nodes);

            expect(matches).toHaveLength(0);
        });

        it("should handle zeroOrMore in findAll", () => {
            const notCodeNotH3 = nodeWhere(
                (n) => n.type !== "code_block" &&
                    !(n.type === "heading" && n.level === 3),
                "non-code, non-h3"
            );
            const pattern = new NodePattern([
                tagged("title", heading(3)),
                zeroOrMore(notCodeNotH3),
                tagged("code", codeBlock()),
            ]);

            const nodes = [h3, para, code, h3, code];
            const matches = pattern.findAll(nodes);

            expect(matches).toHaveLength(2);
            expect(matches[0].startIndex).toBe(0);
            expect(matches[0].length).toBe(3);
            expect(matches[1].startIndex).toBe(3);
            expect(matches[1].length).toBe(2);
        });

        it("should find unmatched code blocks (example-usage scenario)", () => {
            const notCodeNotH3 = nodeWhere(
                (n) => n.type !== "code_block" &&
                    !(n.type === "heading" && n.level === 3),
                "non-code, non-h3"
            );
            const h3ThenCode = new NodePattern([
                tagged("title", heading(3)),
                zeroOrMore(notCodeNotH3),
                tagged("code", codeBlock()),
            ]);

            const code2 = mkNode({ type: "code_block", info: "hcl" });
            const nodes = [h3, code, para, code2];

            const allCodeBlocks = nodes.filter(
                (n) => n.type === "code_block"
            );
            const matches = h3ThenCode.findAll(nodes);
            const matchedCodes = new Set(
                matches.flatMap((m) => m.tagged["code"])
            );
            const unmatched = allCodeBlocks.filter(
                (n) => !matchedCodes.has(n)
            );

            expect(allCodeBlocks).toHaveLength(2);
            expect(matches).toHaveLength(1);
            expect(unmatched).toHaveLength(1);
            expect(unmatched[0]).toBe(code2);
        });
    });

    describe("group — exact once", () => {
        it("should match a group of two nodes exactly once", () => {
            const pattern = new NodePattern([
                group([nodeType("paragraph"), list("bullet")]),
            ]);
            expect(pattern.test([para, bulletList])).toBe(true);
        });

        it("should reject when group sequence is incomplete", () => {
            const pattern = new NodePattern([
                group([nodeType("paragraph"), list("bullet")]),
            ]);
            expect(pattern.test([para])).toBe(false);
        });

        it("should reject when group sequence order is wrong", () => {
            const pattern = new NodePattern([
                group([nodeType("paragraph"), list("bullet")]),
            ]);
            expect(pattern.test([bulletList, para])).toBe(false);
        });
    });

    describe("optionalGroup", () => {
        it("should match when group is present", () => {
            const pattern = new NodePattern([
                heading(3),
                optionalGroup([nodeType("paragraph"), codeBlock()]),
            ]);
            expect(pattern.test([h3, para, code])).toBe(true);
        });

        it("should match when group is absent", () => {
            const pattern = new NodePattern([
                heading(3),
                optionalGroup([nodeType("paragraph"), codeBlock()]),
            ]);
            expect(pattern.test([h3])).toBe(true);
        });

        it("should not partially consume when group doesn't fully match", () => {
            const pattern = new NodePattern([
                heading(3),
                optionalGroup([nodeType("paragraph"), codeBlock()]),
                nodeType("paragraph"),
            ]);
            // para doesn't complete (paragraph, codeBlock), so optional → 0,
            // then the trailing paragraph matcher picks up para
            expect(pattern.test([h3, para])).toBe(true);
        });
    });

    describe("zeroOrMoreGroup", () => {
        it("should match zero repetitions", () => {
            const pattern = new NodePattern([
                heading(3),
                zeroOrMoreGroup([nodeType("paragraph"), list("bullet")]),
                codeBlock(),
            ]);
            expect(pattern.test([h3, code])).toBe(true);
        });

        it("should match one repetition", () => {
            const pattern = new NodePattern([
                heading(3),
                zeroOrMoreGroup([nodeType("paragraph"), list("bullet")]),
                codeBlock(),
            ]);
            expect(pattern.test([h3, para, bulletList, code])).toBe(true);
        });

        it("should match multiple repetitions", () => {
            const pattern = new NodePattern([
                heading(3),
                zeroOrMoreGroup([nodeType("paragraph"), list("bullet")]),
                codeBlock(),
            ]);
            expect(pattern.test([
                h3,
                para, bulletList,
                para, bulletList,
                para, bulletList,
                code,
            ])).toBe(true);
        });

        it("should stop at a partial repetition", () => {
            const pattern = new NodePattern([
                zeroOrMoreGroup([nodeType("paragraph"), list("bullet")]),
            ]);
            // para, bulletList → 1 rep; para alone → partial, stop
            const result = pattern.match([para, bulletList, para]);
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value.length).toBe(2);
        });
    });

    describe("oneOrMoreGroup", () => {
        it("should reject zero repetitions", () => {
            const pattern = new NodePattern([
                heading(3),
                oneOrMoreGroup([nodeType("paragraph"), list("bullet")]),
                codeBlock(),
            ]);
            expect(pattern.test([h3, code])).toBe(false);
        });

        it("should match one repetition", () => {
            const pattern = new NodePattern([
                heading(3),
                oneOrMoreGroup([nodeType("paragraph"), list("bullet")]),
                codeBlock(),
            ]);
            expect(pattern.test([h3, para, bulletList, code])).toBe(true);
        });

        it("should match multiple repetitions", () => {
            const pattern = new NodePattern([
                heading(3),
                oneOrMoreGroup([nodeType("paragraph"), list("bullet")]),
                codeBlock(),
            ]);
            expect(pattern.test([
                h3,
                para, bulletList,
                para, bulletList,
                code,
            ])).toBe(true);
        });
    });

    describe("group — tagged captures", () => {
        it("should capture group-level tag with all nodes", () => {
            const pattern = new NodePattern([
                heading(3),
                tagged("pairs", oneOrMoreGroup([
                    nodeType("paragraph"),
                    list("bullet"),
                ])),
                codeBlock(),
            ]);
            const result = pattern.match([h3, para, bulletList, para, bulletList, code]);
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            expect(result.value.tagged["pairs"]).toEqual([
                para, bulletList, para, bulletList,
            ]);
        });

        it("should accumulate inner tags across repetitions", () => {
            const pattern = new NodePattern([
                oneOrMoreGroup([
                    tagged("desc", nodeType("paragraph")),
                    tagged("items", list("bullet")),
                ]),
            ]);

            const para2 = mkNode({ type: "paragraph" });
            const bl2 = mkNode({ type: "list", listType: "bullet" });
            const result = pattern.match([para, bulletList, para2, bl2]);
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            expect(result.value.tagged["desc"]).toEqual([para, para2]);
            expect(result.value.tagged["items"]).toEqual([bulletList, bl2]);
        });

        it("should have empty tagged for zero-match zeroOrMoreGroup", () => {
            const pattern = new NodePattern([
                tagged("g", zeroOrMoreGroup([nodeType("paragraph"), list("bullet")])),
            ]);
            const result = pattern.match([]);
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            expect(result.value.tagged["g"]).toEqual([]);
        });
    });

    describe("group — toDisplayFormat", () => {
        it("should render group display with quantifier suffix", () => {
            const pattern = new NodePattern([
                heading(3),
                oneOrMoreGroup([nodeType("paragraph"), list("bullet")]),
                codeBlock(),
            ]);
            expect(pattern.toDisplayFormat()).toBe(
                "heading(3) (paragraph list(bullet))+ code_block"
            );
        });

        it("should render optional group display", () => {
            const pattern = new NodePattern([
                optionalGroup([nodeType("paragraph"), codeBlock()]),
            ]);
            expect(pattern.toDisplayFormat()).toBe("(paragraph code_block)?");
        });

        it("should render zeroOrMore group display", () => {
            const pattern = new NodePattern([
                zeroOrMoreGroup([heading(2), nodeType("paragraph")]),
            ]);
            expect(pattern.toDisplayFormat()).toBe("(heading(2) paragraph)*");
        });
    });

    describe("group — describeFailure", () => {
        it("should report group failure with group display", () => {
            const pattern = new NodePattern([
                heading(3),
                oneOrMoreGroup([nodeType("paragraph"), list("bullet")]),
            ]);
            const msg = pattern.describeFailure([h3, code]);
            expect(msg).toContain("matcher #1");
            expect(msg).toContain("(paragraph list(bullet))+");
        });
    });

    describe("group — findAll", () => {
        it("should find groups in findAll scan", () => {
            const pattern = new NodePattern([
                tagged("h", heading(3)),
                tagged("body", oneOrMoreGroup([
                    nodeType("paragraph"),
                    list("bullet"),
                ])),
            ]);

            const h3b = mkNode({ type: "heading", level: 3 });
            const nodes = [
                h3, para, bulletList,
                h2,
                h3b, para, bulletList, para, bulletList,
            ];

            const matches = pattern.findAll(nodes);
            expect(matches).toHaveLength(2);
            expect(matches[0].startIndex).toBe(0);
            expect(matches[0].length).toBe(3);
            expect(matches[1].startIndex).toBe(4);
            expect(matches[1].length).toBe(5);
        });
    });

    describe("group — mixed with single matchers", () => {
        it("should work alongside zeroOrMore single matchers", () => {
            const pattern = new NodePattern([
                heading(3),
                zeroOrMore(nodeType("paragraph")),
                oneOrMoreGroup([list("bullet"), codeBlock()]),
            ]);

            expect(pattern.test([h3, para, para, bulletList, code])).toBe(true);
            expect(pattern.test([h3, bulletList, code, bulletList, code])).toBe(true);
            expect(pattern.test([h3, para])).toBe(false);
        });
    });
});
