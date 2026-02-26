import { ChatOpenAI } from "@langchain/openai";
import { loadEnvFile } from "../env";

loadEnvFile();

export function createModel(
    modelName: string = process.env.QWEN_MODEL || "qwen-plus",
    temperature: number = 0.7,
    streaming: boolean = false,
    baseURL: string = process.env.DASHSCOPE_BASE_URL || "",
    apiKey: string = process.env.DASHSCOPE_API_KEY || ""
): ChatOpenAI {
    return new ChatOpenAI({
        modelName,
        temperature,
        streaming,
        configuration: {
            baseURL,
            apiKey,
        },
    });
}
