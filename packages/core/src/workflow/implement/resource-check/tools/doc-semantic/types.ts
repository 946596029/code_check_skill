import type {
    MarkdownNode,
    SourceRange,
} from "../../../../../tools/ast-parser/markdown";

export interface StringTree {
    text: string;
    children: StringTree[];
    sourceRange?: SourceRange;
}

export type DocBlockType =
    | "FrontMatter"
    | "Title"
    | "ExampleList"
    | "ArgumentList"
    | "AttributeList"
    | "Import"
    | "TimeOut";

export interface FrontMatter {
    subcategory: string;
    pageTitle: string;
    description: string;
    raw: Record<string, unknown>;
    sourceRange?: SourceRange;
}

export interface Title {
    title: string;
    description: string;
    sourceRange?: SourceRange;
}

export interface Example {
    title: string;
    code: string;
    sourceRange?: SourceRange;
}

export interface ExampleList {
    title: string;
    examples: Example[];
    sourceRange?: SourceRange;
}

export interface Argument {
    name: string;
    tags: string[];
    description: string;
    details: StringTree;
    arguments: Argument[];
    sourceRange?: SourceRange;
}

export interface ArgumentList {
    title: string;
    description: string;
    isComputed: () => boolean;
    arguments: Argument[];
    sourceRange?: SourceRange;
}

export interface Attribute {
    name: string;
    description: string;
    details: StringTree;
    attributes: Attribute[];
    sourceRange?: SourceRange;
}

export interface AttributeList {
    title: string;
    description: string;
    attributes: Attribute[];
    sourceRange?: SourceRange;
}

export interface Import {
    hasImportBlock: boolean;
    importIdPattern?: string;
    sourceRange?: SourceRange;
}

export interface TimeOut {
    create?: string;
    update?: string;
    delete?: string;
    sourceRange?: SourceRange;
}

export type DocBlock =
    | FrontMatter
    | Title
    | ExampleList
    | ArgumentList
    | AttributeList
    | Import
    | TimeOut;

export interface BuildDiagnostic {
    level: "warning" | "error";
    message: string;
    code?: string;
    sourceRange?: SourceRange;
}

export interface DocBlockView<TNode extends DocBlock = DocBlock> {
    kind: DocBlockType;
    astRef: MarkdownNode[];
    node: TNode;
    sourceRange?: SourceRange;
}

export class DocSemanticView {
    public readonly blocks: DocBlockView[];
    public readonly diagnostics: BuildDiagnostic[];

    public constructor(
        blocks: DocBlockView[] = [],
        diagnostics: BuildDiagnostic[] = [],
    ) {
        this.blocks = blocks;
        this.diagnostics = diagnostics;
    }

    public get frontMatter(): FrontMatter | undefined {
        const block = this.blocks.find((b) => b.kind === "FrontMatter");
        return block?.node as FrontMatter | undefined;
    }

    public get title(): Title | undefined {
        const block = this.blocks.find((b) => b.kind === "Title");
        return block?.node as Title | undefined;
    }

    public get argumentLists(): ArgumentList[] {
        return this.blocks
            .filter((b) => b.kind === "ArgumentList")
            .map((b) => b.node as ArgumentList);
    }

    public get exampleLists(): ExampleList[] {
        return this.blocks
            .filter((b) => b.kind === "ExampleList")
            .map((b) => b.node as ExampleList);
    }

    public get attributeLists(): AttributeList[] {
        return this.blocks
            .filter((b) => b.kind === "AttributeList")
            .map((b) => b.node as AttributeList);
    }

    public get importBlock(): Import | undefined {
        const block = this.blocks.find((b) => b.kind === "Import");
        return block?.node as Import | undefined;
    }

    public get timeOut(): TimeOut | undefined {
        const block = this.blocks.find((b) => b.kind === "TimeOut");
        return block?.node as TimeOut | undefined;
    }
}
