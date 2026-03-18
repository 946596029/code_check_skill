import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { MarkdownParser } from "../../../core/src/tools/ast-parser/markdown";

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputFile = resolve(__dirname, "apig_channel_member.md");
const outputFile = resolve(__dirname, "apig_channel_member.ast.json");

const markdown = readFileSync(inputFile, "utf-8");

const parser = new MarkdownParser();
const ast = parser.parse(markdown);

const frontmatter = parser.getFrontmatter(ast);
console.log("=== Frontmatter ===");
console.log(JSON.stringify(frontmatter, null, 2));
console.log();

const headings = parser.getHeadings(ast);
console.log("=== Headings ===");
for (const h of headings) {
  console.log(`${"#".repeat(h.level)} ${h.text}`);
}
console.log();

const codeBlocks = parser.getCodeBlocks(ast);
console.log(`=== Code Blocks (${codeBlocks.length}) ===`);
for (const cb of codeBlocks) {
  console.log(`[${cb.language ?? "plain"}] ${cb.code.slice(0, 60).trimEnd()}...`);
}
console.log();

writeFileSync(outputFile, JSON.stringify(ast, null, 2), "utf-8");
console.log(`Full AST written to: ${outputFile}`);
