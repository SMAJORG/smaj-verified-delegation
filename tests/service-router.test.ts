import assert from "node:assert/strict";
import test from "node:test";
import { SERVICE_IDS, SMAJ_SERVICES } from "@/src/domain/services";
import { META_MODEL } from "@/src/server/meta-planner";
import { MetaServiceRouter } from "@/src/server/service-router";

test("service catalog contains the official 15 unique SMAJ services", () => {
  assert.equal(SMAJ_SERVICES.length, 15);
  assert.equal(SERVICE_IDS.size, 15);
  assert.deepEqual(SMAJ_SERVICES.filter(service => service.adapterMode === "connected").map(service => service.id), ["jobs"]);
});

test("Meta router validates service IDs and blocks unavailable adapters", async () => {
  const previousKey = process.env.META_API_KEY;
  process.env.META_API_KEY = "test-only-key";
  let requestBody: Record<string, any> = {};
  const fetcher = async (_input: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({
      summary: "Use Jobs and Education.", services: ["jobs", "education", "invented"],
      steps: [
        { id: "one", serviceId: "jobs", title: "Find jobs", description: "Read matching roles", capability: "read opportunities", approvalRequired: false },
        { id: "two", serviceId: "education", title: "Plan learning", description: "Prepare a learning path", capability: "learning plans", approvalRequired: false },
        { id: "three", serviceId: "invented", title: "Unsupported", description: "Invalid", capability: "anything" },
      ], warnings: [],
    }) }] }] }), { status: 200 });
  };
  try {
    const result = await new MetaServiceRouter(fetcher as typeof fetch).plan("Find a job and create a learning plan for missing skills.");
    assert.equal(requestBody.model, META_MODEL);
    assert.equal(requestBody.store, false);
    assert.deepEqual(result.services, ["jobs", "education"]);
    assert.equal(result.steps[0].status, "approval_required");
    assert.equal(result.steps[0].approvalRequired, true);
    assert.equal(result.steps[1].status, "unavailable");
    assert.match(result.warnings.join(" "), /No Pi payment/);
  } finally {
    if (previousKey === undefined) delete process.env.META_API_KEY;
    else process.env.META_API_KEY = previousKey;
  }
});

test("Meta router rejects vague tasks before calling the API", async () => {
  let called = false;
  const fetcher = async () => { called = true; return new Response(); };
  await assert.rejects(() => new MetaServiceRouter(fetcher as typeof fetch).plan("help me"), /at least 12 characters/);
  assert.equal(called, false);
});
