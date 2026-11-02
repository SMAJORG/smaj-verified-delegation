import { randomUUID } from "node:crypto";
import type { ServiceRoutePlan } from "@/src/domain/services";
import type { AppDatabase } from "@/src/server/database";
import { AppError } from "@/src/server/http";

export type AiTask = { id: string; task: string; plan: ServiceRoutePlan; createdAt: string; conversationId?: string; requestKey?: string };
export type AiConversation = { id: string; title: string; createdAt: string; updatedAt: string; taskCount: number; latestTaskId: string; lastMessage: string };
export class AiTaskStore {
  constructor(private database: AppDatabase) {}
  list(owner: string): AiTask[] {
    return (this.database.prepare("SELECT id, task, plan_json, created_at, conversation_id, request_key FROM ai_tasks WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100").all(owner) as Array<{ id: string; task: string; plan_json: string; created_at: string; conversation_id: string; request_key: string | null }>).map(row => ({ id: row.id, task: row.task, plan: JSON.parse(row.plan_json), createdAt: row.created_at, conversationId: row.conversation_id || row.id, ...(row.request_key ? { requestKey: row.request_key } : {}) }));
  }
  conversation(owner: string, conversationId: string): AiTask[] {
    const rows = this.database.prepare("SELECT id, task, plan_json, created_at, conversation_id FROM ai_tasks WHERE owner_id = ? AND conversation_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 10").all(owner, conversationId) as Array<{ id: string; task: string; plan_json: string; created_at: string; conversation_id: string }>;
    return rows.reverse().map(row => ({ id: row.id, task: row.task, plan: JSON.parse(row.plan_json), createdAt: row.created_at, conversationId: row.conversation_id || row.id }));
  }
  conversationHistory(owner: string, conversationId: string): AiTask[] {
    const rows = this.database.prepare("SELECT id, task, plan_json, created_at, conversation_id, request_key FROM ai_tasks WHERE owner_id = ? AND conversation_id = ? ORDER BY created_at ASC, rowid ASC").all(owner, conversationId) as Array<{ id: string; task: string; plan_json: string; created_at: string; conversation_id: string; request_key: string | null }>;
    if (!rows.length) throw new AppError("conversation_not_found", "Conversation not found", 404);
    return rows.map(row => ({ id: row.id, task: row.task, plan: JSON.parse(row.plan_json), createdAt: row.created_at, conversationId: row.conversation_id || row.id, ...(row.request_key ? { requestKey: row.request_key } : {}) }));
  }
  conversations(owner: string): AiConversation[] {
    return this.database.prepare(`
      SELECT c.id, c.title, c.created_at AS createdAt, MAX(t.created_at) AS updatedAt, COUNT(t.id) AS taskCount,
        (SELECT latest.id FROM ai_tasks AS latest WHERE latest.owner_id = c.owner_id AND latest.conversation_id = c.id ORDER BY latest.created_at DESC, latest.rowid DESC LIMIT 1) AS latestTaskId,
        (SELECT latest.task FROM ai_tasks AS latest WHERE latest.owner_id = c.owner_id AND latest.conversation_id = c.id ORDER BY latest.created_at DESC, latest.rowid DESC LIMIT 1) AS lastMessage
      FROM ai_conversations AS c
      JOIN ai_tasks AS t ON t.owner_id = c.owner_id AND t.conversation_id = c.id
      WHERE c.owner_id = ?
      GROUP BY c.owner_id, c.id
      ORDER BY updatedAt DESC
      LIMIT 100
    `).all(owner) as AiConversation[];
  }
  byRequestKey(owner: string, requestKey: string): AiTask | undefined {
    const row = this.database.prepare("SELECT id, task, plan_json, created_at, conversation_id, request_key FROM ai_tasks WHERE owner_id = ? AND request_key = ?").get(owner, requestKey) as { id: string; task: string; plan_json: string; created_at: string; conversation_id: string; request_key: string } | undefined;
    return row ? { id: row.id, task: row.task, plan: JSON.parse(row.plan_json), createdAt: row.created_at, conversationId: row.conversation_id || row.id, requestKey: row.request_key } : undefined;
  }
  create(owner: string, task: string, plan: ServiceRoutePlan, conversationId: string = randomUUID(), requestKey?: string): AiTask {
    const result = { id: randomUUID(), task, plan, createdAt: new Date().toISOString(), conversationId, ...(requestKey ? { requestKey } : {}) };
    const save = this.database.transaction(() => {
      this.database.prepare("INSERT OR IGNORE INTO ai_conversations (id, owner_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(result.conversationId, owner, task.slice(0, 120), result.createdAt, result.createdAt);
      this.database.prepare("INSERT INTO ai_tasks (id, owner_id, task, plan_json, created_at, conversation_id, request_key) VALUES (?, ?, ?, ?, ?, ?, ?)").run(result.id, owner, task, JSON.stringify(plan), result.createdAt, result.conversationId, requestKey || null);
      this.database.prepare("UPDATE ai_conversations SET updated_at = ? WHERE owner_id = ? AND id = ?").run(result.createdAt, owner, result.conversationId);
    });
    save();
    return result;
  }
  renameConversation(owner: string, conversationId: string, title: string) {
    const result = this.database.prepare("UPDATE ai_conversations SET title = ? WHERE owner_id = ? AND id = ? AND EXISTS (SELECT 1 FROM ai_tasks WHERE owner_id = ? AND conversation_id = ?)").run(title, owner, conversationId, owner, conversationId);
    if (!result.changes) throw new AppError("conversation_not_found", "Conversation not found", 404);
    return this.conversations(owner).find(conversation => conversation.id === conversationId)!;
  }
  deleteConversation(owner: string, conversationId: string) {
    const remove = this.database.transaction(() => {
      const rows = this.database.prepare("SELECT plan_json FROM ai_tasks WHERE owner_id = ? AND conversation_id = ?").all(owner, conversationId) as Array<{ plan_json: string }>;
      if (!rows.length) throw new AppError("conversation_not_found", "Conversation not found", 404);
      if (rows.some(row => ["queued", "running", "retrying", "verifying", "executing"].includes((JSON.parse(row.plan_json) as ServiceRoutePlan).execution?.status || ""))) {
        throw new AppError("task_running", "Wait for live actions to finish before deleting this conversation", 409);
      }
      this.database.prepare("DELETE FROM ai_tasks WHERE owner_id = ? AND conversation_id = ?").run(owner, conversationId);
      this.database.prepare("DELETE FROM ai_conversations WHERE owner_id = ? AND id = ?").run(owner, conversationId);
    });
    remove();
  }
  get(owner: string, id: string): AiTask {
    const row = this.database.prepare("SELECT id, task, plan_json, created_at, conversation_id, request_key FROM ai_tasks WHERE owner_id = ? AND id = ?").get(owner, id) as { id: string; task: string; plan_json: string; created_at: string; conversation_id: string; request_key: string | null } | undefined;
    if (!row) throw new AppError("task_not_found", "Task not found", 404);
    return { id: row.id, task: row.task, plan: JSON.parse(row.plan_json), createdAt: row.created_at, conversationId: row.conversation_id || row.id, ...(row.request_key ? { requestKey: row.request_key } : {}) };
  }
  savePlan(owner: string, id: string, plan: ServiceRoutePlan) {
    this.get(owner, id);
    this.database.prepare("UPDATE ai_tasks SET plan_json = ? WHERE owner_id = ? AND id = ?").run(JSON.stringify(plan), owner, id);
    return this.get(owner, id);
  }
  delete(owner: string, id: string) {
    const task = this.get(owner, id);
    if (task.plan.execution && ["queued", "running", "retrying", "verifying", "executing"].includes(task.plan.execution.status)) throw new AppError("task_running", "Wait for live actions to finish before deleting this task", 409);
    const result = this.database.prepare("DELETE FROM ai_tasks WHERE owner_id = ? AND id = ?").run(owner, id);
    if (!result.changes) throw new AppError("task_not_found", "Task not found", 404);
    this.database.prepare("DELETE FROM ai_conversations WHERE owner_id = ? AND id = ? AND NOT EXISTS (SELECT 1 FROM ai_tasks WHERE owner_id = ? AND conversation_id = ?)").run(owner, task.conversationId || task.id, owner, task.conversationId || task.id);
  }
}
