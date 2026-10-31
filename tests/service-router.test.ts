import assert from "node:assert/strict";
import test from "node:test";
import { SERVICE_IDS, SMAJ_SERVICES } from "@/src/domain/services";

import { MetaServiceRouter } from "@/src/server/service-router";

test("service catalog contains the official 15 unique SMAJ services", () => {
  assert.equal(SMAJ_SERVICES.length, 15);
  assert.equal(SERVICE_IDS.size, 15);
  assert.deepEqual(SMAJ_SERVICES.filter(service => service.adapterMode === "connected").map(service => service.id), ["store", "jobs"]);
});

test("Meta router tolerates wrapped reasoning and fenced JSON, then validates service IDs", async () => {
  const previousKey = process.env.META_API_KEY;
  process.env.META_API_KEY = "test-only-key";
  const previousModel = process.env.META_MODEL; process.env.META_MODEL = "test-account-model";
  let requestBody: Record<string, any> = {};
  const fetcher = async (_input: string | URL | Request, init?: RequestInit) => {
    if (String(_input).endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "test-account-model" }] }));
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ status: "completed", output: [{ content: [{ type: "output_text", text: `Let me reason first.\n\n```json\n{\"summary\":\"Use Jobs and Education.\",\"services\":[\"jobs\",\"education\"],\"steps\":[{\"id\":\"one\",\"serviceId\":\"jobs\",\"title\":\"Find jobs\",\"description\":\"Read matching roles\",\"capability\":\"read opportunities\",\"approvalRequired\":true},{\"id\":\"two\",\"serviceId\":\"education\",\"title\":\"Plan learning\",\"description\":\"Prepare a learning path\",\"capability\":\"learning plans\",\"approvalRequired\":true}],\"warnings\":[\"No Pi payment will be executed.\"]}\n```\nI have enough context.` }] }] }), { status: 200 });
  };
  try {
    const result = await new MetaServiceRouter(fetcher as typeof fetch).plan("Find a job and create a learning plan for missing skills.");
    assert.equal(requestBody.model, "test-account-model");
    assert.equal(requestBody.store, false);
    assert.deepEqual(result.services, ["jobs", "education"]);
    assert.equal(result.steps[0].status, "approval_required");
    assert.equal(result.steps[0].approvalRequired, true);
    assert.equal(result.steps[1].status, "unavailable");
    assert.match(result.warnings.join(" "), /No Pi payment/);
  } finally {
    if (previousModel === undefined) delete process.env.META_MODEL; else process.env.META_MODEL = previousModel;
    if (previousKey === undefined) delete process.env.META_API_KEY; else process.env.META_API_KEY = previousKey;
  }
});

test("Meta router rejects empty tasks before calling the API", async () => {
  let called = false;
  const fetcher = async () => { called = true; return new Response(); };
  await assert.rejects(() => new MetaServiceRouter(fetcher as typeof fetch).plan(" "), /Enter a message/);
  assert.equal(called, false);
});
