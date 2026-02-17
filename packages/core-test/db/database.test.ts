import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getDatabase,
  persistDatabase,
  setDatabasePath,
} from "@code-check/core";
import fs from "fs";
import path from "path";
import os from "os";

describe("Database", () => {
  const testDir = path.join(os.tmpdir(), "code-check-test-" + Date.now());
  const testDbPath = path.join(testDir, "test.db");

  beforeEach(() => {
    setDatabasePath(testDbPath);
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should initialize database and create rules table", async () => {
    const db = await getDatabase();

    const tables = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='rules'"
    );
    expect(tables.length).toBe(1);
    expect(tables[0].values[0][0]).toBe("rules");
  });

  it("should persist database to disk", async () => {
    const db = await getDatabase();
    persistDatabase();

    expect(fs.existsSync(testDbPath)).toBe(true);
  });

  it("should insert and query rules", async () => {
    const db = await getDatabase();

    db.run(
      `INSERT INTO rules (id, name, description, type, prompt_template, enabled)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["test-id-1", "no-console", "Disallow console.log", "code", "", 1]
    );

    const result = db.exec("SELECT * FROM rules WHERE id = 'test-id-1'");
    expect(result.length).toBe(1);
    expect(result[0].values[0][1]).toBe("no-console");
    expect(result[0].values[0][3]).toBe("code");
  });

  it("should enforce type CHECK constraint", async () => {
    const db = await getDatabase();

    expect(() => {
      db.run(
        `INSERT INTO rules (id, name, description, type, prompt_template, enabled)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ["test-id-2", "bad-rule", "Bad type", "invalid_type", "", 1]
      );
    }).toThrow();
  });
});
