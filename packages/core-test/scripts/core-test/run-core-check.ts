import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    CodeChecker,
} from "@greyworld/code-check-core";
import type { CheckReport } from "@greyworld/code-check-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXAMPLE_ROOT = path.resolve(
    __dirname,
    "../../terraform_provider_example"
);

type ResourceCheckInput = {
    providerRoot: string;
    serviceName: string;
    resourceName: string;
    resourceType: "resource" | "data-source";
};

const DEFAULT_INPUT: ResourceCheckInput = {
    providerRoot: EXAMPLE_ROOT,
    serviceName: "apig",
    resourceName: "apig_channel_member",
    resourceType: "resource",
};

function getArgValue(flag: string): string | undefined {
    const idx = process.argv.indexOf(flag);
    if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
    return process.argv[idx + 1];
}

function resolveInput(): ResourceCheckInput {
    const raw = getArgValue("--input");
    if (!raw) return DEFAULT_INPUT;

    try {
        const overrides = JSON.parse(raw) as Partial<ResourceCheckInput>;
        return { ...DEFAULT_INPUT, ...overrides };
    } catch {
        throw new Error(
            `Invalid --input JSON: ${raw}\n` +
            `Expected a JSON object with optional keys: providerRoot, serviceName, resourceName, resourceType`
        );
    }
}

function formatReport(report: CheckReport): string {
    const lines: string[] = [];
    lines.push(`Workflow: ${report.workflowId}`);
    lines.push(`Total rules: ${report.results.length}`);
    lines.push("");

    for (const rule of report.results) {
        const allPass = rule.results.every((r) => r.success);
        const status = allPass ? "PASS" : "FAIL";
        lines.push(`[${status}] ${rule.ruleName} (${rule.results.length} result(s))`);

        for (const r of rule.results) {
            if (!r.success) {
                const msg = r.message ?? "(no message)";
                lines.push(`       - ${msg}`);
            }
        }
    }

    return lines.join("\n");
}

async function main(): Promise<void> {
    const input = resolveInput();

    console.log("=== Input ===");
    console.log(JSON.stringify(input, null, 2));
    console.log();

    const checker = new CodeChecker();
    await checker.initialize();

    const code = JSON.stringify(input);
    const report = await checker.check({ code, workflowId: "resource-check" });

    console.log("=== Report (summary) ===");
    console.log(formatReport(report));
    console.log();

    console.log("=== Report (JSON) ===");
    console.log(JSON.stringify(report, null, 2));
}

main().catch((err: unknown) => {
    console.error("Core check failed:", err);
    process.exitCode = 1;
});
