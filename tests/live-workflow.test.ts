import test from "node:test";
import assert from "node:assert/strict";
import { createDatabase } from "@/src/server/database";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { ServiceConnectionStore } from "@/src/server/service-connections";
import { LiveWorkflow } from "@/src/server/live-workflow";
import { HubActionAdapter } from "@/src/server/live-actions";
import { AppError } from "@/src/server/http";
import type { ServiceRoutePlan } from "@/src/domain/services";

const session = { actorId: "owner", uid: "pi-owner", authType: "sso" as const };
function setup() {
  const db = createDatabase(":memory:"); const store = new AiTaskStore(db); let now = new Date();
  const plan: ServiceRoutePlan = { ai: {provider:"meta",model:"fixture",responseId:"fixture",receivedAt:new Date().toISOString()}, model: "fixture", summary: "Fixture, not a real Meta call", steps: [], services: ["jobs", "store"], warnings: [], summaryAi: { provider: "meta", model: "fixture", responseId: "fixture", receivedAt: now.toISOString() }, discovery: { approvedAt: now.toISOString(), completedAt: now.toISOString(), results: [], proofHash: "fixture" }, actionReviewHash: "fixture-review-hash", proposedActions: [{ id: "one", serviceId: "jobs", recordId: "real-job", kind: "apply", title: "Apply", coverNote: "Approved honest draft" }, { id: "two", serviceId: "store", recordId: "real-product", kind: "save_product", title: "Save product" }] };
  const task = store.create(session.actorId, "Apply and save product", plan);
  const connections = new ServiceConnectionStore(db); connections.list(session.actorId, "sso"); connections.set(session.actorId, "jobs", true); connections.set(session.actorId, "store", true);
  return { db, store, task, connections, now: () => now, advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}
function enable() { process.env.SMAJ_PRODUCTION_WRITES_ENABLED = "true"; process.env.SMAJ_AI_DELEGATION_SECRET = "test-only-delegation-secret-at-least-32-characters"; }

test("live queue requires SSO, evidence, connected services, and an immutable explicit approval", () => {
  const old = { ...process.env }; enable(); const f = setup(); const workflow = new LiveWorkflow(f.db, undefined, f.now);
  try {
    assert.throws(() => workflow.approve({ ...session, authType: "demo" }, f.task.id, ["one"], "fixture-review-hash", true), /authenticated SMAJ PI HUB/);
    assert.throws(() => workflow.approve({ ...session, actorId: "other" }, f.task.id, ["one"], "fixture-review-hash", true), /Task not found/);
    assert.throws(() => workflow.approve(session, f.task.id, ["one"], "stale-hash"), /drafts changed/);
    assert.throws(() => workflow.approve(session, f.task.id, ["invented"], "fixture-review-hash", true), /Select one/);
    f.connections.set(session.actorId, "jobs", false); assert.throws(() => workflow.approve(session, f.task.id, ["one"], "fixture-review-hash", true), /Connect/); f.connections.set(session.actorId, "jobs", true);
    assert.throws(() => workflow.approve(session, f.task.id, ["one"], "fixture-review-hash", false), /Explicitly confirm/);
    assert.equal(workflow.approve(session, f.task.id, ["one"], "fixture-review-hash", true).plan.execution?.status, "queued");
    assert.equal(workflow.approve(session, f.task.id, ["one"], "fixture-review-hash", true).plan.execution?.status, "queued");
    assert.throws(() => workflow.approve(session, f.task.id, ["one", "two"], "fixture-review-hash", true), /cannot be changed/);
    assert.throws(() => f.store.delete(session.actorId, f.task.id), /Wait/);
    assert.equal((f.db.prepare("SELECT COUNT(*) n FROM live_action_runs").get() as {n:number}).n, 1);
  } finally { f.db.close(); process.env = old; }
});

test("worker recovers a lost execute response, performs no duplicate write, and independently verifies every action", async () => {
  const old = { ...process.env }; enable(); const f = setup(); const backend = new Map(); let writes = 0; let failResponse = true;
  const adapter = { async perform(_contract: unknown, action: {id:string}, operation: string) {
    if (operation === "verify") { if (!backend.has(action.id)) throw new AppError("hub_action_failed", "Not yet submitted", 409); return backend.get(action.id); }
    writes++; backend.set(action.id, { backendId: "backend-" + action.id, status: "saved" });
    if (failResponse) { failResponse = false; throw new AppError("hub_unreachable", "Response lost", 502); }
    return backend.get(action.id);
  } };
  try {
    const worker = new LiveWorkflow(f.db, adapter, f.now); worker.approve(session, f.task.id, ["one", "two"], "fixture-review-hash", true);
    await worker.tick(); assert.equal(f.store.get("owner", f.task.id).plan.execution?.status, "retrying");
    f.advance(6000); await new LiveWorkflow(f.db, adapter, f.now).tick();
    const result = f.store.get("owner", f.task.id).plan.execution!;
    assert.equal(result.status, "verified"); assert.equal(writes, 2); assert.equal(result.receipt?.evidence.length, 2); assert.match(result.receipt!.proofHash, /^[a-f0-9]{64}$/);
    assert.equal(await worker.tick(), false);
  } finally { f.db.close(); process.env = old; }
});

test("expired lease is reclaimed; disconnection, expiry, and verification failure never issue a receipt", async () => {
  const old = { ...process.env }; enable();
  try {
    for (const reason of ["disconnect", "expiry", "verification"]) {
      const f = setup(); let calls = 0;
      const adapter = { async perform() { calls++; throw new AppError("verification_mismatch", "Independent verification failed", 409); } };
      const worker = new LiveWorkflow(f.db, adapter, f.now); worker.approve(session, f.task.id, ["one"], "fixture-review-hash", true);
      f.db.prepare("UPDATE live_action_runs SET state='running', lease_until=?").run(new Date(f.now().getTime() - 1).toISOString());
      if (reason === "disconnect") f.connections.set("owner", "jobs", false);
      if (reason === "expiry") f.advance(25 * 60 * 60_000);
      await worker.tick(); const result = f.store.get("owner", f.task.id).plan.execution!;
      assert.equal(result.status, "failed"); assert.equal(result.receipt, undefined); assert.equal(calls, reason === "verification" ? 1 : 0); f.db.close();
    }
  } finally { process.env = old; }
});

test("Hub adapter rejects wrong identity, record or backend status instead of trusting execute acknowledgements", async () => {
  const old = { ...process.env }; enable();
  try {
    const contract = { ownerId: "owner", uid: "pi", taskId: "task", approvedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 10000).toISOString() };
    const action = { id: "one", serviceId: "store" as const, recordId: "product", kind: "save_product" as const, title: "Save" };
    const adapter = new HubActionAdapter(async (_input, init) => { assert.equal(init?.redirect, "error"); assert.ok((init?.headers as Record<string,string>)["X-SMAJ-Delegation"]); return Response.json({ evidence: { ownerId: "other", contractId: "task", recordId: "product", serviceId: "store", kind: "save_product", backendId: "db-id", status: "saved" } }); });
    await assert.rejects(adapter.perform(contract, action, "verify"), /did not match/);
  } finally { process.env = old; }
});

