# Tool Composition Layer — SectionCheck Fluent API

## Problem Analysis

### Symptom: Rule code is bloated

The current rule implementations under `resource-doc/rules/` are verbose.
Each rule averages 40-100 lines, but only 2-5 lines express the actual check intent.
The rest is glue code: section extraction, context key passing, AST traversal,
text normalization, and failure collection.

For example, `ArgumentReferenceStructureRule` (84 lines) + 3 child rule classes
(~170 lines) = ~250 lines total, but the checking intent is just:

- Validate section AST structure
- First line must equal a fixed string
- Each bullet's first line must match a `LinePattern`
- Each bullet's description must pass LLM-based format classification

### Root Cause: Tools provide only atomic operations

The three existing tools — `MarkdownParser`, `NodePattern`, `LinePattern` — each
operate at the "parser utility" level. They are individually well-designed, but
there is **no composition layer** between them and the rules.

| Tool            | Granularity                        | Missing                              |
| --------------- | ---------------------------------- | ------------------------------------ |
| `MarkdownParser`| `getSection()`, `getSectionText()` | No unified "Section" object          |
| `NodePattern`   | `match()` → raw result object      | No integration with section queries  |
| `LinePattern`   | `test()` one line at a time        | No batch-test-and-collect-failures   |

Rules are forced to manually orchestrate these tools with imperative code:

```
getSection() → null check → match() → extract tagged → getSectionText() →
null check → create Context → set keys → executeChildren
```

This orchestration pattern is repeated almost identically in 3+ rules,
and the simpler checks (intro line, bullet format) become entire class files
for what should be one-line assertions.

### Secondary Cause: Context string-key data passing

Parent rules pass data to child rules via `Context` with string keys
(e.g., `CTX_ARG_REF_BULLET_LISTS`). This requires:

- Defining string constants in a shared `context-keys.ts` file
- `ctx.set(KEY, value)` in every parent rule
- `parentCtx?.get<T>(KEY)` with manual type assertion in every child rule

This mechanism exists only because tools don't provide a way to pass
structured data through the check pipeline.

---

## Proposed Solution: `sectionCheck()` Fluent Chain

A new tool module that composes `MarkdownParser` + `NodePattern` + `LinePattern`
into a declarative, chainable API. The chain encapsulates the entire
"extract section → validate structure → run sub-checks" pipeline.

### Target API

```typescript
// Argument Reference — replaces 4 classes (~250 lines) with ~20 lines
const ARG_SECTION = sectionCheck("Argument Reference", 2)
  .structure(SECTION_STRUCTURE)
  .introLine("The following arguments are supported:")
  .eachBulletItem(firstLine => firstLine.matches(ARG_BULLET_PATTERN))
  .eachBulletItemAsync(async (item) => {
    const intent = await classifier.classify(item.argName, item.descriptionText);
    if (intent === "none") return null;
    const spec = getFormatSpec(intent);
    if (!spec) return null;
    const validation = spec.validate(item.descriptionLines);
    if (validation.ok) return null;
    return {
      message: `Argument \`${item.argName}\` "${intent}" format error.`,
      line: item.startLine,
    };
  });

// Execute in a Rule's test() method:
const failures = await ARG_SECTION.run(doc, code);
```

```typescript
// Attributes Reference — replaces 3 classes (~160 lines) with ~5 lines
const ATTR_SECTION = sectionCheck("Attributes Reference", 2)
  .structure(SECTION_STRUCTURE)
  .introLine("In addition to all arguments above, the following attributes are exported:")
  .eachBulletItem(firstLine => firstLine.matches(ATTR_BULLET_PATTERN));
```

```typescript
// H1 Structure — replaces 4 classes (~210 lines) with ~10 lines
// Built per-invocation since resourceName/expectedDesc are runtime values
const failures = await bodyCheck()
  .structure(H1_SECTION_OPENING)
  .taggedTextEquals("h1", resourceName)
  .taggedTextEquals("desc", expectedDesc, {
    normalize: s => s.replace(/\s+/g, " ").trim(),
  })
  .validate(section => checkSpecialNotesFormat(section.lines))
  .run(doc, code);
```

```typescript
// Example Usage — uses .validate() escape hatch for complex conditional logic
const failures = await sectionCheck("Example Usage", 2)
  .validate(section => {
    const codeBlocks = section.nodes.filter(n => n.type === "code_block");
    if (codeBlocks.length === 0) return [];
    if (matchesFully(SINGLE_EXAMPLE, section.nodes) ||
        matchesFully(MULTI_EXAMPLE, section.nodes)) return [];
    // ... diagnostic logic
  })
  .run(doc, code);
