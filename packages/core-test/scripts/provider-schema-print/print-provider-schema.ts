import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GoParser } from "../../../core/src/tools/ast-parser/go";
import { TerraformSchemaExtractor } from "../../../core/src/workflow/implement/resource-check/tools/terraform-schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultInputFile = resolve(__dirname, "sample-provider.go");

function getArgValue(flag: string): string | undefined {
    const index = process.argv.indexOf(flag);
    if (index === -1) return undefined;
    return process.argv[index + 1];
}

async function main(): Promise<void> {
    const inputArg = getArgValue("--input");
    const inputPath = inputArg ? resolve(process.cwd(), inputArg) : defaultInputFile;
    const goSource = readFileSync(inputPath, "utf8");

    const parser = await GoParser.create();
    try {
        const extractor = new TerraformSchemaExtractor(parser);
        const schemas = extractor.extract(goSource);
        console.log(JSON.stringify(schemas, null, 2));
    } finally {
        parser.dispose();
    }
}

main().catch((error) => {
    console.error("Provider schema print failed:", error);
    process.exitCode = 1;
});
