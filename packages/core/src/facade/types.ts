import type { RuleResult } from "../workflow/workflow";

export interface LlmConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export interface CodeCheckerConfig {
  llm?: LlmConfig;
}

export interface CheckOptions {
  code: string;
  workflowId: string;
}

export interface CheckReport {
  workflowId: string;
  results: RuleResult[];
}

export interface WorkflowInfo {
  id: string;
  description: string;
  ruleCount: number;
  ruleNames: string[];
}
