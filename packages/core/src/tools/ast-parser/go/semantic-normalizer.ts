import type {
    ForceNewSemantics,
    ImportIdSemantics,
    NonUpdatableSemantics,
    ResourceSchema,
    ResourceSemantics,
    ResourceTimeoutSemantics,
    ResourceTimeouts,
    TimeoutSemanticValue,
} from "./types";

const DURATION_MULTIPLIERS_MS: Record<string, number> = {
    Nanosecond: 1 / 1_000_000,
    Microsecond: 1 / 1_000,
    Millisecond: 1,
    Second: 1_000,
    Minute: 60_000,
    Hour: 3_600_000,
};

/**
 * Conservative semantic normalizer on top of raw extractor output.
 * It only derives values for whitelisted, high-confidence patterns.
 */
export class TerraformSchemaSemanticNormalizer {
    public normalizeSchemas(goSource: string, schemas: ResourceSchema[]): ResourceSchema[] {
        return schemas.map((schema) => this.normalizeSchema(goSource, schema));
    }

    public normalizeSchema(goSource: string, schema: ResourceSchema): ResourceSchema {
        const semantics: ResourceSemantics = {};
        const options = schema.resourceOptions;
        if (!options) {
            return schema;
        }

        semantics.importable = {
            value: options.hasImporter,
            confidence: "high",
        };

        if (options.timeouts) {
            semantics.timeouts = this.normalizeTimeouts(options.timeouts);
        }

        if (options.customizeDiff) {
            const forceNew = this.deriveForceNewFromCustomizeDiff(options.customizeDiff, goSource);
            if (forceNew) {
                semantics.forceNew = forceNew;
            }

            const nonUpdatable = this.deriveNonUpdatableFromCustomizeDiff(
                options.customizeDiff, goSource,
            );
            if (nonUpdatable) {
                semantics.nonUpdatable = nonUpdatable;
            }
        }

        if (options.hasImporter) {
            const importId = this.deriveImportIdParts(
                goSource, options.importerStateContext,
            );
            if (importId) {
                semantics.importIdParts = importId;
            }
        }

        return {
            ...schema,
            resourceSemantics: semantics,
        };
    }

    private normalizeTimeouts(timeouts: ResourceTimeouts): ResourceTimeoutSemantics {
        const normalized: ResourceTimeoutSemantics = {};
        const entries: Array<[keyof ResourceTimeouts, keyof ResourceTimeoutSemantics]> = [
            ["create", "create"],
            ["read", "read"],
            ["update", "update"],
            ["delete", "delete"],
            ["default", "default"],
        ];

        for (const [sourceKey, targetKey] of entries) {
            const raw = timeouts[sourceKey];
            if (!raw) continue;
            normalized[targetKey] = this.normalizeTimeoutValue(raw);
        }

        return normalized;
    }

    private normalizeTimeoutValue(raw: string): TimeoutSemanticValue {
        const inner = this.unwrapDefaultTimeout(raw.trim());
        const durationMs = this.parseDurationToMs(inner);
        if (durationMs === undefined) {
            return { raw, confidence: "none" };
        }

        return {
            raw,
            milliseconds: durationMs,
            confidence: "high",
        };
    }

    private unwrapDefaultTimeout(expr: string): string {
        const match = expr.match(/^schema\.DefaultTimeout\((.+)\)$/s);
        if (!match) return expr;
        return match[1].trim();
    }

    /**
     * Parse conservative duration expressions:
     * - `10 * time.Minute`
     * - `time.Minute * 10`
     */
    private parseDurationToMs(expr: string): number | undefined {
        const leftMatch = expr.match(/^(\d+)\s*\*\s*time\.(\w+)$/);
        if (leftMatch) {
            const amount = Number(leftMatch[1]);
            const unit = leftMatch[2];
            const multiplier = DURATION_MULTIPLIERS_MS[unit];
            if (multiplier === undefined) return undefined;
            return Math.round(amount * multiplier);
        }

        const rightMatch = expr.match(/^time\.(\w+)\s*\*\s*(\d+)$/);
        if (rightMatch) {
            const unit = rightMatch[1];
            const amount = Number(rightMatch[2]);
            const multiplier = DURATION_MULTIPLIERS_MS[unit];
            if (multiplier === undefined) return undefined;
            return Math.round(amount * multiplier);
        }

        return undefined;
    }

    private deriveForceNewFromCustomizeDiff(
        customizeDiff: string,
        goSource: string
    ): ForceNewSemantics | undefined {
        const fields = this.extractFieldsFromDiffCall(
            customizeDiff, goSource, "config.FlexibleForceNew",
        );
        if (!fields || fields.length === 0) return undefined;

        return {
            fields,
            confidence: "high",
            source: "customizeDiff",
        };
    }

    private deriveNonUpdatableFromCustomizeDiff(
        customizeDiff: string,
        goSource: string
    ): NonUpdatableSemantics | undefined {
        const fields = this.extractFieldsFromDiffCall(
            customizeDiff, goSource, "config.FlexibleNonUpdatable",
        );
        if (!fields || fields.length === 0) return undefined;

        return {
            fields,
            confidence: "high",
            source: "customizeDiff",
        };
    }