test("approval survives closing and reopening the database before the worker starts", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os"); const { join } = await import("node:path");
  const old = { ...process.env }; enable(); const f = setup();
  const directory = mkdtempSync(join(tmpdir(), "smaj-live-queue-")); const file = join(directory, "queue.sqlite");
  let db = createDatabase(file); let writes = 0; let exists = false;
  const adapter = { async perform(_contract: unknown, _action: unknown, operation: string) { if (operation === "execute") { exists = true; writes++; } if (!exists) throw new AppError("hub_action_failed", "Not submitted", 409); return { backendId: "persisted-backend-record", status: "submitted" }; } };
  try {
    const task = new AiTaskStore(db).create("owner", "Approved persisted application", f.task.plan);
    new ServiceConnectionStore(db).list("owner", "sso"); new ServiceConnectionStore(db).set("owner", "jobs", true);
    new LiveWorkflow(db, adapter).approve(session, task.id, ["one"], "fixture-review-hash", true);
    db.close(); db = createDatabase(file);
    await new LiveWorkflow(db, adapter).tick();
    assert.equal(new AiTaskStore(db).get("owner",task.id).plan.execution?.status, "verified"); assert.equal(writes,1);
  } finally { db.close(); f.db.close(); rmSync(directory,{recursive:true,force:true}); process.env=old; }
});
