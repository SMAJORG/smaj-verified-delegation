import type { CreateDelegationInput, JobsApiJob, JobsPlan } from "@/src/domain/types";
import type { ServiceRoutePlan } from "@/src/domain/services";
import { requireActorSession } from "@/src/server/auth";
import { getDatabase } from "@/src/server/database";
import { getDemoDatabase } from "@/src/server/demo-sessions";
import { DelegationWorkflow } from "@/src/server/workflow";
import { AppError } from "@/src/server/http";

export const demoJobs: JobsApiJob[] = [
  { id: "sample-frontend", title: "Frontend Engineer", company: "Lagos Digital Studio (Sample)", location: "Lagos", type: "Full-time", mode: "Hybrid", salary: "Competitive", category: "Technology", summary: "Build accessible customer experiences with React and TypeScript.", skills: ["React", "TypeScript"] },
  { id: "sample-platform", title: "Platform Engineer", company: "Atlas Commerce (Sample)", location: "Remote", type: "Contract", mode: "Remote", salary: "Competitive", category: "Technology", summary: "Develop reliable Node.js services and REST APIs.", skills: ["Node.js", "REST APIs"] },
];
const samplePlan = async (input: CreateDelegationInput): Promise<JobsPlan> => ({
  summary: "Simulated plan using fictional opportunities. Review each draft before approving local mock applications.",
  model: "muse-spark-1.3",
  recommendations: demoJobs.slice(0, input.maxApplications || 2).map((job, index) => ({ jobId: job.id, score: 96 - index * 5, rationale: `${job.title} aligns with the supplied technical profile. Sample match for demonstration.`, coverNote: `I am interested in the ${job.title} role and would welcome a discussion about my relevant experience.` })),
});
export const demoWorkflow = () => new DelegationWorkflow({
  database: getDemoDatabase(), jobsAdapter: { sourceUrl: "demo://fictional-opportunities", listJobs: async () => demoJobs }, planner: { plan: samplePlan },
});
export const workspaceDatabase = (request: Request) => requireActorSession(request).sandbox ? getDemoDatabase() : getDatabase();
export const workspaceWorkflow = (request: Request) => requireActorSession(request).sandbox ? demoWorkflow() : new DelegationWorkflow();
export const seedDemoWorkspace = async (actorId: string) => {
  const workflow = demoWorkflow();
  const base = { candidateName: "Amina Okafor (Sample)", skills: ["React", "TypeScript", "Node.js", "REST APIs"], maxApplications: 2 };
  const verified = await workflow.create(actorId, { ...base, goal: "Find remote engineering roles and verify approved sample applications" }, "seed-verified");
  workflow.approve(actorId, verified.id, undefined, "seed-approve-verified");
  await workflow.execute(actorId, verified.id, true, "seed-execute-verified");
  const approved = await workflow.create(actorId, { ...base, goal: "Prepare platform engineering applications for approved sample roles" }, "seed-approved");
  workflow.approve(actorId, approved.id, undefined, "seed-approve");
  await workflow.create(actorId, { ...base, goal: "Review frontend opportunities and approve suitable application drafts" }, "seed-pending");
};
export const demoTaskPlan = (task: string): ServiceRoutePlan => {
  if (task.trim().length < 12 || task.length > 2000) throw new AppError("invalid_task", "Describe a task using 12 to 2,000 characters", 400);
  return {
    summary: "Simulated walkthrough: discover fictional jobs, review a bounded plan, approve mock applications, and verify the results.",
    model: "muse-spark-1.3", services: ["jobs"],
    steps: [{ id: "demo-match", serviceId: "jobs", title: "Prepare sample job applications", description: "Use fictional roles to explore the approval and verification workflow.", capability: "mock applications", status: "approval_required", approvalRequired: true, reason: "Demo actions only write to your isolated sample workspace." }],
    warnings: ["Demo planning is simulated. No live AI request, payment, purchase, booking, or production submission is made."],
  };
};
