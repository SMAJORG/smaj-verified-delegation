import type { CreateDelegationInput, JobsApiJob, JobsPlan } from "@/src/domain/types";
import { requireActorSession } from "@/src/server/auth";
import { getDatabase } from "@/src/server/database";
import { getDemoDatabase } from "@/src/server/demo-sessions";
import { DelegationWorkflow } from "@/src/server/workflow";
import { MetaJobsPlanner } from "@/src/server/meta-planner";

export const demoJobs: JobsApiJob[] = [
  { id: "sample-frontend", title: "Frontend Engineer", company: "Lagos Digital Studio (Sample)", location: "Lagos", type: "Full-time", mode: "Hybrid", salary: "Competitive", category: "Technology", summary: "Build accessible customer experiences with React and TypeScript.", skills: ["React", "TypeScript"] },
  { id: "sample-platform", title: "Platform Engineer", company: "Atlas Commerce (Sample)", location: "Remote", type: "Contract", mode: "Remote", salary: "Competitive", category: "Technology", summary: "Develop reliable Node.js services and REST APIs.", skills: ["Node.js", "REST APIs"] },
];
const samplePlan = async (input: CreateDelegationInput): Promise<JobsPlan> => ({
  summary: "Simulated plan using fictional opportunities. Review each draft before approving local mock applications.",
  model: "sample-data",
  recommendations: demoJobs.slice(0, input.maxApplications || 2).map((job, index) => ({ jobId: job.id, score: 96 - index * 5, rationale: `${job.title} aligns with the supplied technical profile. Sample match for demonstration.`, coverNote: `I am interested in the ${job.title} role and would welcome a discussion about my relevant experience.` })),
});
export const demoWorkflow = (seed = false) => new DelegationWorkflow({
  database: getDemoDatabase(), jobsAdapter: { sourceUrl: "demo://fictional-opportunities", listJobs: async () => demoJobs }, planner: seed ? { plan: samplePlan } : new MetaJobsPlanner(),
});
export const workspaceDatabase = (request: Request) => requireActorSession(request).sandbox ? getDemoDatabase() : getDatabase();
export const workspaceWorkflow = (request: Request) => requireActorSession(request).sandbox ? demoWorkflow() : new DelegationWorkflow();
export const seedDemoWorkspace = async (actorId: string) => {
  const workflow = demoWorkflow(true);
  const base = { candidateName: "Amina Okafor (Sample)", skills: ["React", "TypeScript", "Node.js", "REST APIs"], maxApplications: 2 };
  const verified = await workflow.create(actorId, { ...base, goal: "Find remote engineering roles and verify approved sample applications" }, "seed-verified");
  workflow.approve(actorId, verified.id, undefined, "seed-approve-verified");
  await workflow.execute(actorId, verified.id, true, "seed-execute-verified");
  const approved = await workflow.create(actorId, { ...base, goal: "Prepare platform engineering applications for approved sample roles" }, "seed-approved");
  workflow.approve(actorId, approved.id, undefined, "seed-approve");
  await workflow.create(actorId, { ...base, goal: "Review frontend opportunities and approve suitable application drafts" }, "seed-pending");
};
