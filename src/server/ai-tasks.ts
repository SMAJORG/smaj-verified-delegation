import { randomUUID } from "node:crypto";
import type { ServiceRoutePlan } from "@/src/domain/services";
import type { AppDatabase } from "@/src/server/database";
import { AppError } from "@/src/server/http";

export type AiTask = { id: string; task: string; plan: ServiceRoutePlan; createdAt: string };
export class AiTaskStore {
  constructor(private database: AppDatabase) {}
  list(owner: string): AiTask[] {
    return (this.database.prepare("SELECT id, task, plan_json, created_at FROM ai_tasks WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100").all(owner) as Array<{ id: string; task: string; plan_json: string; created_at: string }>).map(row => ({ id: row.id, task: row.task, plan: JSON.parse(row.plan_json), createdAt: row.created_at }));
  }
  create(owner: string, task: string, plan: ServiceRoutePlan): AiTask {
    const result = { id: randomUUID(), task, plan, createdAt: new Date().toISOString() };
    this.database.prepare("INSERT INTO ai_tasks (id, owner_id, task, plan_json, created_at) VALUES (?, ?, ?, ?, ?)").run(result.id, owner, task, JSON.stringify(plan), result.createdAt);
    return result;
  }
  get(owner: string, id: string): AiTask {
    const row = this.database.prepare("SELECT id, task, plan_json, created_at FROM ai_tasks WHERE owner_id = ? AND id = ?").get(owner, id) as { id: string; task: string; plan_json: string; created_at: string } | undefined;
    if (!row) throw new AppError("task_not_found", "Task not found", 404);
    return { id: row.id, task: row.task, plan: JSON.parse(row.plan_json), createdAt: row.created_at };
  }
  delete(owner: string, id: string) {
    const result = this.database.prepare("DELETE FROM ai_tasks WHERE owner_id = ? AND id = ?").run(owner, id);
    if (!result.changes) throw new AppError("task_not_found", "Task not found", 404);
  }
}