```

---

## Complete API Design

### Factory Functions

```typescript
/** Target a named section (e.g., "## Argument Reference") */
function sectionCheck(title: string, level: number): SectionCheck;

/** Target the document body (H1 area, excluding frontmatter) */
function bodyCheck(): SectionCheck;
```

### SectionCheck Builder

```typescript
class SectionCheck {
  /** Validate AST node sequence against a NodePattern.
   *  Failure here causes early return — subsequent steps are skipped. */
  structure(pattern: NodePattern): this;

  /** Assert that the first non-empty line of the section equals `expected`. */
  introLine(expected: string): this;

  /** After .structure(), check that a tagged node's text content
   *  equals `expected`. Supports optional normalization. */
  taggedTextEquals(
    tag: string,
    expected: string,
    options?: { normalize?: (s: string) => string },
  ): this;

  /** For each bullet item in the section, run a synchronous check
   *  on its first line. When the callback returns false, the chain
   *  auto-generates an error message from the LinePattern used in matches(). */
  eachBulletItem(check: (firstLine: BulletLine) => boolean): this;

  /** For each bullet item, run an async check with full item data.
   *  Callback returns a CheckFailure on error, or null on success. */
  eachBulletItemAsync(
    check: (item: BulletItem) => Promise<CheckFailure | null>,
  ): this;

  /** General escape hatch: run a custom check with full section data.
   *  Returns an array of failures (empty = pass). */
  validate(
    check: (section: SectionData) => CheckFailure[] | Promise<CheckFailure[]>,
  ): this;

  /** Execute all registered steps and return failures. */
  run(doc: MarkdownNode, code: string): Promise<CheckFailure[]>;
}
```

### Supporting Types

```typescript
/** Returned by run() */
interface CheckFailure {
  message: string;
  line?: number;
}

/** Passed to eachBulletItem callback */
interface BulletLine {
  readonly text: string;        // normalized first line with "* " prefix
  readonly startLine: number;
  /** Test against a LinePattern.
   *  Internally records the pattern so that on failure,
   *  the chain can auto-generate "Expected: ..." messages. */
  matches(pattern: LinePattern): boolean;
}

/** Passed to eachBulletItemAsync callback */
interface BulletItem {
  readonly firstLine: BulletLine;
  readonly argName: string;           // extracted from backticks
  readonly descriptionLines: string[];
  readonly descriptionText: string;
  readonly node: MarkdownNode;
  readonly startLine: number;
}

/** Passed to validate callback */
interface SectionData {
  readonly nodes: MarkdownNode[];     // AST children of the section
  readonly lines: string[];           // source text lines
  readonly startLine: number;         // 1-based line offset
}
```

---

## Execution Flow

```
run(doc, code)
  │
  ├─ Extract section
  │    sectionCheck: parser.getSection(doc, level, title) + parser.getSectionText(...)
  │    bodyCheck:     parser.getBodyChildren(doc)
  │
  ├─ For each registered step (in order):
  │
  │    [structure]
  │    │  pattern.match(section.nodes)
  │    │  → fail: push CheckFailure, BAIL OUT (return immediately)
  │    │  → pass: store tagged nodes for subsequent steps
  │    │
  │    [introLine]
  │    │  find first non-empty line in section.lines
  │    │  → if !== expected: push CheckFailure
  │    │
  │    [taggedTextEquals]
  │    │  get text content of tagged node from structure match
  │    │  → apply normalize if provided
  │    │  → if !== expected: push CheckFailure
  │    │
  │    [eachBulletItem]
  │    │  resolve bullet list nodes (from tagged["bullets"] or all list nodes)
  │    │  for each item:
  │    │    extract first line → wrap as BulletLine
  │    │    call check(bulletLine)
  │    │    → if false: read pattern from BulletLine, auto-generate message
  │    │
  │    [eachBulletItemAsync]
  │    │  same iteration as eachBulletItem
  │    │  for each item:
  │    │    build full BulletItem (argName, descriptionLines, etc.)
  │    │    await check(item)
  │    │    → if returns CheckFailure: push it
  │    │
  │    [validate]
  │       call check({ nodes, lines, startLine })
  │       → push any returned CheckFailure items
  │
  └─ Return all collected CheckFailure[]
```

Key behaviors:

- `.structure()` failure causes **early return** (structure mismatch makes
  subsequent checks meaningless).
- Bullet list source: if `.structure()` produced `tagged["bullets"]`, use that;
  otherwise, fall back to all `type === "list"` nodes in the section.
- `BulletLine.matches()` silently records the last `LinePattern` used, so the
  chain can auto-generate "Expected: `* \`arg_name\` - (Modifier, Type) Specifies desc`"
  messages without the caller needing to specify error templates.

---

## Rule Coverage

