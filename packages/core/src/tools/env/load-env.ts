import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

let loaded = false;

/**
 * Load key-value pairs from workspace `.env` into `process.env`.
 *
 * - Reads `<cwd>/.env`
 * - Skips blank lines and `#` comments
 * - Does not overwrite pre-existing environment variables
 */
export function loadEnvFile(): void {
    if (loaded) return;

    const envPath = resolve(process.cwd(), ".env");
    if (!existsSync(envPath)) {
        loaded = true;
        return;
    }

    const content = readFileSync(envPath, "utf8");
    const lines = content.split(/\r?\n/);

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;

        const separatorIndex = line.indexOf("=");
        if (separatorIndex <= 0) continue;

        const key = line.slice(0, separatorIndex).trim();
        if (!key || process.env[key] !== undefined) continue;

        const value = line.slice(separatorIndex + 1).trim();
        process.env[key] = value;
    }

    loaded = true;
}
