import { createHash, randomBytes } from "node:crypto";
import { getDatabase, type AppDatabase } from "@/src/server/database";
import { AiTaskStore, type AiTask } from "@/src/server/ai-tasks";
import { AppError } from "@/src/server/http";

export const SEARCH_SIGNIN_COOKIE = "smaj_search_signin";
export const SEARCH_SIGNIN_TTL = 600;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
// A browser-bound, expiring consent handoff. It never grants catalog access before SSO.
export class SearchSignInStore {
  constructor(private readonly db: AppDatabase = getDatabase()) {
    db.exec(`CREATE TABLE IF NOT EXISTS search_signins (token_hash TEXT PRIMARY KEY, state_hash TEXT, request_json TEXT NOT NULL, expires_at INTEGER NOT NULL, owner_id TEXT, task_id TEXT)`);
  }
  create(task: AiTask) {
    const token = randomBytes(32).toString("base64url");
    const { discovery, execution, proposedActions, matches, actionReviewHash, summaryAi, summaryError, ...plan } = task.plan;
    this.db.prepare("DELETE FROM search_signins WHERE expires_at <= ?").run(Date.now());
    this.db.prepare("INSERT INTO search_signins(token_hash, request_json, expires_at) VALUES (?, ?, ?)").run(hash(token), JSON.stringify({ task: task.task, plan }), Date.now() + SEARCH_SIGNIN_TTL * 1000);
    return token;
  }
  bind(token: string, state: string) {
    const result = this.db.prepare("UPDATE search_signins SET state_hash = ? WHERE token_hash = ? AND expires_at > ? AND owner_id IS NULL").run(hash(state), hash(token), Date.now());
    if (!result.changes) throw new AppError("search_expired", "Your approved search expired. Open the request and approve it again.", 409);
  }
  complete(token: string, state: string, owner: string) {
    return this.db.transaction(() => {
      const row = this.db.prepare("SELECT request_json FROM search_signins WHERE token_hash = ? AND state_hash = ? AND expires_at > ? AND owner_id IS NULL").get(hash(token), hash(state), Date.now()) as {request_json:string}|undefined;
      if (!row) throw new AppError("search_expired", "Your approved search expired. Please approve it again.", 409);
      const saved = JSON.parse(row.request_json);
      const task = new AiTaskStore(this.db).create(owner, saved.task, saved.plan);
      this.db.prepare("UPDATE search_signins SET owner_id = ?, task_id = ?, request_json = '{}' WHERE token_hash = ?").run(owner, task.id, hash(token));
      return task;
    })();
  }
  consume(token: string, owner: string, taskId: string) {
    const result = this.db.prepare("DELETE FROM search_signins WHERE token_hash = ? AND owner_id = ? AND task_id = ? AND expires_at > ?").run(hash(token), owner, taskId, Date.now());
    if (!result.changes) throw new AppError("approval_required", "Open this request and approve the search again.", 409);
  }
}
