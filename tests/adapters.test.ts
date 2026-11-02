import assert from "node:assert/strict";
import test from "node:test";
import { SmajJobsReadAdapter } from "@/src/server/jobs-adapter";
import { SmajStoreReadAdapter } from "@/src/server/store-adapter";
import { SmajStreamReadAdapter } from "@/src/server/stream-adapter";
import { MetaJobsPlanner } from "@/src/server/meta-planner";
import { jobs } from "./fixtures";

test("Jobs adapter reads Hub's public listings endpoint and marks unbacked entries as samples", async () => {
  let method = "";
  const fetcher = async (_input: string | URL | Request, init?: RequestInit) => {
    method = init?.method || "";
    const url = new URL(String(_input));
    assert.equal(url.searchParams.has("catalog_read"), false);
    assert.equal(url.searchParams.get("pageSize"), "50");
    assert.equal(url.searchParams.has("search"), false);
    return new Response(JSON.stringify({ jobs: [{ employerId: "employer-42", id: "42", title: "Designer", skills: ["Figma"] }, { id: "react-engineer", title: "React Frontend Engineer", company: "Orbit Commerce", skills: ["React", "TypeScript"] }] }), { status: 200 });
  };
  const adapter = new SmajJobsReadAdapter(undefined, fetcher as typeof fetch);
  assert.equal(new URL(adapter.sourceUrl).pathname, "/jobs/jobs");
  const result = await adapter.listJobs();

  assert.equal(method, "GET");
  assert.equal(result[0].id, "42");
  assert.equal(result[0].title, "Designer");
  assert.deepEqual(result[0].skills, ["Figma"]);
  assert.equal(result[0].listingProvenance, "employer_backed");
  assert.equal(result[1].listingProvenance, "sample_unverified");
});

test("Jobs search token-matches real listing fields and reads later catalog pages", async () => {
  const requests: URL[] = [];
  const reactJob = { employerId: "employer-1", slug: "react-engineer", title: "React Frontend Engineer", company: "Orbit Labs", location: "Lagos", mode: "Hybrid", category: "Engineering", summary: "Build customer applications", skills: ["React", "TypeScript"] };
  const reactSample = { slug: "react-sample", title: "React Frontend Engineer", company: "Orbit Commerce", location: "Lagos, Nigeria", mode: "Hybrid", category: "Engineering", summary: "Build commerce tools", skills: ["React", "TypeScript"] };
  const remoteDeveloper = { employerId: "employer-2", slug: "remote-developer", title: "Software Developer", company: "Nova Systems", location: "Remote", mode: "Remote", category: "Engineering", summary: "Develop API services", skills: ["Python", "Node.js"] };
  const fetcher = async (input: string | URL | Request) => {
    const url = new URL(String(input)); requests.push(url);
    assert.equal(url.searchParams.has("search"), false, "full phrase must not be sent to literal Hub regex search");
    assert.equal(url.searchParams.has("catalog_read"), false);
    return url.searchParams.get("page") === "2"
      ? Response.json({ jobs: [remoteDeveloper], pagination: { page: 2, pageSize: 50, total: 51, pages: 2 } })
      : Response.json({ jobs: [reactJob, reactSample, { ...reactJob, slug: "demo", title: "Demo designer", employerId: "employer-demo", isDemo: true }], pagination: { page: 1, pageSize: 50, total: 51, pages: 2 } });
  };
  const adapter = new SmajJobsReadAdapter("https://smajpihub.onrender.com/jobs/jobs", fetcher as typeof fetch);
  const react = await adapter.listJobs({ search: "React Frontend Engineer job" });
  assert.deepEqual(react.map(job => job.id), ["react-engineer", "react-sample"]);
  assert.deepEqual(react.map(job => job.listingProvenance), ["employer_backed", "sample_unverified"]);
  assert.equal(react[0].company, "Orbit Labs"); assert.equal(react[0].location, "Lagos");
  assert.equal(requests.length, 2); assert.deepEqual(requests.map(url => url.searchParams.get("page")), ["1", "2"]);
  assert.deepEqual((await adapter.listJobs({ search: "Software Engineer" })).map(job => job.id), ["react-engineer", "react-sample", "remote-developer"]);
  assert.deepEqual((await adapter.listJobs({ search: "Developer" })).map(job => job.id), ["react-engineer", "react-sample", "remote-developer"]);
  assert.deepEqual((await adapter.listJobs({ search: "Remote Jobs" })).map(job => job.id), ["remote-developer"]);
});

test("Jobs does not report an empty match when pagination prevents a complete search", async () => {
  const fetcher = async () => Response.json({ jobs: [], pagination: { page: 1, pageSize: 50, total: 1050, pages: 21 } });
  const adapter = new SmajJobsReadAdapter("https://smajpihub.onrender.com/jobs/jobs", fetcher as typeof fetch);
  await assert.rejects(() => adapter.listJobs({ search: "React" }), /exceeds the safe search limit/);
});

