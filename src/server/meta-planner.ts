import type { CreateDelegationInput, JobRecommendation, JobsApiJob, JobsPlan } from "@/src/domain/types";

import { metaResponse } from "@/src/server/meta-client";

export interface JobsPlanner {
  plan(input: CreateDelegationInput, jobs: JobsApiJob[]): Promise<JobsPlan>;
}

const extractOutputText = (payload: any) => {
  const chunks: string[] = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === "output_text" && typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("").trim();
};

const parseJson = (value: string) => {
  const cleaned = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(cleaned) as { summary?: unknown; recommendations?: unknown };
};

const normalizeRecommendation = (value: any, allowedIds: Set<string>): JobRecommendation | null => {
  if (!value || typeof value.jobId !== "string" || !allowedIds.has(value.jobId)) return null;
  const rawScore = Number(value.score) || 0;
  const score = Math.round(Math.max(0, Math.min(100, rawScore > 0 && rawScore <= 1 ? rawScore * 100 : rawScore)));
  const rationale = String(value.rationale || "Strong alignment with the candidate profile.").slice(0, 600);
  const coverNote = String(value.coverNote || "I am interested in this opportunity and would welcome a conversation.").slice(0, 1800);
  return { jobId: value.jobId, score, rationale, coverNote };
};

export class MetaJobsPlanner implements JobsPlanner {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async plan(input: CreateDelegationInput, jobs: JobsApiJob[]): Promise<JobsPlan> {
    const maxApplications = Math.max(1, Math.min(3, input.maxApplications || 3));
    const prompt = [
      "You are the planning engine for SMAJ Verified Delegation.",
      "Select the strongest job matches without inventing qualifications or facts.",
      `Return only JSON with shape {\"summary\":string,\"recommendations\":[{\"jobId\":string,\"score\":number,\"rationale\":string,\"coverNote\":string}]}.`,
      `Return at most ${maxApplications} recommendations. Use only job IDs in the supplied data.`,
      `Goal: ${input.goal}`,
      `Candidate: ${input.candidateName}`,
      `Skills: ${input.skills.join(", ")}`,
      `Jobs: ${JSON.stringify(jobs)}`,
    ].join("\n");

    const { payload, model } = await metaResponse(prompt, 2200, this.fetcher);
    const parsed = parseJson(extractOutputText(payload));
    const allowedIds = new Set(jobs.map(job => job.id));
    const recommendations = (Array.isArray(parsed.recommendations) ? parsed.recommendations : [])
      .map(value => normalizeRecommendation(value, allowedIds))
      .filter((value): value is JobRecommendation => Boolean(value))
      .slice(0, maxApplications);
    if (recommendations.length === 0) throw new Error("Meta did not return any valid job recommendations");
    return { summary: String(parsed.summary || "Meta selected the strongest available matches.").slice(0, 800), recommendations, model };
  }
}
