import {
    MarkdownParser,
    type MarkdownNode,
    type SourceRange,
} from "../../../../../tools/ast-parser/markdown";
import {
    LinePattern,
    literal,
    backticked,
    spaces,
    rest,
    csvParenthesized,
} from "../../../../../tools/line-pattern";
import type {
    Argument,
    ArgumentList,
    Attribute,
    AttributeList,
    BuildDiagnostic,
    DocBlock,
    DocBlockType,
    DocBlockView,
    Example,
    ExampleList,
    FrontMatter,
    Import,
    StringTree,
    TimeOut,
    Title,
} from "./types";
import { DocSemanticView } from "./types";

const MODIFIERS = ["Required", "Optional"];
const TYPES = ["String", "Int", "Bool", "List", "Map", "Float", "Set"];
const TAGS = ["ForceNew", "NonUpdatable", "Deprecated", "Computed", "Sensitive"];

export const ARG_BULLET_PATTERN = new LinePattern([
    literal("* "),
    backticked("arg_name"),
    spaces(1),
    literal("-"),
    spaces(1),
    csvParenthesized([
        { name: "Modifier", values: MODIFIERS },
        { name: "Type", values: TYPES },
        { name: "Tag", values: TAGS, zeroOrMore: true },
    ]),
    spaces(1),
    rest("description"),
]);

export const ATTR_BULLET_PATTERN = new LinePattern([
    literal("* "),
    backticked("attr_name"),
    spaces(1),
    literal("-"),
    spaces(1),
    rest("description"),
]);

export function buildDocSemanticView(
    ast: MarkdownNode,
    source: string,
    parser: MarkdownParser = new MarkdownParser(),
): DocSemanticView {
    const diagnostics: BuildDiagnostic[] = [];
    const blocks: DocBlockView[] = [];

    const frontMatter = buildFrontMatter(parser, ast, diagnostics);
    if (frontMatter) blocks.push(frontMatter);

    const title = buildTitle(parser, ast, diagnostics);
    if (title) blocks.push(title);

    const examples = buildExampleList(parser, ast, diagnostics);
    if (examples) blocks.push(examples);

    const argumentList = buildArgumentList(parser, ast, source, diagnostics);
    if (argumentList) blocks.push(argumentList);

    const attributeList = buildAttributeList(parser, ast, source, diagnostics);
    if (attributeList) blocks.push(attributeList);

    blocks.push(buildImport(parser, ast, diagnostics));

    const timeOut = buildTimeOut(parser, ast, source, diagnostics);
    if (timeOut) blocks.push(timeOut);

    return new DocSemanticView(blocks, diagnostics);
}

export function buildFrontMatter(
    parser: MarkdownParser,
    ast: MarkdownNode,
    diagnostics: BuildDiagnostic[],
): DocBlockView<FrontMatter> | null {
    const node = parser.findFirst(ast, (n) => n.type === "frontmatter");
    if (!node) return null;

    const raw = asRecord(node.data);
    const block: FrontMatter = {
        subcategory: asString(raw.subcategory),
        pageTitle: asString(raw.page_title),
        description: normalizeInlineText(raw.description),
        raw,
        sourceRange: node.sourceRange ?? undefined,
    };

    if (!block.pageTitle) {
        diagnostics.push({
            level: "warning",
            code: "DOC_FRONTMATTER_PAGE_TITLE_MISSING",
            message: "FrontMatter is missing page_title.",
            sourceRange: node.sourceRange ?? undefined,
        });
    }

    return toBlockView("FrontMatter", block, [node]);
}

export function buildTitle(
    parser: MarkdownParser,
    ast: MarkdownNode,
    diagnostics: BuildDiagnostic[],
): DocBlockView<Title> | null {
    const body = parser.getBodyChildren(ast);
    const heading = body.find(
        (n) => n.type === "heading" && (n.level ?? 0) === 1,
    );
    if (!heading) {
        diagnostics.push({
            level: "warning",
            code: "DOC_TITLE_MISSING",
            message: "H1 title is missing.",
        });
        return null;
    }

    const titleText = parser.getTextContent(heading).trim();
    const descNode = parser.getNextSibling(
        ast,
        heading,
        (n) => n.type === "paragraph",
    );
    const description = descNode
        ? normalizeInlineText(parser.getTextContent(descNode))
        : "";

    return toBlockView<Title>(
        "Title",
        {
            title: titleText,
            description,
            sourceRange: mergeSourceRange(
                heading.sourceRange ?? undefined,
                descNode?.sourceRange ?? undefined,
            ),
        },
        descNode ? [heading, descNode] : [heading],
    );
}

