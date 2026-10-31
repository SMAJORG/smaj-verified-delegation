import { catalogJson, catalogRows } from "@/src/server/catalog-http";
import type { JobsApiJob } from "@/src/domain/types";

export const DEFAULT_JOBS_URL = "https://smajpihub.onrender.com/jobs/jobs";

const text = (value: unknown, fallback = "") => (typeof value === "string" ? value.slice(0, 600) : fallback);

export class SmajJobsReadAdapter {
  readonly sourceUrl: string;

  constructor(
    sourceUrl = process.env.SMAJ_JOBS_API_URL || DEFAULT_JOBS_URL,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    const url = new URL(sourceUrl); url.searchParams.set("catalog_read", "true");
    this.sourceUrl = url.toString();
  }

  async listJobs(): Promise<JobsApiJob[]> {
    const rows = catalogRows(await catalogJson(this.sourceUrl, this.fetcher), "jobs");

    return rows.map(job => ({
      id: text(job.id, text(job.slug, text(job._id))),
      title: text(job.title, "Untitled opportunity"),
      company: text(job.company, "SMAJ Jobs employer"),
      location: text(job.location, "Not specified"),
      type: text(job.type, "Opportunity"),
      mode: text(job.mode, "Not specified"),
      salary: text(job.salary, "Not specified"),
      category: text(job.category, "Other"),
      summary: text(job.summary, "No description provided."),
      skills: Array.isArray(job.skills) ? job.skills.slice(0, 30).map(skill => text(skill)).filter(Boolean) : [],
    }));
  }
}
