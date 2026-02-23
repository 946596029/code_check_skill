export class Context {

  private store = new Map<string, unknown>();
  private parent: Context | null;

  constructor(parent?: Context) {
    this.parent = parent ?? null;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, value);
  }

  /**
   * Looks up the key in this context first, then walks up the parent chain.
   */
  get<T>(key: string): T | undefined {
    if (this.store.has(key)) {
      return this.store.get(key) as T;
    }
    return this.parent?.get<T>(key);
  }

  has(key: string): boolean {
    return this.store.has(key) || (this.parent?.has(key) ?? false);
  }

  createChild(): Context {
    return new Context(this);
  }
}