export function buildExampleList(
    parser: MarkdownParser,
    ast: MarkdownNode,
    diagnostics: BuildDiagnostic[],
): DocBlockView<ExampleList> | null {
    const section = parser.getSection(ast, 2, "Example Usage");
    if (!section) return null;

    const examples: Example[] = [];
    let currentTitle = "";

    for (const node of section) {
        if (node.type === "heading" && (node.level ?? 0) === 3) {
            currentTitle = parser.getTextContent(node).trim();
            continue;
        }
        if (node.type !== "code_block") continue;

        const language = (node.info ?? "").trim().toLowerCase();
        if (language && language !== "hcl") continue;

        examples.push({
            title: currentTitle || `Example ${examples.length + 1}`,
            code: node.literal ?? "",
            sourceRange: node.sourceRange ?? undefined,
        });
    }

    if (examples.length === 0) {
        diagnostics.push({
            level: "warning",
            code: "DOC_EXAMPLE_SECTION_EMPTY",
            message: "Example Usage section exists but has no hcl code blocks.",
            sourceRange: getRangeFromNodes(section),
        });
    }

    return toBlockView<ExampleList>(
        "ExampleList",
        {
            title: "Example Usage",
            examples,
            sourceRange: getRangeFromNodes(section),
        },
        section,
    );
}

export function buildArgumentList(
    parser: MarkdownParser,
    ast: MarkdownNode,
    source: string,
    diagnostics: BuildDiagnostic[],
): DocBlockView<ArgumentList> | null {
    const section = parser.getSection(ast, 2, "Argument Reference");
    if (!section) return null;

    const description = extractSectionDescription(parser, section);
    const topList = findFirstNodeByType(section, "list");
    const args = topList
        ? parseArgumentItemsFromList(parser, source, topList, diagnostics)
        : [];

    const nestedLists = collectNestedSupportLists(parser, section);
    for (const nested of nestedLists) {
        const children = parseArgumentItemsFromList(
            parser,
            source,
            nested.listNode,
            diagnostics,
        );
        const attached = attachNestedArguments(args, nested.parentName, children);
        if (!attached) {
            diagnostics.push({
                level: "warning",
                code: "DOC_ARGUMENT_NESTED_PARENT_NOT_FOUND",
                message: `Nested argument block parent not found: ${nested.parentName}`,
                sourceRange: nested.listNode.sourceRange ?? undefined,
            });
        }
    }

    return toBlockView<ArgumentList>(
        "ArgumentList",
        {
            title: "Argument Reference",
            description,
            isComputed: () => hasComputedArgument(args),
            arguments: args,
            sourceRange: getRangeFromNodes(section),
        },
        section,
    );
}

export function buildAttributeList(
    parser: MarkdownParser,
    ast: MarkdownNode,
    source: string,
    diagnostics: BuildDiagnostic[],
): DocBlockView<AttributeList> | null {
    const sectionInfo = getSectionByTitles(parser, ast, 2, [
        "Attributes Reference",
        "Attribute Reference",
    ]);
    if (!sectionInfo) return null;

    const description = extractSectionDescription(parser, sectionInfo.nodes);
    const topList = findFirstNodeByType(sectionInfo.nodes, "list");
    const attrs = topList
        ? parseAttributeItemsFromList(parser, source, topList, diagnostics)
        : [];

    const nestedLists = collectNestedSupportLists(parser, sectionInfo.nodes);
    for (const nested of nestedLists) {
        const children = parseAttributeItemsFromList(
            parser,
            source,
            nested.listNode,
            diagnostics,
        );
        const attached = attachNestedAttributes(attrs, nested.parentName, children);
        if (!attached) {
            diagnostics.push({
                level: "warning",
                code: "DOC_ATTRIBUTE_NESTED_PARENT_NOT_FOUND",
                message: `Nested attribute block parent not found: ${nested.parentName}`,
                sourceRange: nested.listNode.sourceRange ?? undefined,
            });
        }
    }

    return toBlockView<AttributeList>(
        "AttributeList",
        {
            title: sectionInfo.title,
            description,
            attributes: attrs,
            sourceRange: getRangeFromNodes(sectionInfo.nodes),
        },
        sectionInfo.nodes,
    );
}