test("Meta planner uses the account-confirmed configured model and rejects unknown job IDs", async () => {
  const previousKey = process.env.META_API_KEY;
  process.env.META_API_KEY = "test-only-key";
  const previousModel=process.env.META_MODEL; process.env.META_MODEL="test-account-model";
  let requestBody: Record<string, unknown> = {};
  const fetcher = async (_input: string | URL | Request, init?: RequestInit) => {
    if(String(_input).endsWith("/models"))return new Response(JSON.stringify({data:[{id:"test-account-model"}]}));
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      status: "completed",
      output: [{ content: [{ type: "output_text", text: JSON.stringify({
        summary: "Best matches",
        recommendations: [
          { jobId: jobs[0].id, score: 0.96, rationale: "Strong match", coverNote: "Hello" },
          { jobId: "invented-job", score: 100, rationale: "Invalid", coverNote: "No" },
        ],
      }) }] }],
    }), { status: 200 });
  };

  try {
    const result = await new MetaJobsPlanner(fetcher as typeof fetch).plan({
      candidateName: "Amina",
      skills: ["TypeScript"],
      goal: "Find suitable engineering roles for review.",
      maxApplications: 3,
    }, jobs);
    assert.equal(requestBody.model, "test-account-model");
    assert.equal(requestBody.store, false);
    assert.deepEqual(result.recommendations.map(item => item.jobId), [jobs[0].id]);
    assert.equal(result.recommendations[0].score, 96);
    const incomplete = (async input => String(input).endsWith("/models")
      ? Response.json({ data: [{ id: "test-account-model" }] })
      : Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ summary: "Incomplete provider result", recommendations: [{ jobId: jobs[0].id, score: 90 }] }) }] }] })) as typeof fetch;
    await assert.rejects(() => new MetaJobsPlanner(incomplete).plan({ candidateName: "Amina", skills: ["TypeScript"], goal: "Find engineering roles" }, jobs), /rationale and application draft/);
  } finally {
    if(previousModel===undefined)delete process.env.META_MODEL;else process.env.META_MODEL=previousModel;
    if (previousKey === undefined) delete process.env.META_API_KEY;
    else process.env.META_API_KEY = previousKey;
  }
});

test("Store adapter performs a GET and normalizes read-only products", async () => {
  let method = "";
  const fetcher = async (_input: string | URL | Request, init?: RequestInit) => {
    method = init?.method || "";
    return new Response(JSON.stringify({ products: [{ _id: "p1", title: "Solar Lamp", images: ["https://smajpihub.com/uploads/lamp.jpg"], category: "Energy", pricePi: 12, priceUsdt: 30, sellerName: "Ada Stores", location: "Lagos", country: "Nigeria", description: "Bright solar lamp" }] }), { status: 200 });
  };
  const adapter = new SmajStoreReadAdapter("https://smajpihub.onrender.com/marketplace/products", fetcher as typeof fetch);
  const result = await adapter.listProducts();
  assert.equal(method, "GET");
  assert.equal(result[0].id, "p1");
  assert.equal(result[0].title, "Solar Lamp");
  assert.equal(result[0].price, "12 Pi");
  assert.equal(result[0].imageUrl, "https://smajpihub.com/uploads/lamp.jpg");
  assert.equal(result[0].sellerName, "Ada Stores");
});

test("Stream adapter searches published creator content and preserves real playback details", async () => {
  let requested: URL | undefined;
  const adapter = new SmajStreamReadAdapter("https://smajpihub.com/stream/creator-content", (async input => {
    requested = new URL(String(input));
    return Response.json({ videos: [{ _id: "video-1", title: "Creator film", creatorName: "SMAJ creator", description: "Published video description", category: "Film", cloudflareUid: "cloudflare-1", posterUrl: "https://smajpihub.com/uploads/poster.jpg" }] });
  }) as typeof fetch);
  const [video] = await adapter.listContent({ search: "Creator film" });
  assert.equal(requested?.origin, "https://smajpihub.onrender.com");
  assert.equal(requested?.pathname, "/stream/creator-content");
  assert.equal(requested?.searchParams.get("search"), "Creator film");
  assert.equal(video.id, "video-1");
  assert.equal(video.title, "Creator film");
  assert.equal(video.creatorName, "SMAJ creator");
  assert.equal(video.imageUrl, "https://smajpihub.com/uploads/poster.jpg");
  assert.equal(video.description, "Published video description");
  assert.equal(video.url, "https://smajpihub.com/app/services/stream/watch/cloudflare-1");
});