| Rule                                | Chain Style                           | Steps Used                                     |
| ----------------------------------- | ------------------------------------- | ---------------------------------------------- |
| `FrontmatterExistsRule`             | Stays as class (document-level check) | N/A                                            |
| `H1StructureRule` + 3 children      | `bodyCheck()`                         | structure, taggedTextEquals x2, validate        |
| `ExampleUsageStructureRule`         | `sectionCheck()`                      | validate (complex conditional logic)           |
| `ArgumentReferenceStructureRule`    | `sectionCheck()`                      | structure, introLine, eachBulletItem, eachBulletItemAsync |
| + `ArgumentIntroMatchesRule`        | Eliminated (absorbed by `.introLine()`)          |                               |
| + `ArgumentBulletFormatRule`        | Eliminated (absorbed by `.eachBulletItem()`)     |                               |
| + `ArgumentDescriptionFormatRule`   | Eliminated (absorbed by `.eachBulletItemAsync()`) |                              |
| `AttributesReferenceStructureRule`  | `sectionCheck()`                      | structure, introLine, eachBulletItem           |
| + `AttributeIntroMatchesRule`       | Eliminated (absorbed by `.introLine()`)          |                               |
| + `AttributeBulletFormatRule`       | Eliminated (absorbed by `.eachBulletItem()`)     |                               |

Result: **4 of 5** top-level rules use the chain. **5 child rule classes** are eliminated entirely.
`FrontmatterExistsRule` stays as a class because it is a document-level prerequisite
that writes data into the shared Context for downstream rules.

---

## File Changes

**New files:**

- `packages/core/src/tools/section-check/section-check.ts` — SectionCheck class
- `packages/core/src/tools/section-check/types.ts` — CheckFailure, BulletLine, BulletItem, SectionData
- `packages/core/src/tools/section-check/index.ts` — module exports

**Modified files:**

- `packages/core/src/tools/ast-parser/markdown/parser.ts`
  — add `getBulletItems(listNodes)` and `getItemBulletLine(source, item)` helper methods
- `packages/core/src/tools/ast-parser/markdown/index.ts` — export new methods
- `packages/core/src/index.ts` — export section-check module

**Simplified files (after adopting the chain):**

- `argument-reference-structure-rule.ts` — rewrite test() with chain (~50 lines → ~20 lines)
- `attributes-reference-structure-rule.ts` — rewrite test() with chain (~83 lines → ~15 lines)
- `h1-structure-rule.ts` — rewrite test() with chain (~122 lines → ~20 lines)
- `example-usage-structure-rule.ts` — rewrite test() with chain (~121 lines → ~40 lines)

**Deleted files:**

- `argument-intro-matches-rule.ts`
- `argument-item/argument-bullet-format-rule.ts`
- `argument-item/description/argument-description-format-rule.ts`
- `attribute-intro-matches-rule.ts`
- `attribute-bullet-format-rule.ts`
- 8 of 14 context keys in `context-keys.ts`

**Estimated impact:** ~120 lines added (new tool module), ~500 lines removed (rule files + glue code).

---

## Tradeoffs

### Benefits

- **Declarative**: the chain reads as a specification of *what* to check,
  not *how* to orchestrate tools.
- **Eliminates duplication**: Argument and Attributes rules share nearly identical
  structure — the chain makes their differences visible (section name, intro text,
  bullet pattern) and hides their shared orchestration.
- **Kills the Context string-key mechanism** for section data: data flows inside
  the chain, type-safe, no possibility of wrong key lookup.
- **Low cost for new rules**: adding a check for a new section (e.g., `## Import`,
  `## Timeouts`) is a one-liner chain, not a new class hierarchy.
- **Auto-generated error messages**: `BulletLine.matches()` captures the pattern,
  so callers don't write message templates for the common case.

### Costs

- **Loss of individual rule identity**: child rules like `argument-intro-matches`
  had their own name and appeared independently in results. After the chain,
  these become anonymous steps in a flat `CheckFailure[]` list.
- **BulletLine.matches() has implicit side effects**: it silently records the last
  pattern used. This is pragmatic but non-obvious — developers unaware of the
  implementation might not expect a `matches()` call to mutate state.
- **Debugging is harder**: individual Rule classes allow per-class breakpoints.
  The chain funnels all logic through `SectionCheck.run()`, requiring developers
  to step into its internals.
- **Fixed pipeline shape**: the chain assumes structure → intro → bullets ordering.
  Rules that need a different flow (e.g., conditional structure matching in
  ExampleUsageStructureRule) must use the `.validate()` escape hatch,
  which is less declarative.
- **Two paradigms coexist**: `FrontmatterExistsRule` remains a class.
  The codebase has both chain-based and class-based rules. This is acceptable
  since only one rule falls outside the chain pattern.