export function buildImport(
    parser: MarkdownParser,
    ast: MarkdownNode,
    diagnostics: BuildDiagnostic[],
): DocBlockView<Import> {
    const section = parser.getSection(ast, 2, "Import");
    if (!section) {
        return toBlockView<Import>(
            "Import",
            {
                hasImportBlock: false,
            },
            [],
        );
    }

    const codeBlock = section.find((n) => n.type === "code_block");
    const importIdPattern = extractImportIdPattern(codeBlock?.literal ?? "");
    if (!importIdPattern) {
        diagnostics.push({
            level: "warning",
            code: "DOC_IMPORT_PATTERN_NOT_FOUND",
            message: "Import section exists but import id pattern is not detected.",
            sourceRange: getRangeFromNodes(section),
        });
    }

    return toBlockView<Import>(
        "Import",
        {
            hasImportBlock: true,
            importIdPattern,
            sourceRange: getRangeFromNodes(section),
        },
        section,
    );
}

export function buildTimeOut(
    parser: MarkdownParser,
    ast: MarkdownNode,
    source: string,
    diagnostics: BuildDiagnostic[],
): DocBlockView<TimeOut> | null {
    const sectionInfo = getSectionByTitles(parser, ast, 2, [
        "Timeouts",
        "Timeout",
    ]);
    if (!sectionInfo) return null;

    const timeout: TimeOut = {
        sourceRange: getRangeFromNodes(sectionInfo.nodes),
    };

    for (const node of sectionInfo.nodes) {
        const text = parser.getTextContent(node).trim();
        parseTimeoutLine(text, timeout);

        const nodeText = parser.getNodeText(source, node);
        if (!nodeText) continue;
        for (const line of nodeText.lines) {
            parseTimeoutLine(line.trim(), timeout);
        }
    }

    if (!timeout.create && !timeout.update && !timeout.delete) {
        diagnostics.push({
            level: "warning",
            code: "DOC_TIMEOUT_VALUE_NOT_FOUND",
            message: "Timeouts section exists but no create/update/delete values are parsed.",
            sourceRange: timeout.sourceRange,
        });
    }

    return toBlockView<TimeOut>("TimeOut", timeout, sectionInfo.nodes);
}

function parseArgumentItemsFromList(
    parser: MarkdownParser,
    source: string,
    listNode: MarkdownNode,
    diagnostics: BuildDiagnostic[],
): Argument[] {
    const items = parser.getBulletItems([listNode]);
    const result: Argument[] = [];

    for (const item of items) {
        const bullet = parser.getItemBulletLine(source, item);
        if (!bullet) continue;

        const parsed = parseArgumentBullet(bullet.text);
        if (!parsed) {
            diagnostics.push({
                level: "warning",
                code: "DOC_ARGUMENT_BULLET_PARSE_FAIL",
                message: `Argument bullet parse failed: ${bullet.text}`,
                sourceRange: item.sourceRange ?? undefined,
            });
            continue;
        }

        const fullDescription = getLogicalLineDescription(
            parser,
            source,
            item,
            "argument",
            parsed.description,
        );

        result.push({
            name: parsed.name,
            tags: parsed.tags,
            description: fullDescription,
            details: buildItemDetailsTree(parser, source, item, fullDescription),
            arguments: [],
            sourceRange: item.sourceRange ?? undefined,
        });
    }

    return result;
}

function parseAttributeItemsFromList(
    parser: MarkdownParser,
    source: string,
    listNode: MarkdownNode,
    diagnostics: BuildDiagnostic[],
): Attribute[] {
    const items = parser.getBulletItems([listNode]);
    const result: Attribute[] = [];

    for (const item of items) {
        const bullet = parser.getItemBulletLine(source, item);
        if (!bullet) continue;

        const parsed = parseAttributeBullet(bullet.text);
        if (!parsed) {
            diagnostics.push({
                level: "warning",
                code: "DOC_ATTRIBUTE_BULLET_PARSE_FAIL",
                message: `Attribute bullet parse failed: ${bullet.text}`,
                sourceRange: item.sourceRange ?? undefined,
            });
            continue;
        }

        const fullDescription = getLogicalLineDescription(
            parser,
            source,
            item,
            "attribute",
            parsed.description,
        );

        result.push({
            name: parsed.name,
            description: fullDescription,
            details: buildItemDetailsTree(parser, source, item, fullDescription),
            attributes: [],
            sourceRange: item.sourceRange ?? undefined,
        });
    }

    return result;
}

