import { Rule, RuleCheckResult } from "./types/rule/rule";

export interface LifeCycle {
  preprocess(): void;
  process(): Promise<RuleCheckResult[]>;
  postprocess(): void;
}

export abstract class Workflow implements LifeCycle {
  protected rules: Rule[] = [];
  protected code: string = "";

  public setCode(code: string): void {
    this.code = code;
  }

  public setRules(rules: Rule[]): void {
    this.rules = rules;
  }

  public abstract preprocess(): void;

  public abstract process(): Promise<RuleCheckResult[]>;

  public abstract postprocess(): void;
}
