import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MarkdownParser } from "../../../core/src/tools/ast-parser/markdown";
import { buildDocSemanticView } from "../../../core/src/workflow/implement/resource-check/tools/doc-semantic";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultInputFile = resolve(__dirname, "sample-doc.md");

function getArgValue(flag: string): string | undefined {
    const index = process.argv.indexOf(flag);
    if (index === -1) return undefined;
    return process.argv[index + 1];
}

function serialize(view: ReturnType<typeof buildDocSemanticView>): unknown {
    function cleanNode(obj: unknown): unknown {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") return obj;
        if (Array.isArray(obj)) return obj.map(cleanNode);
        if (typeof obj === "function") return undefined;
        if (typeof obj === "object") {
            const result: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
                if (key === "sourceRange" || key === "astRef") continue;
                const cleaned = cleanNode(value);
                if (cleaned !== undefined) result[key] = cleaned;
            }
            return result;
        }
        return obj;
    }

    return {
        blocks: view.blocks.map((b) => ({
            kind: b.kind,
            node: cleanNode(b.node),
        })),
        diagnostics: view.diagnostics.map((d) => ({
            level: d.level,
            code: d.code,
            message: d.message,
        })),
    };
}

function main(): void {
    const inputArg = getArgValue("--input");
    const inputPath = inputArg ? resolve(process.cwd(), inputArg) : defaultInputFile;
    const markdown = readFileSync(inputPath, "utf-8");

    const parser = new MarkdownParser();
    const ast = parser.parse(markdown);
    const view = buildDocSemanticView(ast, markdown, parser);

    console.log(JSON.stringify(serialize(view), null, 2));
}

main();
