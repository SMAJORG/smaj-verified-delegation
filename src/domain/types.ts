export type DelegationStatus =
  | "awaiting_approval"
  | "approved"
  | "executing"
  | "retrying"
  | "verifying"
  | "verified"
  | "failed";

export type JobsApiJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  mode: string;
  salary: string;
  category: string;
  summary: string;
  skills: string[];
};

export type JobRecommendation = {
  jobId: string;
  score: number;
  rationale: string;
  coverNote: string;
};

export type JobsPlan = {
  summary: string;
  recommendations: JobRecommendation[];
  model: string;
};

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
  planner: { provider: "Meta Model API"; model: "muse-spark-1.3" };
  scope: {
    action: "mock_job_application";
    productionSideEffects: false;
    realPiPayment: false;
  };
  source: { system: "SMAJ PI HUB"; mode: "read_only"; endpoint: string };
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

export type CreateDelegationInput = {
  goal: string;
  candidateName: string;
  skills: string[];
  maxApplications?: number;
};
