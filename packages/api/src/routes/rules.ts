import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getDatabase, persistDatabase } from "@code-check/core";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const rows = db.exec(
      "SELECT id, name, description, type, prompt_template, enabled, created_at, updated_at FROM rules ORDER BY created_at DESC"
    );
    if (rows.length === 0) {
      res.json([]);
      return;
    }
    const cols = rows[0].columns;
    const results = rows[0].values.map((row: unknown[]) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((col: string, i: number) => {
        obj[col] = col === "enabled" ? Boolean(row[i]) : row[i];
      });
      return obj;
    });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rules" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const stmt = db.prepare(
      "SELECT id, name, description, type, prompt_template, enabled, created_at, updated_at FROM rules WHERE id = ?"
    );
    stmt.bind([req.params.id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      row.enabled = Boolean(row.enabled);
      res.json(row);
    } else {
      res.status(404).json({ error: "Rule not found" });
    }
    stmt.free();
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rule" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, description, type, prompt_template, enabled } = req.body;
    if (!name || !type) {
      res.status(400).json({ error: "name and type are required" });
      return;
    }
    const id = uuidv4();
    const db = await getDatabase();
    db.run(
      "INSERT INTO rules (id, name, description, type, prompt_template, enabled) VALUES (?, ?, ?, ?, ?, ?)",
      [id, name, description || "", type, prompt_template || "", enabled !== false ? 1 : 0]
    );
    persistDatabase();

    const stmt = db.prepare("SELECT * FROM rules WHERE id = ?");
    stmt.bind([id]);
    stmt.step();
    const row = stmt.getAsObject();
    row.enabled = Boolean(row.enabled);
    stmt.free();

    res.status(201).json(row);
  } catch (error) {
    res.status(500).json({ error: "Failed to create rule" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const { name, description, type, prompt_template, enabled } = req.body;

    const check = db.exec("SELECT id FROM rules WHERE id = ?", [req.params.id]);
    if (check.length === 0 || check[0].values.length === 0) {
      res.status(404).json({ error: "Rule not found" });
      return;
    }

    db.run(
      `UPDATE rules SET 
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        type = COALESCE(?, type),
        prompt_template = COALESCE(?, prompt_template),
        enabled = COALESCE(?, enabled),
        updated_at = datetime('now')
      WHERE id = ?`,
      [
        name ?? null,
        description ?? null,
        type ?? null,
        prompt_template ?? null,
        enabled !== undefined ? (enabled ? 1 : 0) : null,
        req.params.id,
      ]
    );
    persistDatabase();

    const stmt = db.prepare("SELECT * FROM rules WHERE id = ?");
    stmt.bind([req.params.id]);
    stmt.step();
    const row = stmt.getAsObject();
    row.enabled = Boolean(row.enabled);
    stmt.free();

    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "Failed to update rule" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const check = db.exec("SELECT id FROM rules WHERE id = ?", [req.params.id]);
    if (check.length === 0 || check[0].values.length === 0) {
      res.status(404).json({ error: "Rule not found" });
      return;
    }
    db.run("DELETE FROM rules WHERE id = ?", [req.params.id]);
    persistDatabase();
    res.json({ message: "Rule deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete rule" });
  }
});

export default router;
