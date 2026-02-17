# Code Check Skill

AI-powered code review tool with modular architecture. Built as a monorepo with a core library,
REST API server, and React web frontend.

## Features

- **Rule-based code checking** - Two rule types: pattern-based (`CodeRule`) and
  AI-powered (`PromptRule`)
- **Workflow system** - Extensible lifecycle: `preprocess` -> `process` -> `postprocess`
- **Web UI** - React frontend with Monaco Editor for code editing and diff viewing
- **REST API** - Express.js backend with SSE for real-time streaming results
- **Database** - SQLite (sql.js) for persistent rule storage
- **LLM integration** - Qwen models via DashScope (Alibaba Cloud) OpenAI-compatible API

## Project Structure

```
code-check-skill/
├── packages/
│   ├── core/            # @code-check/core  - Rules, workflow, database, LLM
│   ├── api/             # @code-check/api   - Express.js REST API server
│   └── web/             # @code-check/web   - React frontend application
├── package.json         # Root workspace configuration
├── pnpm-workspace.yaml  # pnpm workspace definition
├── tsconfig.base.json   # Shared TypeScript configuration
└── .env.example         # Environment variables template
```

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 8

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

| Variable             | Required | Default                                                       | Description                      |
| -------------------- | -------- | ------------------------------------------------------------- | -------------------------------- |
| `DASHSCOPE_API_KEY`  | Yes      | -                                                             | Alibaba Cloud DashScope API key  |
| `QWEN_MODEL`         | No       | `qwen-plus`                                                   | Model name (qwen-turbo/plus/max) |
| `DASHSCOPE_BASE_URL` | No       | `https://dashscope.aliyuncs.com/compatible-mode/v1`           | Custom DashScope endpoint        |
| `PORT`               | No       | `3000`                                                        | API server port                  |

### 3. Start the development servers

```bash
# Start API server (http://localhost:3000)
pnpm dev

# In another terminal, start the web frontend (http://localhost:5173)
pnpm dev:web
```

Open `http://localhost:5173` in your browser to access the web UI.

## Available Scripts

| Command               | Description                          |
| --------------------- | ------------------------------------ |
| `pnpm dev`            | Start API server in development mode |
| `pnpm dev:web`        | Start web frontend in development    |
| `pnpm build`          | Build all packages                   |
| `pnpm build:core`     | Build core package only              |
| `pnpm build:api`      | Build API package only               |
| `pnpm build:web`      | Build web package only               |
| `pnpm start`          | Start production API server          |
| `pnpm test:core`      | Run core package tests               |
| `pnpm test:core:watch`| Run core tests in watch mode         |

## Architecture

### Core Package (`@code-check/core`)

The core library provides the foundational building blocks:

#### Rule System

Two types of rules can be defined:

- **`CodeRule`** - Pattern-based checks using regular expressions for fast, local validation.
- **`PromptRule`** - AI-powered checks that send code to a Qwen LLM for intelligent review.
  Uses a two-round prompting strategy: analysis first, then structured JSON response.

Both rule types extend the abstract `Rule` class and implement the `test(code)` method,
returning a `RuleCheckResult` with `success`, `message`, `original`, and `suggested` fields.

#### Workflow System

Workflows follow a lifecycle pattern:

```
preprocess() -> process() -> postprocess()
```

- `Workflow` - Abstract base class defining the lifecycle interface
- `MarkdownWorkflow` - Concrete implementation that trims code and runs rules sequentially

#### Database

Uses SQLite via `sql.js` (pure JavaScript, no native bindings required). The database file is
stored at `data/code_check.db` by default. Key functions:

- `getDatabase()` - Get or initialize the database instance
- `persistDatabase()` - Save the in-memory database to disk
- `setDatabasePath(path)` - Configure a custom database file path

#### LLM

`createQwenModel()` creates a LangChain `ChatOpenAI` instance configured for the DashScope
OpenAI-compatible API. Configuration is driven by environment variables.

#### Exports

```typescript
// Rules
import {
  Rule, RuleCheckResult, RuleType,
  PromptRule, DynamicPromptRule,
  CodeRule
} from "@code-check/core";

// Workflow
import { Workflow, LifeCycle, MarkdownWorkflow } from "@code-check/core";

// Database
import { getDatabase, persistDatabase, setDatabasePath } from "@code-check/core";

// LLM
import { createQwenModel } from "@code-check/core";

// Context
import { GlobalContext, CheckContext } from "@code-check/core";
```

