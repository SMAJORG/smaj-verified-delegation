import { createHash, randomUUID } from "node:crypto";
import type { CreateDelegationInput, DelegationEvent, DelegationStatus, DelegationView, JobsApiJob, JobsPlan, MockSubmission, ProofReceipt } from "@/src/domain/types";
import { type AppDatabase, getDatabase } from "@/src/server/database";
import { AppError } from "@/src/server/http";
import { SmajJobsReadAdapter } from "@/src/server/jobs-adapter";
import { MetaJobsPlanner, type JobsPlanner } from "@/src/server/meta-planner";

type WorkflowDependencies = {
  database?: AppDatabase;
  jobsAdapter?: Pick<SmajJobsReadAdapter, "listJobs" | "sourceUrl">;
  planner?: JobsPlanner;
  now?: () => Date;
  pause?: (milliseconds: number) => Promise<void>;
};

const activeStatuses: DelegationStatus[] = ["executing", "retrying", "verifying"];
const parse = <T>(value: unknown, fallback: T): T => {
  try { return typeof value === "string" ? JSON.parse(value) as T : fallback; } catch { return fallback; }
};
const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
const hash = (value: unknown) => createHash("sha256").update(stableStringify(value)).digest("hex");

export class DelegationWorkflow {
  private readonly database: AppDatabase;
  private readonly jobsAdapter: Pick<SmajJobsReadAdapter, "listJobs" | "sourceUrl">;
  private readonly planner: JobsPlanner;
  private readonly now: () => Date;
  private readonly pause: (milliseconds: number) => Promise<void>;

