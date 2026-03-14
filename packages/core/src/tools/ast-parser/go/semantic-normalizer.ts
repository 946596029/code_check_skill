import type {
    ForceNewSemantics,
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
        const callMatch = customizeDiff.match(/^config\.FlexibleForceNew\((.+)\)$/s);
        if (!callMatch) return undefined;

        const argExpr = callMatch[1].trim();
        let fields = this.parseStringSliceLiteral(argExpr);
        if (!fields && this.isIdentifier(argExpr)) {
            fields = this.findStringSliceByIdentifier(goSource, argExpr);
        }
        if (!fields || fields.length === 0) return undefined;

        return {
            fields,
            confidence: "high",
            source: "customizeDiff",
        };
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
