import assert from "node:assert/strict";
import test from "node:test";
import { SmajJobsReadAdapter } from "@/src/server/jobs-adapter";
import { META_MODEL, MetaJobsPlanner } from "@/src/server/meta-planner";
import { jobs } from "./fixtures";

test("Jobs adapter performs a GET and normalizes read-only data", async () => {
  let method = "";
  const fetcher = async (_input: string | URL | Request, init?: RequestInit) => {
    method = init?.method || "";
    return new Response(JSON.stringify({ jobs: [{ id: "42", title: "Designer", skills: ["Figma"] }] }), { status: 200 });
  };
  const adapter = new SmajJobsReadAdapter("https://smaj.example/jobs", fetcher as typeof fetch);
  const result = await adapter.listJobs();

  assert.equal(method, "GET");
  assert.equal(result[0].id, "42");
  assert.equal(result[0].title, "Designer");
  assert.deepEqual(result[0].skills, ["Figma"]);
});

test("Meta planner uses muse-spark-1.3 and rejects unknown job IDs", async () => {
  const previousKey = process.env.META_API_KEY;
  process.env.META_API_KEY = "test-only-key";
  let requestBody: Record<string, unknown> = {};
  const fetcher = async (_input: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      status: "completed",
      output: [{ content: [{ type: "output_text", text: JSON.stringify({
        summary: "Best matches",
        recommendations: [
          { jobId: jobs[0].id, score: 96, rationale: "Strong match", coverNote: "Hello" },
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
    assert.equal(requestBody.model, META_MODEL);
    assert.equal(requestBody.store, false);
    assert.deepEqual(result.recommendations.map(item => item.jobId), [jobs[0].id]);
  } finally {
    if (previousKey === undefined) delete process.env.META_API_KEY;
    else process.env.META_API_KEY = previousKey;
  }
});
