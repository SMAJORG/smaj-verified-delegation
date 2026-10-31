import { createHash, randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createDatabase, type AppDatabase } from "@/src/server/database";
import { AppError } from "@/src/server/http";

export const DEMO_TTL_SECONDS = 60 * 60;
const globalDemo = globalThis as typeof globalThis & { smajDemoDatabase?: AppDatabase };
export const getDemoDatabase = () => {
  if (!globalDemo.smajDemoDatabase) {
    const path = process.env.SMAJ_HACKATHON_DB_PATH || "./data/hackathon-demo.sqlite";
    if (resolve(/* turbopackIgnore: true */ path) === resolve(/* turbopackIgnore: true */ process.env.SMAJ_DELEGATION_DB_PATH || "./data/smaj-verified-delegation.sqlite")) {
      throw new AppError("demo_configuration", "Demo storage must be separate from production", 503);
    }
    const db = createDatabase(path);
    db.exec(`CREATE TABLE IF NOT EXISTS demo_sessions (
      token_hash TEXT PRIMARY KEY, actor_id TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL
    )`);
    globalDemo.smajDemoDatabase = db;
  }
  return globalDemo.smajDemoDatabase;
};
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
export const cleanupDemoSessions = (db = getDemoDatabase(), now = Date.now()) => {
  db.transaction(() => {
    const expired = db.prepare("SELECT actor_id FROM demo_sessions WHERE expires_at <= ?").all(now) as { actor_id: string }[];
    for (const row of expired) {
      db.prepare("DELETE FROM delegations WHERE owner_id = ?").run(row.actor_id);
      db.prepare("DELETE FROM service_connections WHERE owner_id = ?").run(row.actor_id);
    }
    db.prepare("DELETE FROM demo_sessions WHERE expires_at <= ?").run(now);
  })();
};
export const issueDemoSession = (db = getDemoDatabase(), now = Date.now()) => {
  cleanupDemoSessions(db, now);
  const count = db.prepare("SELECT COUNT(*) AS count FROM demo_sessions").get() as { count: number };
  if (count.count >= 1000) throw new AppError("demo_capacity", "The demo is busy. Please try again later.", 429);
  const value = `hackathon_${randomBytes(32).toString("base64url")}`;
  const actorId = `hackathon:${randomUUID()}`;
  const expiresAt = now + DEMO_TTL_SECONDS * 1000;
  db.prepare("INSERT INTO demo_sessions VALUES (?, ?, ?)").run(digest(value), actorId, expiresAt);
  return { value, actorId, expiresAt, maxAge: DEMO_TTL_SECONDS };
};
export const readDemoSession = (token: string, db = getDemoDatabase(), now = Date.now()) => {
  const row = db.prepare("SELECT actor_id, expires_at FROM demo_sessions WHERE token_hash = ? AND expires_at > ?").get(digest(token), now) as { actor_id: string; expires_at: number } | undefined;
  if (!row || process.env.SMAJ_DEMO_AUTH_ENABLED?.trim().toLowerCase() === "false") throw new AppError("unauthorized", "Your demo session expired. Try the live demo again.", 401);
  return { actorId: row.actor_id, authType: "demo" as const, sandbox: true as const, expiresAt: row.expires_at };
};
export const revokeDemoSession = (token: string, db = getDemoDatabase()) => {
  db.prepare("UPDATE demo_sessions SET expires_at = 0 WHERE token_hash = ?").run(digest(token));
  cleanupDemoSessions(db);
};