  constructor(dependencies: WorkflowDependencies = {}) {
    this.database = dependencies.database || getDatabase();
    this.jobsAdapter = dependencies.jobsAdapter || new SmajJobsReadAdapter();
    this.planner = dependencies.planner || new MetaJobsPlanner();
    this.now = dependencies.now || (() => new Date());
    this.pause = dependencies.pause || (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  }

  private timestamp() { return this.now().toISOString(); }
  private event(delegationId: string, type: string, message: string, payload: Record<string, unknown> = {}) {
    this.database.prepare("INSERT INTO delegation_events (delegation_id, type, message, payload_json, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(delegationId, type, message, JSON.stringify(payload), this.timestamp());
  }
  private setStatus(id: string, status: DelegationStatus, lease = false) {
    const now = this.timestamp();
    const leaseUntil = lease ? new Date(this.now().getTime() + 120_000).toISOString() : null;
    this.database.prepare("UPDATE delegations SET status = ?, run_started_at = CASE WHEN ? THEN COALESCE(run_started_at, ?) ELSE run_started_at END, run_lease_until = ?, updated_at = ? WHERE id = ?")
      .run(status, lease ? 1 : 0, now, leaseUntil, now, id);
  }
  private idempotent(ownerId: string, operation: string, requestKey: string) {
    return this.database.prepare("SELECT delegation_id FROM idempotency_records WHERE owner_id = ? AND operation = ? AND request_key = ?")
      .get(ownerId, operation, requestKey) as { delegation_id: string } | undefined;
  }
  private remember(ownerId: string, operation: string, requestKey: string, delegationId: string) {
    this.database.prepare("INSERT OR IGNORE INTO idempotency_records (owner_id, operation, request_key, delegation_id, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(ownerId, operation, requestKey, delegationId, this.timestamp());
  }

  async create(ownerId: string, input: CreateDelegationInput, requestKey: string) {
    const replay = this.idempotent(ownerId, "create", requestKey);
    if (replay) return this.get(replay.delegation_id, ownerId);
    const goal = String(input.goal || "").trim();
    const candidateName = String(input.candidateName || "").trim();
    const skills = Array.from(new Set((input.skills || []).map(skill => String(skill).trim()).filter(Boolean))).slice(0, 12);
    if (goal.length < 12) throw new AppError("invalid_goal", "Describe a specific delegated goal using at least 12 characters", 400);
    if (!candidateName) throw new AppError("invalid_candidate", "Candidate name is required", 400);
    if (skills.length === 0) throw new AppError("invalid_skills", "Provide at least one candidate skill", 400);

    const normalizedInput = { ...input, goal, candidateName, skills };
    const jobs = await this.jobsAdapter.listJobs();
    if (jobs.length === 0) throw new AppError("jobs_unavailable", "SMAJ Jobs did not return any opportunities", 503);
    const plan = await this.planner.plan(normalizedInput, jobs);
    const selectedJobIds = plan.recommendations.map(item => item.jobId);
    const id = randomUUID();
    const createdAt = this.timestamp();
    const expiresAt = new Date(this.now().getTime() + 86_400_000).toISOString();
    const insert = this.database.transaction(() => {
      this.database.prepare(`INSERT INTO delegations (
        id, owner_id, goal, candidate_name, skills_json, status, expires_at, approved_at,
        plan_json, jobs_json, selected_job_ids_json, source_url, create_key, run_started_at,
        run_lease_until, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'awaiting_approval', ?, NULL, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`)
        .run(id, ownerId, goal, candidateName, JSON.stringify(skills), expiresAt, JSON.stringify(plan), JSON.stringify(jobs), JSON.stringify(selectedJobIds), this.jobsAdapter.sourceUrl, requestKey, createdAt, createdAt);
      this.remember(ownerId, "create", requestKey, id);
      this.event(id, "contract.created", "A bounded Jobs delegation contract was created.", { expiresAt, maxApplications: selectedJobIds.length });
      const simulated = this.jobsAdapter.sourceUrl.startsWith("demo://");
      this.event(id, "jobs.read", simulated ? "Loaded fictional sample opportunities from the isolated demo workspace." : "Read current Jobs data through the production read-only adapter.", { sourceUrl: this.jobsAdapter.sourceUrl, jobsRead: jobs.length });
      this.event(id, "plan.generated", simulated ? "A simulated, reviewable application plan was prepared. No live AI request was made." : "Meta generated a reviewable job application plan.", { model: plan.model, recommendations: selectedJobIds.length, simulated });
    });
    insert();
    return this.get(id, ownerId);
  }

  list(ownerId: string) {
    this.recoverExpired(ownerId);
    const rows = this.database.prepare("SELECT id FROM delegations WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 50").all(ownerId) as Array<{ id: string }>;
    return rows.map(row => this.get(row.id, ownerId));
  }

  recoverExpired(ownerId: string) {
    const rows = this.database.prepare(`SELECT id FROM delegations WHERE owner_id = ? AND status IN ('executing','retrying','verifying') AND run_lease_until < ?`)
      .all(ownerId, this.timestamp()) as Array<{ id: string }>;
    for (const row of rows) {
      this.setStatus(row.id, "approved");
      this.event(row.id, "recovery.server_restart", "An interrupted run was safely restored for idempotent execution.", { productionSubmission: false });
    }
    return rows.length;
  }

  approve(ownerId: string, id: string, selectedJobIds: string[] | undefined, requestKey: string) {
    const operation = `approve:${id}`;
    const replay = this.idempotent(ownerId, operation, requestKey);
    if (replay) return this.get(id, ownerId);
    const current = this.get(id, ownerId);
    if (["approved", "verified"].includes(current.status)) {
      this.remember(ownerId, operation, requestKey, id);
      return current;
    }
    if (current.status !== "awaiting_approval") throw new AppError("invalid_state", `Delegation cannot be approved from status ${current.status}`, 409);
    if (new Date(current.expiresAt).getTime() <= this.now().getTime()) throw new AppError("contract_expired", "Delegation contract has expired", 409);
    const allowed = new Set(current.plan.recommendations.map(item => item.jobId));
    const selection = Array.from(new Set(selectedJobIds?.length ? selectedJobIds : current.selectedJobIds)).filter(jobId => allowed.has(jobId));
    if (selection.length === 0) throw new AppError("invalid_selection", "Approve at least one planned job application", 400);
    const approvedAt = this.timestamp();
    this.database.transaction(() => {
      this.database.prepare("UPDATE delegations SET status = 'approved', selected_job_ids_json = ?, approved_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?")
        .run(JSON.stringify(selection), approvedAt, approvedAt, id, ownerId);
      this.event(id, "approval.granted", "The user explicitly approved the selected mock applications.", { selectedJobIds: selection, productionSubmission: false });
      this.remember(ownerId, operation, requestKey, id);
    })();
    return this.get(id, ownerId);
  }

  async execute(ownerId: string, id: string, injectTransientFailure: boolean, requestKey: string) {
    const operation = `execute:${id}`;
    const replay = this.idempotent(ownerId, operation, requestKey);
    if (replay) return this.get(id, ownerId);
    const current = this.get(id, ownerId);
    if (current.status === "verified") {
      this.remember(ownerId, operation, requestKey, id);
      return current;
    }
    if (current.status !== "approved") throw new AppError("approval_required", "Explicit approval is required before execution", 409);
    this.setStatus(id, "executing", true);
    this.event(id, "execution.started", "Mock-only execution started. Production submissions remain disabled.");

    let injected = false;
    let duplicatesPrevented = 0;
    const recommendations = new Map(current.plan.recommendations.map(item => [item.jobId, item]));
    for (const [index, jobId] of current.selectedJobIds.entries()) {
      await this.pause(180);
      if (injectTransientFailure && index === 0) {
        injected = true;
        this.setStatus(id, "retrying", true);
        this.event(id, "recovery.transient_failure", "A controlled transient adapter failure was injected.", { jobId, retryable: true });
        await this.pause(180);
        this.event(id, "recovery.retry", "The workflow resumed with the same idempotency key.", { jobId, retry: 1 });
        this.setStatus(id, "executing", true);
      }
      const recommendation = recommendations.get(jobId);
      if (!recommendation) throw new AppError("invalid_plan", `Approved job ${jobId} is missing from the plan`, 409);
      const idempotencyKey = hash({ delegationId: id, jobId, action: "mock_job_application" });
      const submissionId = randomUUID();
      const result = this.database.prepare(`INSERT OR IGNORE INTO mock_submissions (
        id, delegation_id, job_id, idempotency_key, status, cover_note, created_at, verified_at
      ) VALUES (?, ?, ?, ?, 'submitted', ?, ?, NULL)`)
        .run(submissionId, id, jobId, idempotencyKey, recommendation.coverNote, this.timestamp());
      if (result.changes === 0) duplicatesPrevented += 1;
      else this.event(id, "mock_submission.created", "A mock application was recorded without contacting the production submission API.", { jobId, submissionId, idempotencyKey });
    }

    await this.pause(180);
    this.setStatus(id, "verifying", true);
    this.event(id, "verification.started", "The independent verifier is checking persisted action outcomes.");
    const verified = this.verify(ownerId, id, { injected, duplicatesPrevented });
    this.remember(ownerId, operation, requestKey, id);
    return verified;
  }

  private verify(ownerId: string, id: string, recovery: { injected: boolean; duplicatesPrevented: number }) {
    const current = this.get(id, ownerId);
    const submissions = this.listSubmissions(id);
    const expected = new Set(current.selectedJobIds);
    const actual = new Set(submissions.map(item => item.jobId));
    const allPresent = expected.size === actual.size && [...expected].every(jobId => actual.has(jobId));
    const unique = submissions.length === new Set(submissions.map(item => item.idempotencyKey)).size;
    if (!allPresent || !unique) {
      this.setStatus(id, "failed");
      this.event(id, "verification.failed", "Persisted outcomes did not satisfy the contract.", { allPresent, unique });
      throw new AppError("verification_failed", "Independent verification failed", 500);
    }

    const verifiedAt = this.timestamp();
    this.database.prepare("UPDATE mock_submissions SET status = 'verified', verified_at = ? WHERE delegation_id = ?").run(verifiedAt, id);
    const verifiedSubmissions = this.listSubmissions(id);
    const receipt: ProofReceipt = {
      schemaVersion: "1.0", receiptId: randomUUID(), delegationId: id, outcome: "verified", verifiedAt,
      planner: { provider: current.sourceUrl.startsWith("demo://") ? "Hackathon simulation" : "Meta Model API", model: "muse-spark-1.3" },
      scope: { action: "mock_job_application", productionSideEffects: false, realPiPayment: false },
      source: { system: "SMAJ PI HUB", mode: current.sourceUrl.startsWith("demo://") ? "simulated" : "read_only", endpoint: current.sourceUrl },
      approval: { required: true, approvedAt: current.approvedAt || "" },
      recovery: { transientFailures: recovery.injected ? 1 : 0, retries: recovery.injected ? 1 : 0, duplicatesPrevented: recovery.duplicatesPrevented },
      checks: [
        { name: "explicit_approval", passed: Boolean(current.approvedAt), evidence: current.approvedAt || "missing" },
        { name: "all_selected_actions_persisted", passed: allPresent, evidence: `${actual.size}/${expected.size} mock submissions found` },
        { name: "idempotency_keys_unique", passed: unique, evidence: `${verifiedSubmissions.length} unique action keys` },
        { name: "production_writes_disabled", passed: true, evidence: "Only the local mock_submissions table was mutated" },
      ],
      actions: verifiedSubmissions.map(item => ({ jobId: item.jobId, mockSubmissionId: item.id, status: "verified", idempotencyKey: item.idempotencyKey })),
    };
    const proofHash = hash(receipt);
    this.database.prepare("INSERT OR REPLACE INTO proof_receipts (id, delegation_id, receipt_json, proof_hash, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(receipt.receiptId, id, JSON.stringify(receipt), proofHash, verifiedAt);
    this.setStatus(id, "verified");
    this.event(id, "verification.passed", "All approved mock actions were independently verified.", { proofHash, checks: receipt.checks.length });
    this.event(id, "receipt.issued", "A tamper-evident proof receipt was issued.", { receiptId: receipt.receiptId, proofHash });
    return this.get(id, ownerId);
  }

  private listSubmissions(id: string): MockSubmission[] {
    return (this.database.prepare("SELECT * FROM mock_submissions WHERE delegation_id = ? ORDER BY created_at ASC").all(id) as any[]).map(row => ({
      id: row.id, delegationId: row.delegation_id, jobId: row.job_id, idempotencyKey: row.idempotency_key,
      status: row.status, coverNote: row.cover_note, createdAt: row.created_at, verifiedAt: row.verified_at,
    }));
  }

  get(id: string, ownerId: string): DelegationView {
    const row = this.database.prepare("SELECT * FROM delegations WHERE id = ? AND owner_id = ?").get(id, ownerId) as any;
    if (!row) throw new AppError("delegation_not_found", "Delegation not found", 404);
    const eventRows = this.database.prepare("SELECT * FROM delegation_events WHERE delegation_id = ? ORDER BY id ASC").all(id) as any[];
    const receiptRow = this.database.prepare("SELECT * FROM proof_receipts WHERE delegation_id = ?").get(id) as any;
    return {
      id: row.id, goal: row.goal, candidateName: row.candidate_name, skills: parse<string[]>(row.skills_json, []),
      status: row.status, expiresAt: row.expires_at, approvedAt: row.approved_at, createdAt: row.created_at, updatedAt: row.updated_at,
      plan: parse<JobsPlan>(row.plan_json, { summary: "", recommendations: [], model: "muse-spark-1.3" }),
      jobs: parse<JobsApiJob[]>(row.jobs_json, []), selectedJobIds: parse<string[]>(row.selected_job_ids_json, []), sourceUrl: row.source_url,
      events: eventRows.map((event): DelegationEvent => ({ id: event.id, type: event.type, message: event.message, payload: parse(event.payload_json, {}), createdAt: event.created_at })),
      submissions: this.listSubmissions(id),
      receipt: receiptRow ? { proof: parse<ProofReceipt>(receiptRow.receipt_json, {} as ProofReceipt), proofHash: receiptRow.proof_hash } : null,
    };
  }
}
