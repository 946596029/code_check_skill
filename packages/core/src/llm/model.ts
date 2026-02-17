import { ChatOpenAI } from "@langchain/openai";

/**
* Create a Qwen model instance via DashScope OpenAI-compatible API.
*/
export function createQwenModel(options?: { streaming?: boolean }): ChatOpenAI {
 return new ChatOpenAI({
    modelName: process.env.QWEN_MODEL || "qwen-plus",
    temperature: 0.7,
    streaming: options?.streaming ?? false,
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
    modelName: modelName,
    temperature: temperature,
    streaming: streaming,
    configuration: {  
      baseURL: baseURL,
      apiKey: apiKey,
    },
  });
}