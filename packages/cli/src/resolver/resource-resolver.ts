import fs from "fs/promises";
import path from "path";

export interface ResourceResolver {
  resolve(resourcePath: string): Promise<string>;
}

export class DefaultResourceResolver implements ResourceResolver {
  async resolve(resourcePath: string): Promise<string> {
    const resolved = path.resolve(resourcePath);
    try {
      return await fs.readFile(resolved, "utf-8");
    } catch (err: any) {
      if (err.code === "ENOENT") {
        throw new Error(`File not found: ${resolved}`);
      }
      throw new Error(`Failed to read file "${resolved}": ${err.message}`);
    }
  }
}
