import type { JobsApiJob } from "@/src/domain/types";

export const DEFAULT_JOBS_URL = "https://smajpihub.onrender.com/jobs/jobs";

type JobsResponse = { jobs?: Array<Record<string, unknown>> };

const text = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);

export class SmajJobsReadAdapter {
  readonly sourceUrl: string;

  constructor(
    sourceUrl = process.env.SMAJ_JOBS_API_URL || DEFAULT_JOBS_URL,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.sourceUrl = sourceUrl;
  }

  async listJobs(): Promise<JobsApiJob[]> {
    const response = await this.fetcher(this.sourceUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`SMAJ Jobs read failed with HTTP ${response.status}`);
    const body = (await response.json()) as JobsResponse;
    if (!Array.isArray(body.jobs)) throw new Error("SMAJ Jobs returned an invalid payload");

    return body.jobs.map((job, index) => ({
      id: text(job.id, text(job.slug, `job-${index + 1}`)),
      title: text(job.title, "Untitled opportunity"),
      company: text(job.company, "SMAJ Jobs employer"),
      location: text(job.location, "Not specified"),
      type: text(job.type, "Opportunity"),
      mode: text(job.mode, "Not specified"),
      salary: text(job.salary, "Not specified"),
      category: text(job.category, "Other"),
      summary: text(job.summary, "No description provided."),
      skills: Array.isArray(job.skills) ? job.skills.map(skill => text(skill)).filter(Boolean) : [],
    }));
  }
}
