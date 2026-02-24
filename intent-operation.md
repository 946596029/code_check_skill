# Intent Operation Flow

## Goal

Define a stable pipeline for validating argument descriptions with:

- LLM-based intent understanding
- Deterministic format/spec validation
- Clear fallback behavior for uncertain cases

## Scope

This flow targets argument description text extracted from resource docs.
It is adapter-friendly and can be reused by other text sources.

## End-to-End Pipeline

1. Extract text units from source content.
2. Normalize raw text for model input.
3. Detect semantic intents with LLM (`intents[]`).
4. Extract structured slots for each detected intent.
5. Validate each intent against deterministic format specs.
6. Aggregate findings and assign severity.
7. Return rule results with actionable messages.

## Phase 1: Source Adaptation

Input:

- Markdown AST section nodes
- Item metadata (`argName`, `startLine`, `descriptionLines`)

Output:

- `DescriptionUnit[]`
  - `argName: string`
  - `text: string`
  - `lines: string[]`
  - `startLine: number`

## Phase 2: Intent Detection (LLM)

Component:

- `DescriptionIntentDetector`

Input:

- `argName`
- joined description text

Output (`IntentDetectionResult`):

- `status`: `classified | none | uncertain | suspected-standard-intent`
- `intents[]`:
  - `name`
  - `confidence`
  - `evidenceSpan`
  - `slots` (filled after slot extraction)
- optional `reason`

Behavior:

- Multi-label detection is allowed.
- Empty intent list is valid when no intent exists.
- Suspicious keywords can trigger `suspected-standard-intent`.

## Phase 3: Slot Extraction

Component:

- `extractSlotsForIntent(intent, text)`

Goal:

- Convert free text fragments into structured values.

Examples:

- `value-range` -> `{ min, max }`
- `default-value` -> `{ defaultValue }`
- `enum-values` -> `{ valueSet: string[] }`

## Phase 4: Deterministic Validation

Component:

- `getFormatSpec(intent)?.validate(lines)`

Rules:

- Validation runs per detected intent.
- Any failed intent creates a rule failure.
- Unknown/unsupported intent specs are skipped safely.

## Phase 5: Severity and Messaging

Severity strategy:

- `error`: classified intent but format validation fails
- `warning`: `suspected-standard-intent`
- `info`: optional normalization suggestion

Message template:

- include `argName`
- include intent name
- include expected canonical format
- include validation detail if available

## Optional Phase: Normalization Suggestion

Component:

- `suggestNormalizedSentence(intent, slots)`

Purpose:

- Provide rewrite hints without mutating source text automatically.

## Decision Table

- `status = none` -> no finding
- `status = classified` + all pass -> no finding
- `status = classified` + any fail -> error
- `status = uncertain` -> warning (optional, configurable)
- `status = suspected-standard-intent` -> warning

## Stability Principles

- LLM provides understanding, not final pass/fail.
- Deterministic specs own final compliance decisions.
- Keep detector and validator decoupled.
- Keep adapters (Markdown/business) outside core LLM tools.

## Minimal Interfaces

```ts
type IntentDetectionResult = {
  status: "classified" | "none" | "uncertain" | "suspected-standard-intent";
  intents: {
    name: "value-range" | "enum-values" | "char-restriction" |
      "max-length" | "default-value";
    confidence: number;
    evidenceSpan: string;
    slots?: Record<string, string | number | boolean | string[]>;
  }[];
  reason?: string;
};
```

## Testing Strategy

- Unit tests for slot extraction by intent.
- Unit tests for each format spec.
- Integration tests for rule behavior by status path.
- Regression tests with real document samples.
