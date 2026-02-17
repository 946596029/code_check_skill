import { Router, Request, Response } from "express";
import { getDatabase, DynamicPromptRule, RuleCheckResult } from "@code-check/core";

const router = Router();

interface CheckRequest {
  code: string;
  language?: string;
  rule_ids: string[];
}

function sendSSE(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * POST /api/check
 * Accepts { code, language?, rule_ids } and streams results via SSE.
 * Each rule result is sent as it completes, followed by a final "done" event.
 */
router.post("/", async (req: Request, res: Response) => {
  const { code, language, rule_ids }: CheckRequest = req.body;

  if (!code || !rule_ids || rule_ids.length === 0) {
    res.status(400).json({ error: "code and rule_ids are required" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  sendSSE(res, "status", { status: "running", total: rule_ids.length });

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  const db = await getDatabase();
  const results: Record<string, unknown>[] = [];

  for (const ruleId of rule_ids) {
    if (closed) break;

    const stmt = db.prepare(
      "SELECT id, name, description, type, prompt_template FROM rules WHERE id = ? AND enabled = 1"
    );
    stmt.bind([ruleId]);

    if (!stmt.step()) {
      stmt.free();
      sendSSE(res, "result", {
        rule_id: ruleId,
        rule_name: "Unknown",
        success: false,
        message: "Rule not found or disabled",
        original: code,
        suggested: code,
      });
      continue;
    }

    const ruleRow = stmt.getAsObject();
    stmt.free();

    let result: RuleCheckResult | null = null;

    try {
      if (ruleRow.type === "prompt") {
        const promptRule = new DynamicPromptRule(
          ruleRow.name as string,
          ruleRow.description as string,
          ruleRow.prompt_template as string
        );
        const ruleResults = await promptRule.test(code);
        result =
          ruleResults.length > 0
            ? ruleResults[0]
            : new RuleCheckResult(true, "Passed", code, code);
      }

      const resultData = result
        ? {
            rule_id: ruleId,
            rule_name: ruleRow.name,
            success: result.success,
            message: result.message,
            original: result.original,
            suggested: result.suggested,
          }
        : {
            rule_id: ruleId,
            rule_name: ruleRow.name,
            success: false,
            message: "Unsupported rule type",
            original: code,
            suggested: code,
          };

      results.push(resultData);
      sendSSE(res, "result", resultData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const errorData = {
        rule_id: ruleId,
        rule_name: ruleRow.name,
        success: false,
        message: msg,
        original: code,
        suggested: code,
      };
      results.push(errorData);
      sendSSE(res, "result", errorData);
    }
  }

  if (!closed) {
    sendSSE(res, "done", { status: "done", results });
    res.end();
  }
});

export default router;
