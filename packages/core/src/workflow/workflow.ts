import { Context } from "./context/context";
import { Rule, RuleCheckResult } from "./types/rule/rule";

export interface LifeCycle {
  preprocess(): void;
  process(onRuleComplete?: OnRuleComplete): Promise<RuleResult[]>;
  postprocess(): void;
}

export interface RuleResult {
  ruleName: string;
  ruleDescription: string;
  ruleType: string;
  results: RuleCheckResult[];
}

export type OnRuleComplete = (ruleResult: RuleResult) => void;

export abstract class Workflow implements LifeCycle {
  protected context: Context = new Context();
  protected rules: Rule[] = [];
  protected code: string = "";

  public abstract readonly id: string;
  public abstract readonly description: string;

  public setContext(context: Context): void {
    if (!this.context) {
      this.context = new Context();
    }
    this.context = context;
  }

  public getContext(): Context {
    return this.context;
  }

  public setCode(code: string): void {
    this.code = code;
  }

  public setRules(rules: Rule[]): void {
    this.rules = rules;
  }

  public getRules(): ReadonlyArray<Rule> {
    return this.rules;
  }

  /**
   * Executes the full lifecycle: preprocess -> process -> postprocess.
   */
  public async run(
    code: string,
    onRuleComplete?: OnRuleComplete
  ): Promise<RuleResult[]> {
    this.setCode(code);
    this.preprocess();
    const results = await this.process(onRuleComplete);
    this.postprocess();
    return results;
  }

  /**
   * Core rule-execution loop. Each rule gets its own child Context.
   * Override in subclass to change context strategy (e.g. shared context).
   */
  public async process(
    onRuleComplete?: OnRuleComplete
  ): Promise<RuleResult[]> {
    const allRuleResults: RuleResult[] = [];
    for (const rule of this.rules) {
      const ruleCtx = this.context.createChild();
      let results: RuleCheckResult[];
      try {
        results = await this.executeRule(rule, ruleCtx);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        results = [
          new RuleCheckResult(false, `Rule execution error: ${message}`, "", ""),
        ];
      }

      const ruleResult: RuleResult = {
        ruleName: rule.name,
        ruleDescription: rule.description,
        ruleType: rule.type,
        results,
      };
      allRuleResults.push(ruleResult);
      onRuleComplete?.(ruleResult);
    }
    return allRuleResults;
  }

  /**
   * Override in subclass if rules need extra context (e.g. AST).
   * Default implementation calls rule.test(code, undefined, ctx).
   */
  protected async executeRule(
    rule: Rule,
    ctx?: Context
  ): Promise<RuleCheckResult[]> {
    return rule.test(this.code, undefined, ctx);
  }

  public abstract preprocess(): void;

  public abstract postprocess(): void;
}
