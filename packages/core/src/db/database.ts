import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import path from "path";
import fs from "fs";

let dbPath = path.resolve(process.cwd(), "data/code_check.db");

let db: SqlJsDatabase | null = null;

/**
 * Configure the database storage path.
 * Must be called before the first getDatabase() call to take effect.
 */
export function setDatabasePath(customPath: string): void {
  dbPath = path.resolve(customPath);
}

function ensureDataDir(): void {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveToDisk(): void {
  if (!db) return;
  ensureDataDir();
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export async function getDatabase(): Promise<SqlJsDatabase> {
  if (db) return db;

  const SQL = await initSqlJs();
  ensureDataDir();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  initSchema(db);
  saveToDisk();
  return db;
}

function initSchema(database: SqlJsDatabase): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL CHECK(type IN ('code', 'prompt')),
      prompt_template TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export function persistDatabase(): void {
  saveToDisk();
}
