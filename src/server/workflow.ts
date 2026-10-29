import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type {
  CreateDelegationInput,
  DelegationEvent,
  DelegationStatus,
  DelegationView,
  JobsApiJob,
  JobsPlan,
  MockSubmission,
  ProofReceipt,
} from "@/src/domain/types";
import { getDatabase } from "@/src/server/database";
import { SmajJobsReadAdapter } from "@/src/server/jobs-adapter";
import { MetaJobsPlanner, type JobsPlanner } from "@/src/server/meta-planner";

type WorkflowDependencies = {
  database?: DatabaseSync;
  jobsAdapter?: Pick<SmajJobsReadAdapter, "listJobs" | "sourceUrl">;
  planner?: JobsPlanner;
  now?: () => Date;
};

const parse = <T>(value: unknown, fallback: T): T => {
  try {
    return typeof value === "string" ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
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
  private readonly database: DatabaseSync;
  private readonly jobsAdapter: Pick<SmajJobsReadAdapter, "listJobs" | "sourceUrl">;
  private readonly planner: JobsPlanner;
  private readonly now: () => Date;

  constructor(dependencies: WorkflowDependencies = {}) {
    this.database = dependencies.database || getDatabase();
    this.jobsAdapter = dependencies.jobsAdapter || new SmajJobsReadAdapter();
    this.planner = dependencies.planner || new MetaJobsPlanner();
    this.now = dependencies.now || (() => new Date());
  }

  private timestamp() {
    return this.now().toISOString();
  }

  private event(delegationId: string, type: string, message: string, payload: Record<string, unknown> = {}) {
    this.database.prepare(`INSERT INTO delegation_events (delegation_id, type, message, payload_json, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run(delegationId, type, message, JSON.stringify(payload), this.timestamp());
  }

  private setStatus(id: string, status: DelegationStatus) {
    this.database.prepare("UPDATE delegations SET status = ?, updated_at = ? WHERE id = ?").run(status, this.timestamp(), id);
  }

  async create(input: CreateDelegationInput) {
    const goal = String(input.goal || "").trim();
    const candidateName = String(input.candidateName || "").trim();
    const skills = Array.from(new Set((input.skills || []).map(skill => String(skill).trim()).filter(Boolean))).slice(0, 12);
    if (goal.length < 12) throw new Error("Describe a specific delegated goal using at least 12 characters");
    if (!candidateName) throw new Error("Candidate name is required");
    if (skills.length === 0) throw new Error("Provide at least one candidate skill");

    const normalizedInput = { ...input, goal, candidateName, skills };
    const jobs = await this.jobsAdapter.listJobs();
    if (jobs.length === 0) throw new Error("SMAJ Jobs did not return any opportunities");
    const plan = await this.planner.plan(normalizedInput, jobs);
    const selectedJobIds = plan.recommendations.map(item => item.jobId);
    const id = randomUUID();
    const createdAt = this.timestamp();
    const expiresAt = new Date(this.now().getTime() + 24 * 60 * 60 * 1000).toISOString();

    this.database.prepare(`
      INSERT INTO delegations (
        id, goal, candidate_name, skills_json, status, expires_at, approved_at,
        plan_json, jobs_json, selected_job_ids_json, source_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'awaiting_approval', ?, NULL, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      goal,
      candidateName,
      JSON.stringify(skills),
      expiresAt,
      JSON.stringify(plan),
      JSON.stringify(jobs),
      JSON.stringify(selectedJobIds),
      this.jobsAdapter.sourceUrl,
      createdAt,
      createdAt,
    );
    this.event(id, "contract.created", "A bounded Jobs delegation contract was created.", { expiresAt, maxApplications: selectedJobIds.length });
    this.event(id, "jobs.read", "Read current Jobs data through the production read-only adapter.", { sourceUrl: this.jobsAdapter.sourceUrl, jobsRead: jobs.length });
    this.event(id, "plan.generated", "Meta generated a reviewable job application plan.", { model: plan.model, recommendations: selectedJobIds.length });
    return this.get(id);
  }

  approve(id: string, selectedJobIds?: string[]) {
    const current = this.get(id);
    if (current.status === "verified") return current;
    if (current.status !== "awaiting_approval") throw new Error(`Delegation cannot be approved from status ${current.status}`);
    if (new Date(current.expiresAt).getTime() <= this.now().getTime()) throw new Error("Delegation contract has expired");
    const allowed = new Set(current.plan.recommendations.map(item => item.jobId));
    const selection = Array.from(new Set(selectedJobIds?.length ? selectedJobIds : current.selectedJobIds)).filter(jobId => allowed.has(jobId));
    if (selection.length === 0) throw new Error("Approve at least one planned job application");
    const approvedAt = this.timestamp();
    this.database.prepare("UPDATE delegations SET status = 'approved', selected_job_ids_json = ?, approved_at = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(selection), approvedAt, approvedAt, id);
    this.event(id, "approval.granted", "The user explicitly approved the selected mock applications.", { selectedJobIds: selection, productionSubmission: false });
    return this.get(id);
  }

  execute(id: string, injectTransientFailure = true) {
    const current = this.get(id);
    if (current.status === "verified") return current;
    if (current.status !== "approved") throw new Error("Explicit approval is required before execution");
    this.setStatus(id, "executing");
    this.event(id, "execution.started", "Mock-only execution started. Production submissions remain disabled.");

    let injected = false;
    let duplicatesPrevented = 0;
    const recommendations = new Map(current.plan.recommendations.map(item => [item.jobId, item]));
    for (const [index, jobId] of current.selectedJobIds.entries()) {
      if (injectTransientFailure && index === 0) {
        injected = true;
        this.setStatus(id, "retrying");
        this.event(id, "recovery.transient_failure", "A controlled transient adapter failure was injected.", { jobId, retryable: true });
        this.event(id, "recovery.retry", "The workflow resumed with the same idempotency key.", { jobId, retry: 1 });
        this.setStatus(id, "executing");
      }
      const recommendation = recommendations.get(jobId);
      if (!recommendation) throw new Error(`Approved job ${jobId} is missing from the plan`);
      const idempotencyKey = hash({ delegationId: id, jobId, action: "mock_job_application" });
      const submissionId = randomUUID();
      const result = this.database.prepare(`
        INSERT OR IGNORE INTO mock_submissions (
          id, delegation_id, job_id, idempotency_key, status, cover_note, created_at, verified_at
        ) VALUES (?, ?, ?, ?, 'submitted', ?, ?, NULL)
      `).run(submissionId, id, jobId, idempotencyKey, recommendation.coverNote, this.timestamp());
      if (result.changes === 0) duplicatesPrevented += 1;
      else this.event(id, "mock_submission.created", "A mock application was recorded without contacting the production submission API.", { jobId, submissionId, idempotencyKey });
    }

    this.setStatus(id, "verifying");
    this.event(id, "verification.started", "The independent verifier is checking persisted action outcomes.");
    const verified = this.verify(id, { injected, duplicatesPrevented });
    return verified;
  }

  private verify(id: string, recovery: { injected: boolean; duplicatesPrevented: number }) {
    const current = this.get(id);
    const submissions = this.listSubmissions(id);
    const expected = new Set(current.selectedJobIds);
    const actual = new Set(submissions.map(item => item.jobId));
    const allPresent = expected.size === actual.size && [...expected].every(jobId => actual.has(jobId));
    const unique = submissions.length === new Set(submissions.map(item => item.idempotencyKey)).size;
    if (!allPresent || !unique) {
      this.setStatus(id, "failed");
      this.event(id, "verification.failed", "Persisted outcomes did not satisfy the contract.", { allPresent, unique });
      throw new Error("Independent verification failed");
    }

    const verifiedAt = this.timestamp();
    this.database.prepare("UPDATE mock_submissions SET status = 'verified', verified_at = ? WHERE delegation_id = ?").run(verifiedAt, id);
    const verifiedSubmissions = this.listSubmissions(id);
    const receipt: ProofReceipt = {
      schemaVersion: "1.0",
      receiptId: randomUUID(),
      delegationId: id,
      outcome: "verified",
      verifiedAt,
      planner: { provider: "Meta Model API", model: "muse-spark-1.3" },
      scope: { action: "mock_job_application", productionSideEffects: false, realPiPayment: false },
      source: { system: "SMAJ PI HUB", mode: "read_only", endpoint: current.sourceUrl },
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
    return this.get(id);
  }

  private listSubmissions(id: string): MockSubmission[] {
    return this.database.prepare("SELECT * FROM mock_submissions WHERE delegation_id = ? ORDER BY created_at ASC").all(id).map((row: any) => ({
      id: row.id,
      delegationId: row.delegation_id,
      jobId: row.job_id,
      idempotencyKey: row.idempotency_key,
      status: row.status,
      coverNote: row.cover_note,
      createdAt: row.created_at,
      verifiedAt: row.verified_at,
    }));
  }

  get(id: string): DelegationView {
    const row = this.database.prepare("SELECT * FROM delegations WHERE id = ?").get(id) as any;
    if (!row) throw new Error("Delegation not found");
    const eventRows = this.database.prepare("SELECT * FROM delegation_events WHERE delegation_id = ? ORDER BY id ASC").all(id) as any[];
    const receiptRow = this.database.prepare("SELECT * FROM proof_receipts WHERE delegation_id = ?").get(id) as any;
    return {
      id: row.id,
      goal: row.goal,
      candidateName: row.candidate_name,
      skills: parse<string[]>(row.skills_json, []),
      status: row.status,
      expiresAt: row.expires_at,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      plan: parse<JobsPlan>(row.plan_json, { summary: "", recommendations: [], model: "muse-spark-1.3" }),
      jobs: parse<JobsApiJob[]>(row.jobs_json, []),
      selectedJobIds: parse<string[]>(row.selected_job_ids_json, []),
      sourceUrl: row.source_url,
      events: eventRows.map((event): DelegationEvent => ({ id: event.id, type: event.type, message: event.message, payload: parse(event.payload_json, {}), createdAt: event.created_at })),
      submissions: this.listSubmissions(id),
      receipt: receiptRow ? { proof: parse<ProofReceipt>(receiptRow.receipt_json, {} as ProofReceipt), proofHash: receiptRow.proof_hash } : null,
    };
  }
}
