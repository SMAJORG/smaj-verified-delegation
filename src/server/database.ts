import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_DB_PATH = "./data/smaj-verified-delegation.sqlite";

const initialize = (database: DatabaseSync) => {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS delegations (
      id TEXT PRIMARY KEY,
      goal TEXT NOT NULL,
      candidate_name TEXT NOT NULL,
      skills_json TEXT NOT NULL,
      status TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      approved_at TEXT,
      plan_json TEXT NOT NULL,
      jobs_json TEXT NOT NULL,
      selected_job_ids_json TEXT NOT NULL,
      source_url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS delegation_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delegation_id TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (delegation_id) REFERENCES delegations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mock_submissions (
      id TEXT PRIMARY KEY,
      delegation_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      cover_note TEXT NOT NULL,
      created_at TEXT NOT NULL,
      verified_at TEXT,
      UNIQUE (delegation_id, job_id),
      FOREIGN KEY (delegation_id) REFERENCES delegations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS proof_receipts (
      id TEXT PRIMARY KEY,
      delegation_id TEXT NOT NULL UNIQUE,
      receipt_json TEXT NOT NULL,
      proof_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (delegation_id) REFERENCES delegations(id) ON DELETE CASCADE
    );
  `);
};

export const createDatabase = (databasePath = process.env.SMAJ_DELEGATION_DB_PATH || DEFAULT_DB_PATH) => {
  if (databasePath !== ":memory:") {
    const absolutePath = resolve(databasePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    databasePath = absolutePath;
  }
  const database = new DatabaseSync(databasePath);
  initialize(database);
  return database;
};

const globalDatabase = globalThis as typeof globalThis & { smajDelegationDatabase?: DatabaseSync };

export const getDatabase = () => {
  if (!globalDatabase.smajDelegationDatabase) {
    globalDatabase.smajDelegationDatabase = createDatabase();
  }
  return globalDatabase.smajDelegationDatabase;
};