### API Package (`@code-check/api`)

Express.js REST API with the following endpoints:

#### Rules CRUD

| Method   | Endpoint         | Description       |
| -------- | ---------------- | ----------------- |
| `GET`    | `/api/rules`     | List all rules    |
| `GET`    | `/api/rules/:id` | Get rule by ID    |
| `POST`   | `/api/rules`     | Create a new rule |
| `PUT`    | `/api/rules/:id` | Update a rule     |
| `DELETE` | `/api/rules/:id` | Delete a rule     |

**Create/Update rule body:**

```json
{
  "name": "No console.log",
  "description": "Disallow console.log in production code",
  "type": "prompt",
  "prompt_template": "Check that the code does not contain console.log statements.",
  "enabled": true
}
```

#### Code Check (SSE)

| Method | Endpoint     | Description                              |
| ------ | ------------ | ---------------------------------------- |
| `POST` | `/api/check` | Run code check with selected rules (SSE) |

**Request body:**

```json
{
  "code": "function hello() { console.log('hi'); }",
  "language": "javascript",
  "rule_ids": ["<rule-uuid-1>", "<rule-uuid-2>"]
}
```

**SSE events:**

- `status` - Initial event with `{ status: "running", total: <number> }`
- `result` - One per rule with `{ rule_id, rule_name, success, message, original, suggested }`
- `done` - Final event with `{ status: "done", results: [...] }`

#### Health Check

| Method | Endpoint      | Description        |
| ------ | ------------- | ------------------ |
| `GET`  | `/api/health` | Returns `{ status: "ok" }` |

### Web Package (`@code-check/web`)

React 19 single-page application with:

- **Ant Design** - UI component library
- **Monaco Editor** - Code editing with syntax highlighting
- **React Router** - Client-side routing (`/check`, `/rules`)
- **SSE Client** - Real-time streaming of check results
- **Vite** - Build tool with API proxy to `http://localhost:3000`

## Usage Example

### Programmatic Usage (Core Library)

```typescript
import {
  MarkdownWorkflow,
  DynamicPromptRule,
  getDatabase,
} from "@code-check/core";

// Create a prompt-based rule
const rule = new DynamicPromptRule(
  "No Magic Numbers",
  "Variables should be used instead of magic numbers",
  "Check that the code does not use magic numbers. All numeric literals " +
    "other than 0 and 1 should be assigned to named constants."
);

// Set up the workflow
const workflow = new MarkdownWorkflow();
workflow.setCode("function calc(x) { return x * 3.14; }");
workflow.setRules([rule]);

// Run the check
workflow.preprocess();
const results = await workflow.process();
workflow.postprocess();

// Inspect results
for (const result of results) {
  console.log(`Success: ${result.success}`);
  console.log(`Message: ${result.message}`);
  console.log(`Suggested:\n${result.suggested}`);
}
```

### REST API Usage

```bash
# Create a rule
curl -X POST http://localhost:3000/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "No TODO comments",
    "description": "Ensure no TODO comments are left in code",
    "type": "prompt",
    "prompt_template": "Check that the code does not contain TODO comments."
  }'

# List all rules
curl http://localhost:3000/api/rules

# Run a code check (SSE stream)
curl -N -X POST http://localhost:3000/api/check \
  -H "Content-Type: application/json" \
  -d '{
    "code": "// TODO: fix this\nfunction add(a, b) { return a + b; }",
    "language": "javascript",
    "rule_ids": ["<rule-id>"]
  }'
```

## Testing

```bash
# Run all core tests
pnpm test:core

# Run tests in watch mode
pnpm test:core:watch

# Run tests with coverage
pnpm --filter @code-check/core test:coverage
```

Tests are located in `packages/core/test/` and use [Vitest](https://vitest.dev/) as the
test framework.

## Tech Stack

| Layer    | Technology                                    |
| -------- | --------------------------------------------- |
| Core     | TypeScript, LangChain, sql.js                 |
| API      | Express.js, SSE, dotenv                       |
| Frontend | React 19, Ant Design, Monaco Editor, Vite     |
| LLM      | Qwen (via DashScope OpenAI-compatible API)    |
| Database | SQLite (sql.js, pure JS, no native bindings)  |
| Testing  | Vitest                                        |
| Monorepo | pnpm workspaces                               |

## License

ISC
