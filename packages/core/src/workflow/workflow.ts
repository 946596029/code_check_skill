import { Context } from "./context/context";
import { Rule, RuleCheckResult } from "./types/rule/rule";

export interface LifeCycle {
  run(code: string, onRuleComplete?: OnRuleComplete): Promise<RuleResult[]>;
}

export interface RuleResult {
  ruleName: string;
  ruleDescription: string;
  ruleType: string;
  results: RuleCheckResult[];
}

export type OnRuleComplete = (ruleResult: RuleResult) => void;

export type RuleExecutionStrategy = "isolated" | "shared";

export interface RunRulesOptions {
  rules?: ReadonlyArray<Rule>;
  baseContext?: Context;
  strategy?: RuleExecutionStrategy;
}

export interface WorkflowStageRuntime {
  readonly code: string;
  readonly context: Context;
  readonly onRuleComplete?: OnRuleComplete;
  updateCode(code: string): void;
  setArtifact<T>(key: string, value: T, targetCtx?: Context): void;
  getArtifact<T>(key: string, sourceCtx?: Context): T | undefined;
  createChildContext(parentCtx?: Context): Context;
  runRules(options?: RunRulesOptions): Promise<RuleResult[]>;
}

export interface WorkflowStage {
  id: string;
  description: string;
  execute(runtime: WorkflowStageRuntime): Promise<void>;
}

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

  protected abstract defineStages(): WorkflowStage[];

  public async run(
    code: string,
    onRuleComplete?: OnRuleComplete
  ): Promise<RuleResult[]> {
    this.setCode(code);
    const allRuleResults: RuleResult[] = [];
    const runtime = this.createStageRuntime(allRuleResults, onRuleComplete);

    for (const stage of this.defineStages()) {
      try {
        await stage.execute(runtime);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        allRuleResults.push({
          ruleName: `stage:${stage.id}`,
          ruleDescription: stage.description,
          ruleType: "stage",
          results: [
            new RuleCheckResult(
              false,
              `Stage execution error: ${message}`,
              "",
              ""
            ),
          ],
        });
      }
    }

    return allRuleResults;
  }

  protected createRuleExecutionStage(
    id: string = "run-rules",
    description: string = "Execute workflow rules",
    options: RunRulesOptions = {}
  ): WorkflowStage {
    return {
      id,
      description,
      execute: async (runtime) => {
        await runtime.runRules(options);
      },
    };
  }

  protected async runRules(
    options: RunRulesOptions = {},
    onRuleComplete?: OnRuleComplete
  ): Promise<RuleResult[]> {
    const {
      rules = this.rules,
      baseContext = this.context,
      strategy = "isolated",
    } = options;

    const allRuleResults: RuleResult[] = [];
    for (const rule of rules) {
      const ruleCtx =
        strategy === "shared" ? baseContext : baseContext.createChild();
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

  protected createStageRuntime(
    allRuleResults: RuleResult[],
    onRuleComplete?: OnRuleComplete
  ): WorkflowStageRuntime {
    const self = this;

    return {
      get code() {
        return self.code;
      },
      get context() {
        return self.context;
      },
      onRuleComplete,
      updateCode: (code: string) => {
        this.setCode(code);
      },
      setArtifact: <T>(key: string, value: T, targetCtx?: Context) => {
        (targetCtx ?? this.context).set(key, value);
      },
      getArtifact: <T>(key: string, sourceCtx?: Context) => {
        return (sourceCtx ?? this.context).get<T>(key);
      },
      createChildContext: (parentCtx?: Context) => {
        return (parentCtx ?? this.context).createChild();
      },
      runRules: async (options?: RunRulesOptions) => {
        const result = await this.runRules(options, onRuleComplete);
        allRuleResults.push(...result);
        return result;
      },
    };
  }

  protected async executeRule(
    rule: Rule,
    ctx?: Context
  ): Promise<RuleCheckResult[]> {
    return rule.test(this.code, undefined, ctx);
  }
}
