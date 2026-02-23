import { Workflow } from "../workflow/workflow";
import {
  CodeCheckerConfig,
  CheckOptions,
  CheckReport,
  WorkflowInfo,
} from "./types";

export class CodeChecker {
  private workflows = new Map<string, Workflow>();
  private config: CodeCheckerConfig;
  private initialized = false;

  constructor(config: CodeCheckerConfig = {}) {
    this.config = config;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.config.llm) {
      if (this.config.llm.apiKey) {
        process.env.DASHSCOPE_API_KEY = this.config.llm.apiKey;
      }
      if (this.config.llm.baseUrl) {
        process.env.DASHSCOPE_BASE_URL = this.config.llm.baseUrl;
      }
      if (this.config.llm.model) {
        process.env.QWEN_MODEL = this.config.llm.model;
      }
    }

    this.initialized = true;
  }

  // ── Workflow management ──

  public registerWorkflow(workflow: Workflow): void {
    if (this.workflows.has(workflow.id)) {
      throw new Error(`Workflow "${workflow.id}" is already registered`);
    }
    this.workflows.set(workflow.id, workflow);
  }

  public listWorkflows(): WorkflowInfo[] {
    return Array.from(this.workflows.values()).map((wf) => ({
      id: wf.id,
      description: wf.description,
      ruleCount: wf.getRules().length,
      ruleNames: wf.getRules().map((r) => r.name),
    }));
  }

  // ── Check ──

  public async check(options: CheckOptions): Promise<CheckReport> {
    this.ensureInitialized();

    const { code, workflowId } = options;

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(
        `Workflow "${workflowId}" not found. ` +
        `Available: ${Array.from(this.workflows.keys()).join(", ")}`
      );
    }

    const results = await workflow.run(code);

    return { workflowId, results };
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        "CodeChecker is not initialized. Call initialize() first."
      );
    }
  }
}
