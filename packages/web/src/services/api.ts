import axios from "axios";
import type { RuleRecord, RuleFormData, CheckResult } from "../types";

const client = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// ---- Rules ----

export async function fetchRules(): Promise<RuleRecord[]> {
  const { data } = await client.get<RuleRecord[]>("/rules");
  return data;
}

export async function fetchRule(id: string): Promise<RuleRecord> {
  const { data } = await client.get<RuleRecord>(`/rules/${id}`);
  return data;
}

export async function createRule(rule: RuleFormData): Promise<RuleRecord> {
  const { data } = await client.post<RuleRecord>("/rules", rule);
  return data;
}

export async function updateRule(
  id: string,
  rule: Partial<RuleFormData>
): Promise<RuleRecord> {
  const { data } = await client.put<RuleRecord>(`/rules/${id}`, rule);
  return data;
}

export async function deleteRule(id: string): Promise<void> {
  await client.delete(`/rules/${id}`);
}

// ---- Check (SSE) ----

export function runCheck(
  code: string,
  ruleIds: string[],
  language: string,
  callbacks: {
    onStatus?: (data: { status: string; total: number }) => void;
    onResult?: (result: CheckResult) => void;
    onDone?: (data: { status: string; results: CheckResult[] }) => void;
    onError?: (error: string) => void;
  }
): AbortController {
  const controller = new AbortController();

  fetch("/api/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, rule_ids: ruleIds, language }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const err = await response.json();
        callbacks.onError?.(err.error || "Request failed");
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        callbacks.onError?.("No response stream");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6);
            try {
              const parsed = JSON.parse(jsonStr);
              switch (currentEvent) {
                case "status":
                  callbacks.onStatus?.(parsed);
                  break;
                case "result":
                  callbacks.onResult?.(parsed);
                  break;
                case "done":
                  callbacks.onDone?.(parsed);
                  break;
                case "error":
                  callbacks.onError?.(parsed.message || "Unknown error");
                  break;
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        callbacks.onError?.(err.message || "Network error");
      }
    });

  return controller;
}