function parseArgumentBullet(
    text: string,
): { name: string; tags: string[]; description: string } | null {
    const matched = ARG_BULLET_PATTERN.match(text);
    if (!matched.ok) return null;

    const captures = matched.value.captures;
    const name = stripBackticks(captures[1]);
    const parenContent = captures[5]
        .replace(/^\(/, "")
        .replace(/\)$/, "");
    const parts = parenContent.split(/,\s*/);

    return {
        name,
        tags: parts.slice(2).filter(Boolean),
        description: (captures[7] ?? "").trim(),
    };
}

function parseAttributeBullet(
    text: string,
): { name: string; description: string } | null {
    const matched = ATTR_BULLET_PATTERN.match(text);
    if (!matched.ok) return null;
    const captures = matched.value.captures;
    return {
        name: stripBackticks(captures[1]),
        description: (captures[5] ?? "").trim(),
    };
}

function stripBackticks(s: string): string {
    return s.replace(/`/g, "").trim();
}

function getLogicalLineDescription(
    parser: MarkdownParser,
    source: string,
    item: MarkdownNode,
    kind: "argument" | "attribute",
    fallback: string,
): string {
    const logical = parser.getLogicalLines(source, item);
    const firstLogicalLine = logical?.lines[0];
    if (!firstLogicalLine) return fallback;

    const normalizedLine = firstLogicalLine.trim();
    const bulletText = normalizedLine.startsWith("* ")
        ? normalizedLine
        : `* ${normalizedLine}`;

    if (kind === "argument") {
        return parseArgumentBullet(bulletText)?.description ?? fallback;
    }
    return parseAttributeBullet(bulletText)?.description ?? fallback;
}

function extractSectionDescription(
    parser: MarkdownParser,
    section: MarkdownNode[],
): string {
    const firstPara = section.find((n) => n.type === "paragraph");
    return firstPara ? normalizeInlineText(parser.getTextContent(firstPara)) : "";
}

function buildItemDetailsTree(
    parser: MarkdownParser,
    source: string,
    item: MarkdownNode,
    rootText: string,
): StringTree {
    const nodeText = parser.getNodeText(source, item);
    if (!nodeText) {
        return { text: rootText, children: [] };
    }

    const detailLines = nodeText.lines
        .slice(1)
        .map((line) => line.trim())
        .filter(Boolean);

    return {
        text: rootText,
        children: detailLines.map((line) => ({
            text: line,
            children: [],
        })),
        sourceRange: item.sourceRange ?? undefined,
    };
}

function hasComputedArgument(args: Argument[]): boolean {
    for (const arg of args) {
        if (arg.tags.some((t) => t.toLowerCase() === "computed")) {
            return true;
        }
        if (hasComputedArgument(arg.arguments)) {
            return true;
        }
    }
    return false;
}

function collectNestedSupportLists(
    parser: MarkdownParser,
    section: MarkdownNode[],
): Array<{ parentName: string; listNode: MarkdownNode }> {
    const collected: Array<{ parentName: string; listNode: MarkdownNode }> = [];

    for (let i = 0; i < section.length; i++) {
        const node = section[i];
        if (node.type !== "paragraph") continue;

        const text = parser.getTextContent(node).trim();
        const parentName = parseSupportBlockName(text);
        if (!parentName) continue;

        const listNode = findNextNodeByType(section, i + 1, "list");
        if (listNode) {
            collected.push({ parentName, listNode });
        }
    }

    return collected;
}

function parseSupportBlockName(text: string): string | null {
    const backtickMatch = text.match(/The\s+`([^`]+)`\s+block supports:/i);
    if (backtickMatch) return backtickMatch[1];

    const linkMatch = text.match(/The\s+\[([^\]]+)\]\(#[^)]+\)\s+structure is documented below\./i);
    if (linkMatch) return linkMatch[1];

    const plainMatch = text.match(/The\s+([a-zA-Z0-9_]+)\s+block supports:/i);
    if (plainMatch) return plainMatch[1];

    return null;
}

function attachNestedArguments(
    args: Argument[],
    parentName: string,
    nested: Argument[],
): boolean {
    for (const arg of args) {
        if (arg.name === parentName) {
            arg.arguments = nested;
            return true;
        }
        if (attachNestedArguments(arg.arguments, parentName, nested)) {
            return true;
        }
    }
    return false;
}

function attachNestedAttributes(
    attrs: Attribute[],
    parentName: string,
    nested: Attribute[],
): boolean {
    for (const attr of attrs) {
        if (attr.name === parentName) {
            attr.attributes = nested;
            return true;
        }
        if (attachNestedAttributes(attr.attributes, parentName, nested)) {
            return true;
        }
    }
    return false;
}

function extractImportIdPattern(code: string): string | undefined {
    if (!code.trim()) return undefined;
    for (const line of code.split(/\r?\n/)) {
        const normalized = line.replace(/^\$\s*/, "").trim();
        const matched = normalized.match(/terraform\s+import\s+\S+\s+(.+)/);
        if (matched) return matched[1].trim();
    }
    return undefined;
}

function parseTimeoutLine(line: string, timeout: TimeOut): void {
    const text = line.trim();
    if (!text) return;

    const withBackticks = text.match(/`(create|update|delete)`[^`]*`([^`]+)`/i);
    if (withBackticks) {
        setTimeoutValue(timeout, withBackticks[1].toLowerCase(), withBackticks[2].trim());
        return;
    }

    const plain = text.match(/(?:\*|-)?\s*`?(create|update|delete)`?\s*[-:]\s*(.+)$/i);
    if (plain) {
        setTimeoutValue(timeout, plain[1].toLowerCase(), plain[2].trim());
    }
}

function setTimeoutValue(timeout: TimeOut, key: string, value: string): void {
    if (!value) return;
    if (key === "create" && !timeout.create) timeout.create = value;
    if (key === "update" && !timeout.update) timeout.update = value;
    if (key === "delete" && !timeout.delete) timeout.delete = value;
}

function getSectionByTitles(
    parser: MarkdownParser,
    ast: MarkdownNode,
    level: number,
    titles: string[],
): { title: string; nodes: MarkdownNode[] } | null {
    for (const title of titles) {
        const section = parser.getSection(ast, level, title);
        if (section) {
            return { title, nodes: section };
        }
    }
    return null;
}

function findFirstNodeByType(
    nodes: MarkdownNode[],
    type: MarkdownNode["type"],
): MarkdownNode | null {
    for (const node of nodes) {
        if (node.type === type) return node;
    }
    return null;
}

function findNextNodeByType(
    nodes: MarkdownNode[],
    startIndex: number,
    type: MarkdownNode["type"],
): MarkdownNode | null {
    for (let i = startIndex; i < nodes.length; i++) {
        if (nodes[i].type === type) return nodes[i];
    }
    return null;
}

function toBlockView<TNode extends DocBlock>(
    kind: DocBlockType,
    node: TNode,
    astRef: MarkdownNode[],
): DocBlockView<TNode> {
    return {
        kind,
        astRef,
        node,
        sourceRange: node.sourceRange,
    };
}

function getRangeFromNodes(nodes: MarkdownNode[]): SourceRange | undefined {
    let range: SourceRange | undefined;
    for (const node of nodes) {
        range = mergeSourceRange(range, node.sourceRange ?? undefined);
    }
    return range;
}

function mergeSourceRange(
    current?: SourceRange,
    incoming?: SourceRange,
): SourceRange | undefined {
    if (!current) return incoming;
    if (!incoming) return current;

    return {
        start: isEarlier(current.start, incoming.start) ? current.start : incoming.start,
        end: isLater(current.end, incoming.end) ? current.end : incoming.end,
    };
}

function isEarlier(a: SourceRange["start"], b: SourceRange["start"]): boolean {
    if (a.line !== b.line) return a.line < b.line;
    return a.column <= b.column;
}

function isLater(a: SourceRange["end"], b: SourceRange["end"]): boolean {
    if (a.line !== b.line) return a.line > b.line;
    return a.column >= b.column;
}

function asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
}

function asString(value: unknown): string {
    if (typeof value === "string") return value.trim();
    if (value == null) return "";
    return String(value).trim();
}

function normalizeInlineText(value: unknown): string {
    return asString(value).replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
}
