import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

const DEFAULT_DB_PATH = "./data/smaj-verified-delegation.sqlite";
export type AppDatabase = Database.Database;

const hasColumn = (database: AppDatabase, table: string, column: string) =>
  (database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some(item => item.name === column);

const initialize = (database: AppDatabase) => {
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  database.exec(`
    CREATE TABLE IF NOT EXISTS delegations (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, goal TEXT NOT NULL,
      candidate_name TEXT NOT NULL, skills_json TEXT NOT NULL, status TEXT NOT NULL,
      expires_at TEXT NOT NULL, approved_at TEXT, plan_json TEXT NOT NULL,
      jobs_json TEXT NOT NULL, selected_job_ids_json TEXT NOT NULL, source_url TEXT NOT NULL,
      create_key TEXT, run_started_at TEXT, run_lease_until TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS delegation_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, delegation_id TEXT NOT NULL,
      type TEXT NOT NULL, message TEXT NOT NULL, payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (delegation_id) REFERENCES delegations(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS mock_submissions (
      id TEXT PRIMARY KEY, delegation_id TEXT NOT NULL, job_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE, status TEXT NOT NULL, cover_note TEXT NOT NULL,
      created_at TEXT NOT NULL, verified_at TEXT, UNIQUE (delegation_id, job_id),
      FOREIGN KEY (delegation_id) REFERENCES delegations(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS proof_receipts (
      id TEXT PRIMARY KEY, delegation_id TEXT NOT NULL UNIQUE, receipt_json TEXT NOT NULL,
      proof_hash TEXT NOT NULL, created_at TEXT NOT NULL,
      FOREIGN KEY (delegation_id) REFERENCES delegations(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS idempotency_records (
      owner_id TEXT NOT NULL, operation TEXT NOT NULL, request_key TEXT NOT NULL,
      delegation_id TEXT NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY (owner_id, operation, request_key),
      FOREIGN KEY (delegation_id) REFERENCES delegations(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS service_connections (
      owner_id TEXT NOT NULL, service_id TEXT NOT NULL, connected INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL, PRIMARY KEY (owner_id, service_id)
    );
  `);

  if (!hasColumn(database, "delegations", "owner_id")) database.exec("ALTER TABLE delegations ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'legacy-demo'");
  if (!hasColumn(database, "delegations", "create_key")) database.exec("ALTER TABLE delegations ADD COLUMN create_key TEXT");
  if (!hasColumn(database, "delegations", "run_started_at")) database.exec("ALTER TABLE delegations ADD COLUMN run_started_at TEXT");
  if (!hasColumn(database, "delegations", "run_lease_until")) database.exec("ALTER TABLE delegations ADD COLUMN run_lease_until TEXT");
  database.exec(`
    CREATE INDEX IF NOT EXISTS delegations_owner_updated ON delegations(owner_id, updated_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS delegations_owner_create_key ON delegations(owner_id, create_key) WHERE create_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS delegation_events_delegation_id ON delegation_events(delegation_id, id);
    CREATE INDEX IF NOT EXISTS service_connections_owner ON service_connections(owner_id, connected);
  `);
};

export const createDatabase = (databasePath = process.env.SMAJ_DELEGATION_DB_PATH || DEFAULT_DB_PATH) => {
  if (databasePath !== ":memory:") {
    const absolutePath = resolve(/* turbopackIgnore: true */ databasePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    databasePath = absolutePath;
  }
  const database = new Database(databasePath);
  initialize(database);
  return database;
};

const globalDatabase = globalThis as typeof globalThis & { smajDelegationDatabase?: AppDatabase };
export const getDatabase = () => {
  if (!globalDatabase.smajDelegationDatabase) globalDatabase.smajDelegationDatabase = createDatabase();
  return globalDatabase.smajDelegationDatabase;
};
