import { createModel } from "../../../core/src/tools/llm/model";
import { DescriptionIntentDetector } from "../../../core/src/tools/llm/description-intent/intent-detector";
import fs from "node:fs";
import path from "node:path";

// Use case
// pnpm run test:intent:prompt -- --arg "channel_name" --text "Maximum 64 characters. Default is general."

function getArgValue(flag: string): string | undefined {
    const index = process.argv.indexOf(flag);
    if (index === -1) return undefined;
    return process.argv[index + 1];
}

function loadDotEnv(): void {
    const envPath = path.resolve(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) return;

    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const eqIndex = trimmed.indexOf("=");
        if (eqIndex <= 0) continue;

        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

async function main(): Promise<void> {
    loadDotEnv();

    const argName = getArgValue("--arg") ?? "example_argument";
    const description = getArgValue("--text")
        ?? "Valid values are 1-10. Default is 5.";

    const modelName = process.env.QWEN_MODEL ?? "qwen-plus";
    const baseURL = process.env.DASHSCOPE_BASE_URL;
    const apiKey = process.env.DASHSCOPE_API_KEY;

    if (!baseURL || !apiKey) {
        throw new Error(
            "Missing DASHSCOPE_BASE_URL or DASHSCOPE_API_KEY. " +
            "Please set them in environment variables before running."
        );
    }

    const model = createModel(modelName, 0, false, baseURL, apiKey);
    const detector = new DescriptionIntentDetector(model);
    const result = await detector.detect(argName, description);

    console.log("Input:");
    console.log(JSON.stringify({ argName, description }, null, 2));
    console.log("\nDetect result:");
    console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
    console.error("Prompt test failed:", error);
    process.exitCode = 1;
});