    /**
     * Extract field names from a `funcName(fields)` call that may appear
     * either as a standalone customizeDiff expression or inside a
     * `customdiff.Sequence(...)` wrapper.
     */
    private extractFieldsFromDiffCall(
        customizeDiff: string,
        goSource: string,
        funcName: string,
    ): string[] | undefined {
        const escaped = funcName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(`${escaped}\\(([\\s\\S]+?)\\)`, "m");
        const callMatch = customizeDiff.match(pattern);
        if (!callMatch) return undefined;

        const argExpr = callMatch[1].trim();
        let fields = this.parseStringSliceLiteral(argExpr);
        if (!fields && this.isIdentifier(argExpr)) {
            fields = this.findStringSliceByIdentifier(goSource, argExpr);
        }
        return fields;
    }

    /**
     * Derive the import ID parts from the importer state function.
     *
     * - `schema.ImportStatePassthroughContext` => bare resource ID
     * - Custom function => look up the function body and parse
     *   `strings.Split(d.Id(), "/")` style patterns to infer parts.
     */
    private deriveImportIdParts(
        goSource: string,
        stateContext?: string,
    ): ImportIdSemantics | undefined {
        if (!stateContext) return undefined;

        if (
            stateContext === "schema.ImportStatePassthroughContext" ||
            stateContext === "schema.ImportStatePassthrough"
        ) {
            return { parts: ["id"], separator: "/", confidence: "high" };
        }

        const funcBody = this.findFuncBody(goSource, stateContext);
        if (!funcBody) return undefined;

        return this.parseImportIdFromFuncBody(funcBody);
    }

    private findFuncBody(goSource: string, funcName: string): string | undefined {
        const escaped = funcName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const headerPattern = new RegExp(
            `func\\s+${escaped}\\s*\\([\\s\\S]*?\\)\\s*[^{]*\\{`,
            "m",
        );
        const headerMatch = goSource.match(headerPattern);
        if (!headerMatch) return undefined;

        const bodyStart = headerMatch.index! + headerMatch[0].length;
        const rest = goSource.slice(bodyStart);

        // Match the closing brace at column 0 (no leading whitespace on that line).
        const closingMatch = rest.match(/\n\}/);
        if (!closingMatch) return undefined;

        let depth = 1;
        for (let i = 0; i < rest.length; i++) {
            if (rest[i] === "{") depth++;
            if (rest[i] === "}") {
                depth--;
                if (depth === 0) {
                    return rest.slice(0, i);
                }
            }
        }

        return rest.slice(0, closingMatch.index!);
    }

    /**
     * Best-effort parsing of an import state function body.
     * Recognises two common patterns:
     *
     * 1. `parts := strings.Split(d.Id(), "/")`
     *    followed by length check and `d.Set("field", parts[i])` calls.
     *
     * 2. `parts := strings.SplitN(d.Id(), "/", N)`
     *    same downstream pattern.
     */
    private parseImportIdFromFuncBody(body: string): ImportIdSemantics | undefined {
        const splitMatch = body.match(
            /strings\.SplitN?\(\s*(?:d\.Id\(\)|[a-zA-Z_]\w*)\s*,\s*"([^"]+)"\s*(?:,\s*(\d+)\s*)?\)/,
        );
        if (!splitMatch) return undefined;

        const separator = splitMatch[1];
        const splitCount = splitMatch[2] ? Number(splitMatch[2]) : undefined;

        const setPattern = /d\.Set\(\s*"([^"]+)"\s*,\s*parts\[(\d+)\]/g;
        const partsMap = new Map<number, string>();
        let m: RegExpExecArray | null;
        while ((m = setPattern.exec(body)) !== null) {
            partsMap.set(Number(m[2]), m[1]);
        }

        const setIdPattern = /d\.SetId\(\s*parts\[(\d+)\]/g;
        while ((m = setIdPattern.exec(body)) !== null) {
            const idx = Number(m[1]);
            if (!partsMap.has(idx)) {
                partsMap.set(idx, "id");
            }
        }

        if (partsMap.size === 0) return undefined;

        const expectedCount = splitCount ?? (Math.max(...partsMap.keys()) + 1);
        const parts: string[] = [];
        for (let i = 0; i < expectedCount; i++) {
            parts.push(partsMap.get(i) ?? `_unknown_${i}`);
        }

        return { parts, separator, confidence: "high" };
    }

    private isIdentifier(expr: string): boolean {
        return /^[A-Za-z_]\w*$/.test(expr);
    }

    private findStringSliceByIdentifier(goSource: string, identifier: string): string[] | undefined {
        const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(
            `(?:var\\s+${escaped}\\s*=|${escaped}\\s*:=)\\s*\\[\\]string\\s*\\{([\\s\\S]*?)\\}`,
            "m"
        );
        const match = goSource.match(pattern);
        if (!match) return undefined;
        return this.extractStringLiterals(match[1]);
    }

    private parseStringSliceLiteral(expr: string): string[] | undefined {
        const match = expr.match(/^\[\]string\s*\{([\s\S]*?)\}$/);
        if (!match) return undefined;
        return this.extractStringLiterals(match[1]);
    }

    private extractStringLiterals(content: string): string[] {
        const values: string[] = [];
        const regex = /"((?:[^"\\]|\\.)*)"/g;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
            values.push(match[1]);
        }
        return values;
    }
}
