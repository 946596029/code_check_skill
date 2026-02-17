import { Rule } from "../types/rule/rule";

export interface CheckContext {
  code: string;
  language: string;
  rules: Rule[];
}

export class GlobalContext {
  private static instance: GlobalContext;
  private currentContext: CheckContext | null = null;

  private constructor() {}

  public static getInstance(): GlobalContext {
    if (!GlobalContext.instance) {
      GlobalContext.instance = new GlobalContext();
    }
    return GlobalContext.instance;
  }

  public setContext(context: CheckContext): void {
    this.currentContext = context;
  }

  public getContext(): CheckContext | null {
    return this.currentContext;
  }

  public clear(): void {
    this.currentContext = null;
  }
}
