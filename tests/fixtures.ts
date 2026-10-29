import type { JobsApiJob, JobsPlan } from "@/src/domain/types";

export const jobs: JobsApiJob[] = [
  {
    id: "job-frontend",
    title: "Frontend Engineer",
    company: "SMAJ Talent Partner",
    location: "Lagos",
    type: "Full-time",
    mode: "Hybrid",
    salary: "Competitive",
    category: "Technology",
    summary: "Build accessible web experiences.",
    skills: ["TypeScript", "React"],
  },
  {
    id: "job-backend",
    title: "Backend Engineer",
    company: "SMAJ Talent Partner",
    location: "Remote",
    type: "Contract",
    mode: "Remote",
    salary: "Competitive",
    category: "Technology",
    summary: "Build reliable APIs.",
    skills: ["Node.js", "REST APIs"],
  },
];

export const plan: JobsPlan = {
  summary: "Two opportunities align with the supplied, verified skills.",
  model: "muse-spark-1.3",
  recommendations: jobs.map((job, index) => ({
    jobId: job.id,
    score: 94 - index * 4,
    rationale: `${job.title} matches the candidate's supplied skills.`,
    coverNote: `I would like to be considered for the ${job.title} role.`,
  })),
};
