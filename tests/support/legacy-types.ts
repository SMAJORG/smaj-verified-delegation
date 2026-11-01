import type { JobsApiJob, JobsPlan } from "@/src/domain/types";

export type DelegationStatus =
  | "awaiting_approval"
  | "approved"
  | "executing"
  | "retrying"
  | "verifying"
  | "verified"
  | "failed";

export type DelegationEvent = {
  id: number;
  type: string;
  message: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type MockSubmission = {
  id: string;
  delegationId: string;
  jobId: string;
  idempotencyKey: string;
  status: "submitted" | "verified";
  coverNote: string;
  createdAt: string;
  verifiedAt: string | null;
};

export type ProofReceipt = {
  schemaVersion: "1.0";
  receiptId: string;
  delegationId: string;
  outcome: "verified";
  verifiedAt: string;
  planner: { provider: "Meta Model API" | "Hackathon simulation"; model: string };
  scope: {
    action: "mock_job_application";
    productionSideEffects: false;
    realPiPayment: false;
  };
  source: { system: "SMAJ PI HUB"; mode: "read_only" | "simulated"; endpoint: string };
  approval: { required: true; approvedAt: string };
  recovery: { transientFailures: number; retries: number; duplicatesPrevented: number };
  checks: Array<{ name: string; passed: boolean; evidence: string }>;
  actions: Array<{
    jobId: string;
    mockSubmissionId: string;
    status: "verified";
    idempotencyKey: string;
  }>;
};

export type DelegationView = {
  id: string;
  goal: string;
  candidateName: string;
  skills: string[];
  status: DelegationStatus;
  expiresAt: string;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  plan: JobsPlan;
  jobs: JobsApiJob[];
  selectedJobIds: string[];
  sourceUrl: string;
  events: DelegationEvent[];
  submissions: MockSubmission[];
  receipt: { proof: ProofReceipt; proofHash: string } | null;
};

