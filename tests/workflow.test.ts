import assert from "node:assert/strict";
import test from "node:test";
import { createDatabase } from "@/src/server/database";
import { DelegationWorkflow } from "@/src/server/workflow";
import { jobs, plan } from "./fixtures";

const makeWorkflow = () => {
  const database = createDatabase(":memory:");
  const workflow = new DelegationWorkflow({
    database,
    jobsAdapter: {
      sourceUrl: "https://smaj.example/jobs/jobs",
      listJobs: async () => jobs,
    },
    planner: { plan: async () => plan },
    now: () => new Date("2026-10-29T10:00:00.000Z"),
  });
  return { database, workflow };
};

const input = {
  candidateName: "Amina Okafor",
  skills: ["TypeScript", "React", "Node.js"],
  goal: "Prepare the strongest matching job applications for my approval.",
};

test("creates a bounded contract and blocks execution before approval", async () => {
  const { database, workflow } = makeWorkflow();
  const delegation = await workflow.create(input);

  assert.equal(delegation.status, "awaiting_approval");
  assert.equal(delegation.plan.model, "muse-spark-1.3");
  assert.equal(delegation.jobs.length, 2);
  assert.throws(() => workflow.execute(delegation.id), /Explicit approval/);
  database.close();
});

test("recovers, verifies persisted mock actions, and issues a safe proof receipt", async () => {
  const { database, workflow } = makeWorkflow();
  const created = await workflow.create(input);
  const approved = workflow.approve(created.id, ["job-frontend", "job-backend"]);
  const verified = workflow.execute(approved.id, true);

  assert.equal(verified.status, "verified");
  assert.equal(verified.submissions.length, 2);
  assert.ok(verified.submissions.every(submission => submission.status === "verified"));
  assert.equal(verified.receipt?.proof.scope.productionSideEffects, false);
  assert.equal(verified.receipt?.proof.scope.realPiPayment, false);
  assert.equal(verified.receipt?.proof.recovery.transientFailures, 1);
  assert.equal(verified.receipt?.proof.recovery.retries, 1);
  assert.equal(verified.receipt?.proof.checks.every(check => check.passed), true);
  assert.match(verified.receipt?.proofHash || "", /^[a-f0-9]{64}$/);
  assert.ok(verified.events.some(event => event.type === "recovery.retry"));
  assert.ok(verified.events.some(event => event.type === "receipt.issued"));
  database.close();
});

test("verified execution is idempotent", async () => {
  const { database, workflow } = makeWorkflow();
  const created = await workflow.create(input);
  workflow.approve(created.id, ["job-frontend"]);
  const first = workflow.execute(created.id, false);
  const second = workflow.execute(created.id, false);

  assert.equal(second.receipt?.proofHash, first.receipt?.proofHash);
  assert.equal(second.submissions.length, 1);
  database.close();
});
