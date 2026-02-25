import { ChatOpenAI } from "@langchain/openai";

/**
 * Create a Qwen model instance via DashScope OpenAI-compatible API.
 */
export function createQwenModel(options?: { streaming?: boolean }): ChatOpenAI {
    const modelName = process.env.QWEN_MODEL || "qwen-plus";
    const streaming = options?.streaming ?? false;

    return new ChatOpenAI({
        modelName,
        temperature: 0.7,
        streaming,
        configuration: {
            baseURL: process.env.DASHSCOPE_BASE_URL,
            apiKey: process.env.DASHSCOPE_API_KEY,
        },
    });
}

export function createModel(
    modelName: string,
    temperature: number = 0.7,
    streaming: boolean = false,
    baseURL: string,
    apiKey: string
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
