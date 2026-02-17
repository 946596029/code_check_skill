export interface RuleRecord {
  id: string;
  name: string;
  description: string;
  type: "code" | "prompt";
  prompt_template: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuleFormData {
  name: string;
  description: string;
  type: "code" | "prompt";
  prompt_template: string;
  enabled: boolean;
}

export interface CheckResult {
  rule_id: string;
  rule_name: string;
  success: boolean;
  message: string;
  original: string;
  suggested: string;
}
