import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDatabase } from "@/src/server/database";
import { AppError } from "@/src/server/http";
import { DelegationWorkflow } from "@/src/server/workflow";
import { jobs, plan } from "./fixtures";

const owner = "actor-primary";
const input = {
  candidateName: "Amina Okafor",
  skills: ["TypeScript", "React", "Node.js"],
  goal: "Prepare the strongest matching job applications for my approval.",
};

const makeWorkflow = (database = createDatabase(":memory:")) => {
  let currentTime = new Date("2026-10-29T10:00:00.000Z");
  const workflow = new DelegationWorkflow({
    database,
    jobsAdapter: { sourceUrl: "https://smaj.example/jobs/jobs", listJobs: async () => jobs },
    planner: { plan: async () => plan },
    now: () => currentTime,
    pause: async () => undefined,
  });
  return { database, workflow, advance: (milliseconds: number) => { currentTime = new Date(currentTime.getTime() + milliseconds); } };
};

test("blocks execution before explicit approval", async () => {
  const { database, workflow } = makeWorkflow();
  const delegation = await workflow.create(owner, input, "create-before-approval");
  assert.equal(delegation.status, "awaiting_approval");
  await assert.rejects(() => workflow.execute(owner, delegation.id, false, "execute-too-early"), /Explicit approval/);
  database.close();
});

test("recovers, verifies mock actions, and issues a safe receipt", async () => {
  const { database, workflow } = makeWorkflow();
  const created = await workflow.create(owner, input, "create-recovery-case");
  workflow.approve(owner, created.id, jobs.map(job => job.id), "approve-recovery-case");
  const verified = await workflow.execute(owner, created.id, true, "execute-recovery-case");
  assert.equal(verified.status, "verified");
  assert.equal(verified.receipt?.proof.scope.productionSideEffects, false);
  assert.equal(verified.receipt?.proof.scope.realPiPayment, false);
  assert.equal(verified.receipt?.proof.recovery.retries, 1);
  assert.ok(verified.events.some(event => event.type === "recovery.retry"));
  assert.match(verified.receipt?.proofHash || "", /^[a-f0-9]{64}$/);
  database.close();
});

test("prevents duplicate submissions after an interrupted retry", async () => {
  const { database, workflow } = makeWorkflow();
  const created = await workflow.create(owner, input, "create-duplicate-case");
  workflow.approve(owner, created.id, [jobs[0].id], "approve-duplicate-case");
  database.prepare(`INSERT INTO mock_submissions (id, delegation_id, job_id, idempotency_key, status, cover_note, created_at, verified_at)
    VALUES ('existing-mock', ?, ?, 'existing-action-key', 'submitted', 'Existing safe draft', ?, NULL)`)
    .run(created.id, jobs[0].id, created.createdAt);
  const verified = await workflow.execute(owner, created.id, false, "execute-duplicate-case");
  assert.equal(verified.submissions.length, 1);
  assert.equal(verified.receipt?.proof.recovery.duplicatesPrevented, 1);
  database.close();
});

test("fails closed when independent verification cannot find every action", async () => {
  const { database, workflow } = makeWorkflow();
  const created = await workflow.create(owner, input, "create-failure-case");
  workflow.approve(owner, created.id, jobs.map(job => job.id), "approve-failure-case");
  database.exec(`CREATE TRIGGER block_backend BEFORE INSERT ON mock_submissions
    WHEN NEW.job_id = 'job-backend' BEGIN SELECT RAISE(IGNORE); END;`);
  await assert.rejects(() => workflow.execute(owner, created.id, false, "execute-failure-case"), /Independent verification failed/);
  assert.equal(workflow.get(created.id, owner).status, "failed");
  database.close();
});

test("isolates task history and actions by authenticated actor", async () => {
  const { database, workflow } = makeWorkflow();
  const created = await workflow.create(owner, input, "create-owner-case");
  assert.throws(() => workflow.get(created.id, "actor-attacker"), (error: unknown) => error instanceof AppError && error.status === 404);
  assert.deepEqual(workflow.list("actor-attacker"), []);
  assert.throws(() => workflow.approve("actor-attacker", created.id, [jobs[0].id], "attacker-approval"), /Delegation not found/);
  database.close();
});

test("replays duplicate API operations without duplicate records", async () => {
  const { database, workflow } = makeWorkflow();
  const first = await workflow.create(owner, input, "same-create-key");
  const replay = await workflow.create(owner, input, "same-create-key");
  assert.equal(replay.id, first.id);
  assert.equal(workflow.list(owner).length, 1);
  database.close();
});

test("recovers an expired execution lease after restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "smaj-delegation-"));
  const databasePath = join(directory, "history.sqlite");
  const firstDatabase = createDatabase(databasePath);
  const first = makeWorkflow(firstDatabase);
  const created = await first.workflow.create(owner, input, "create-restart-case");
  first.workflow.approve(owner, created.id, [jobs[0].id], "approve-restart-case");
  firstDatabase.prepare("UPDATE delegations SET status = 'executing', run_lease_until = ? WHERE id = ?")
    .run("2026-10-29T09:00:00.000Z", created.id);
  firstDatabase.close();

  const secondDatabase = createDatabase(databasePath);
  const second = makeWorkflow(secondDatabase);
  const recovered = second.workflow.list(owner)[0];
  assert.equal(recovered.status, "approved");
  assert.ok(recovered.events.some(event => event.type === "recovery.server_restart"));
  secondDatabase.close();
  rmSync(directory, { recursive: true, force: true });
});
