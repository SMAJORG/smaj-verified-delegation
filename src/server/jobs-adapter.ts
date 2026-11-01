import type { CatalogQuery } from "@/src/domain/services";
import { catalogJson, catalogRows } from "@/src/server/catalog-http";
import { AppError } from "@/src/server/http";
import type { JobsApiJob } from "@/src/domain/types";

export const DEFAULT_JOBS_URL = "https://smajpihub.com/services/jobs/search";

const text = (value: unknown, fallback = "") => (typeof value === "string" ? value.slice(0, 600) : fallback);
const PAGE_SIZE = 50;
const MAX_PAGES = 20;
const MAX_MATCHES = 60;
const stopWords = new Set(["a", "an", "and", "available", "find", "for", "job", "jobs", "me", "opportunity", "opportunities", "please", "role", "roles", "search", "the", "to", "work", "working"]);

const normalizeWord = (word: string) => {
  const value = word.toLocaleLowerCase("en-US");
  if (["engineer", "engineering", "engineers"].includes(value)) return "engineer";
  if (["developer", "developers", "develop", "development"].includes(value)) return "develop";
  if (["software"].includes(value)) return "software";
  if (["frontend", "front-end"].includes(value)) return "frontend";
  if (["backend", "back-end"].includes(value)) return "backend";
  return value.replace(/[^a-z0-9+#.]/g, "");
};

const termMatches = (term: string, record: Record<string, unknown>) => {
  const company = typeof record.company === "string" ? record.company : "";
  const skills = Array.isArray(record.skills) ? record.skills.filter((skill): skill is string => typeof skill === "string").join(" ") : "";
  const fields = [record.title, record.summary, record.description, record.category, company, record.location, record.mode, record.type, skills]
    .filter((field): field is string => typeof field === "string").join(" ").toLocaleLowerCase("en-US");
  const words = new Set(fields.split(/[^a-z0-9+#.]+/).filter(Boolean).map(normalizeWord));
  const candidates = term === "software" ? ["software", "engineer", "develop", "programmer", "engineering"]
    : term === "develop" ? ["develop", "engineer", "engineering", "programmer"]
      : [term];
  return candidates.some(candidate => words.has(candidate) || (candidate.length >= 4 && [...words].some(word => word.startsWith(candidate))));
};

const relevance = (record: Record<string, unknown>, query: CatalogQuery) => {
  const queryText = [query.search, query.category].filter(Boolean).join(" ");
  const terms = [...new Set(queryText.split(/[^a-z0-9+#.]+/i).map(normalizeWord).filter(term => term && !stopWords.has(term)))];
  if (!terms.length) return 1;
  const matched = terms.filter(term => termMatches(term, record)).length;
  return matched >= Math.ceil(terms.length / 2) ? matched / terms.length : 0;
};

export class SmajJobsReadAdapter {
  readonly sourceUrl: string;

  constructor(
    sourceUrl = process.env.SMAJ_JOBS_API_URL || DEFAULT_JOBS_URL,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    const url = new URL(sourceUrl); url.searchParams.delete("catalog_read"); url.searchParams.set("pageSize", String(PAGE_SIZE));
    this.sourceUrl = url.toString();
  }

  async listJobs(query: CatalogQuery = {}): Promise<JobsApiJob[]> {
    // Hub search treats the supplied phrase as a literal substring. Read the
    // bounded public catalog instead, then match terms over the real listing
    // fields locally so trailing words like "job" do not hide a title match.
    const pageUrl = new URL(this.sourceUrl);
    pageUrl.search = "";
    pageUrl.searchParams.set("catalog_read", "true");
    pageUrl.searchParams.set("pageSize", String(PAGE_SIZE));
    const allRows: Record<string, unknown>[] = [];
    let pages = 1;
    for (let page = 1; page <= MAX_PAGES; page++) {
      pageUrl.searchParams.set("page", String(page));
      const body = await catalogJson(pageUrl.toString(), this.fetcher);
      allRows.push(...catalogRows(body, "jobs"));
      const pagination = body.pagination && typeof body.pagination === "object" ? body.pagination as Record<string, unknown> : {};
      const reportedPages = Number(pagination.pages);
      const total = Number(pagination.total);
      const pageSize = Number(pagination.pageSize) || PAGE_SIZE;
      pages = Number.isFinite(reportedPages) && reportedPages >= 0
        ? Math.max(1, Math.ceil(reportedPages))
        : Number.isFinite(total) && total >= 0 ? Math.max(1, Math.ceil(total / pageSize)) : page;
      if (page >= pages) break;
    }
    if (pages > MAX_PAGES) throw new AppError("catalog_too_large", "The published Jobs catalog exceeds the safe search limit. Narrow the search and try again.", 503);

    const uniqueRows = new Map<string, Record<string, unknown>>();
    for (const job of allRows) {
      const id = text(job.slug, text(job.id, text(job._id)));
      if (id && !uniqueRows.has(id)) uniqueRows.set(id, job);
    }

    return [...uniqueRows.values()].filter(job => job.isDemo !== true)
      .map(job => ({ job, score: relevance(job, query) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_MATCHES)
      .map(({job}) => ({
      id: text(job.slug, text(job.id, text(job._id))),
      title: text(job.title, "Untitled opportunity"),
      company: text(job.company, "SMAJ Jobs employer"),
      location: text(job.location, "Not specified"),
      type: text(job.type, "Opportunity"),
      mode: text(job.mode, "Not specified"),
      salary: text(job.salary, "Not specified"),
      category: text(job.category, "Other"),
      summary: text(job.summary, "No description provided."),
      skills: Array.isArray(job.skills) ? job.skills.slice(0, 30).map(skill => text(skill)).filter(Boolean) : [],
      listingProvenance: typeof job.employerId === "string" && job.employerId.trim() && job.isDemo !== true ? "employer_backed" as const : "sample_unverified" as const,
      }));
  }
}
