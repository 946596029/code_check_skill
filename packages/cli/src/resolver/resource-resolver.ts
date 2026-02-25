import fs from "fs/promises";
import path from "path";

export interface ResourceResolver {
  resolve(resourcePath: string): Promise<string>;
}

export async function resolveResourcePath(resourcePath: string): Promise<string> {
  if (path.isAbsolute(resourcePath)) {
    return resourcePath;
  }

  // Under pnpm filter scripts, cwd may be packages/cli.
  // Walk up ancestors and pick the first existing match.
  let cursor = process.cwd();
  while (true) {
    const candidate = path.resolve(cursor, resourcePath);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue walking up to parent directories.
    }

    const parent = path.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }

  return path.resolve(process.cwd(), resourcePath);
}

export class DefaultResourceResolver implements ResourceResolver {
  async resolve(resourcePath: string): Promise<string> {
    const resolved = await resolveResourcePath(resourcePath);
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
