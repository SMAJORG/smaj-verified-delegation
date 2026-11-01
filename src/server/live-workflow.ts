import { createHash, randomUUID } from "node:crypto";
import type { AppDatabase } from "@/src/server/database";
import type { ActorSession } from "@/src/server/auth";
import type { LiveAction, LiveExecution } from "@/src/domain/services";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { ServiceConnectionStore } from "@/src/server/service-connections";
import { AppError } from "@/src/server/http";
import { HubActionAdapter, type ActionAdapter } from "@/src/server/live-actions";

type Run = { task_id: string; owner_id: string; uid: string; state: string; attempts: number; approved_at: string; expires_at: string; actions_json: string; lease_token: string };
export class LiveWorkflow {
  constructor(private db: AppDatabase, private adapter: ActionAdapter = new HubActionAdapter(), private now = () => new Date()) {}
  retry(session: ActorSession, id: string) {
    if (session.authType !== "sso" || session.sandbox || !session.uid) throw new AppError("live_identity_required", "Retrying live execution requires a real Hub sign-in", 403);
    if (process.env.SMAJ_PRODUCTION_WRITES_ENABLED !== "true" || (process.env.SMAJ_AI_DELEGATION_SECRET?.trim().length || 0) < 32) throw new AppError("live_delegation_not_configured", "Live actions are not configured on both servers", 503);
    return this.db.transaction(() => {
      const store = new AiTaskStore(this.db); const task = store.get(session.actorId, id); const current = task.plan.execution;
      if (!current || current.status !== "failed" || current.retryable !== true) throw new AppError("retry_not_available", "This action has no safely retryable failure", 409);
      if (Date.parse(current.expiresAt) <= this.now().getTime()) throw new AppError("contract_expired", "The approved action expired. Review and approve a new request.", 409);
      const run = this.db.prepare("SELECT * FROM live_action_runs WHERE task_id = ? AND owner_id = ? AND uid = ?").get(id, session.actorId, session.uid) as (Run & { approved_at: string; expires_at: string; actions_json: string }) | undefined;
      if (!run || run.state !== "failed" || JSON.stringify(JSON.parse(run.actions_json)) !== JSON.stringify(current.actions)) throw new AppError("retry_contract_mismatch", "The original approved action contract could not be confirmed", 409);
      const at = this.now().toISOString();
      this.db.prepare("UPDATE live_action_runs SET state = 'queued', attempts = 0, next_at = ?, lease_until = NULL, lease_token = NULL WHERE task_id = ? AND owner_id = ? AND state = 'failed'").run(at, id, session.actorId);
      return store.savePlan(session.actorId, id, { ...task.plan, execution: { ...current, status: "queued", attempts: 0, error: undefined, retryable: false, events: [...(current.events || []), { at, type: "recovery.user_retry", message: "The same approved actions were queued. The worker checks Hub records before retrying writes." }] } });
    })();
  }
  approve(session: ActorSession, id: string, actionIds: string[], reviewHash?: string) {
    if (session.authType !== "sso" || session.sandbox || !session.uid) throw new AppError("live_identity_required", "Live execution requires a real Hub sign-in; demo sessions cannot perform production actions", 403);
    if (process.env.SMAJ_PRODUCTION_WRITES_ENABLED !== "true" || (process.env.SMAJ_AI_DELEGATION_SECRET?.trim().length || 0) < 32) throw new AppError("live_delegation_not_configured", "Configure SMAJ_AI_DELEGATION_SECRET and SMAJ_PRODUCTION_WRITES_ENABLED=true on both servers before live execution", 503);
    return this.db.transaction(() => {
      const store = new AiTaskStore(this.db); const task = store.get(session.actorId, id);
      // Replays cannot broaden the approved set or enqueue a second run.
      const previous = this.db.prepare("SELECT actions_json FROM live_action_runs WHERE task_id = ?").get(id) as { actions_json: string } | undefined;
      if (previous) {
        const approvedIds = (JSON.parse(previous.actions_json) as LiveAction[]).map(a => a.id).sort();
        if (JSON.stringify([...new Set(actionIds)].sort()) !== JSON.stringify(approvedIds)) throw new AppError("approval_conflict", "The approved action set cannot be changed after execution is queued", 409);
        return task;
      }
      if (!task.plan.summaryAi || task.plan.summaryError || !task.plan.discovery) throw new AppError("analysis_required", "A completed Meta analysis of live catalog evidence is required before action approval", 409);
      if (Date.parse(task.plan.discovery.completedAt) < this.now().getTime() - 30 * 60_000) throw new AppError("evidence_expired", "Refresh discovery before approving live actions", 409);
      if (!reviewHash || reviewHash !== task.plan.actionReviewHash) throw new AppError("stale_approval", "The reviewed drafts changed. Reload and review the current action details before approving", 409);
      const proposals = task.plan.proposedActions || [];
      const selected = [...new Set(actionIds)].map(actionId => proposals.find(a => a.id === actionId));
      if (!selected.length || selected.length > 3 || selected.some(a => !a)) throw new AppError("invalid_actions", "Select one to three proposed actions", 400);
      const actions = selected as LiveAction[];
      const connected = new ServiceConnectionStore(this.db).list(session.actorId, "sso");
      if (actions.some(a => !connected.some(c => c.serviceId === a.serviceId && c.connected))) throw new AppError("service_disconnected", "Connect each selected service before approving", 409);
      const approvedAt = this.now().toISOString(); const expiresAt = new Date(this.now().getTime() + 24 * 60 * 60_000).toISOString();
      this.db.prepare("INSERT INTO live_action_runs (task_id, owner_id, uid, state, next_at, approved_at, expires_at, actions_json) VALUES (?, ?, ?, 'queued', ?, ?, ?, ?)").run(id, session.actorId, session.uid, approvedAt, approvedAt, expiresAt, JSON.stringify(actions));
      return store.savePlan(session.actorId, id, { ...task.plan, execution: { status: "queued", approvedAt, expiresAt, actions, attempts: 0 } });
    })();
  }
  async tick() {
    const at = this.now().toISOString(); const token = randomUUID();
    const run = this.db.transaction(() => {
      const row = this.db.prepare("SELECT * FROM live_action_runs WHERE (state IN ('queued','retrying') AND next_at <= ?) OR (state = 'running' AND lease_until < ?) ORDER BY next_at LIMIT 1").get(at, at) as Run | undefined;
      if (!row) return;
      this.db.prepare("UPDATE live_action_runs SET state = 'running', attempts = attempts + 1, lease_until = ?, lease_token = ? WHERE task_id = ?").run(new Date(this.now().getTime() + 300_000).toISOString(), token, row.task_id);
      return { ...row, attempts: row.attempts + 1, lease_token: token };
    })();
    if (!run) return false;
    const store = new AiTaskStore(this.db); const task = store.get(run.owner_id, run.task_id);
    const actions = JSON.parse(run.actions_json) as LiveAction[];
    const execution: LiveExecution = { status: "running", approvedAt: run.approved_at, expiresAt: run.expires_at, actions, attempts: run.attempts, evidence: task.plan.execution?.evidence || [], events: [...(task.plan.execution?.events || []), { at, type: "execution.started", message: `Live attempt ${run.attempts} started` }] };
    store.savePlan(run.owner_id, run.task_id, { ...task.plan, execution });
    const contract = { ownerId: run.owner_id, uid: run.uid, taskId: run.task_id, approvedAt: run.approved_at, expiresAt: run.expires_at };
    try {
      if (Date.parse(run.expires_at) <= this.now().getTime()) throw new AppError("contract_expired", "Live action approval expired; inspect backend state before approving a new task", 409);
      const evidence: unknown[] = [];
      for (const action of actions) {
        const connected = new ServiceConnectionStore(this.db).list(run.owner_id, "sso");
        if (!connected.some(c => c.serviceId === action.serviceId && c.connected)) throw new AppError("service_disconnected", "Service disconnected; pending actions stopped", 409);
        // First check for a completed action after a lost response/server restart.
        let verified: Record<string, unknown> | undefined;
        try { verified = await this.adapter.perform(contract, action, "verify"); }
        catch (error) { if (!(error instanceof AppError) || error.status !== 409 || error.code !== "hub_action_failed") throw error; }
        if (!verified) { await this.adapter.perform(contract, action, "execute"); verified = await this.adapter.perform(contract, action, "verify"); }
        evidence.push(verified);
        execution.evidence = [...evidence];
        execution.events!.push({ at: this.now().toISOString(), type: "action.verified", message: `${action.kind}: ${action.recordId} verified against Hub backend` });
        this.db.transaction(() => {
          if (this.db.prepare("SELECT 1 FROM live_action_runs WHERE task_id = ? AND lease_token = ?").get(run.task_id, token)) store.savePlan(run.owner_id, run.task_id, { ...store.get(run.owner_id, run.task_id).plan, execution });
        })();
      }
      const proof = { mode: "live" as const, verifiedAt: this.now().toISOString(), evidence };
      execution.status = "verified";
      execution.receipt = { ...proof, proof: { contract, actions, ...proof }, proofHash: createHash("sha256").update(JSON.stringify({ contract, actions, ...proof })).digest("hex") };
    } catch (error) {
      const failure = error instanceof AppError ? error : new AppError("execution_failed", "Live execution failed; outcome is unverified", 502);
      const retryable = [429, 500, 502, 503, 504].includes(failure.status);
      execution.status = run.attempts < 3 && retryable ? "retrying" : "failed";
      execution.error = failure.message;
      execution.retryable = retryable;
      execution.events!.push({ at: this.now().toISOString(), type: execution.status, message: failure.message });
    }
    // A stale worker cannot overwrite a newer lease's outcome.
    this.db.transaction(() => {
      const owns = this.db.prepare("SELECT 1 FROM live_action_runs WHERE task_id = ? AND lease_token = ?").get(run.task_id, token);
      if (!owns) return;
      const current = store.get(run.owner_id, run.task_id);
      store.savePlan(run.owner_id, run.task_id, { ...current.plan, execution });
      this.db.prepare("UPDATE live_action_runs SET state = ?, next_at = ?, lease_until = NULL, lease_token = NULL WHERE task_id = ? AND lease_token = ?").run(execution.status, new Date(this.now().getTime() + run.attempts * 5000).toISOString(), run.task_id, token);
    })();
    return true;
  }
}
