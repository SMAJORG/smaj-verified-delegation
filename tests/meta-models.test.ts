import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { listMetaModels, metaResponse } from "@/src/server/meta-client";
import { GET as modelList } from "@/app/api/models/route";
import { POST } from "@/app/api/tasks/route";
import { issueDemoSession } from "@/src/server/demo-sessions";
import { SESSION_COOKIE } from "@/src/server/auth";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { workspaceDatabase } from "@/src/server/demo-workspace";

const catalog = { data: [{ id: "muse-spark-1.3" }, { id: "muse-wonder-1.0", description: "Reasoning" }, { id: "muse-image-1.0" }, { id: "sam-3.1" }, { id: "muse-voice-transcribe-1.0" }, { id: "unknown-model" }, { id: "muse-spark-9.0", available: false }] };

test("account model list filters incompatible models and prefers Spark only when returned", async () => {
  const previous = { ...process.env };
  process.env.META_API_KEY = "test-only-model-selector-key";
  try {
    const listed = await listMetaModels((async () => Response.json(catalog)) as typeof fetch);
    assert.deepEqual(listed.models.map(model => model.id), ["muse-spark-1.3", "muse-wonder-1.0"]);
    assert.equal(listed.defaultModel, "muse-spark-1.3");
    const fallback = await listMetaModels((async () => Response.json({ data: [{ id: "muse-wonder-1.0" }] })) as typeof fetch);
    assert.equal(fallback.defaultModel, "muse-wonder-1.0");
    await assert.rejects(() => metaResponse("Hello", 100, (async () => Response.json(catalog)) as typeof fetch, "not-in-account"), (error: any) => error.code === "meta_model_not_available" && error.status === 409);
    await assert.rejects(() => listMetaModels((async () => Response.json({ error: { code: "unauthorized", message: "sensitive provider details" } }, { status: 401 })) as typeof fetch), (error: any) => error.message.includes("HTTP 401, unauthorized") && !error.message.includes("sensitive"));
  } finally { process.env = previous; }
});

test("selected model reaches Meta responses through task HTTP route without resetting history or approvals", async () => {
  const previous = { ...process.env }, originalFetch = globalThis.fetch;
  process.env.SMAJ_HACKATHON_DB_PATH = ":memory:";
  process.env.SMAJ_DEMO_AUTH_ENABLED = "true";
  process.env.META_API_KEY = "test-only-model-selector-key";
  const sentModels: string[] = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-only-model-selector-key");
    if (String(url).endsWith("/models")) return Response.json(catalog);
    const body = JSON.parse(String(init?.body)); sentModels.push(body.model);
    return Response.json({ status: "completed", model: body.model, output: [{ content: [{ type: "output_text", text: JSON.stringify({ summary: "Test answer", steps: [], services: [], warnings: [] }) }] }] });
  };
  try {
    const cookie = `${SESSION_COOKIE}=${issueDemoSession().value}`;
    const request = (body?: unknown) => new NextRequest("https://test.example/api/tasks", { method: body ? "POST" : "GET", headers: { cookie, origin: "https://test.example", "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.equal((await modelList(request())).status, 200);
    const first = await POST(request({ task: "Hello", model: "muse-spark-1.3" }));
    assert.equal(first.status, 201); const saved = (await first.json()).task;
    // A pending approval elsewhere must remain byte-for-byte unchanged when a new model is used.
    const { requireActor } = await import("@/src/server/auth");
    const store = new AiTaskStore(workspaceDatabase(request())); const actor = requireActor(request());
    const pending = store.create(actor, "Pending task", { summary: "Awaiting review", model: "muse-spark-1.3", services: [], steps: [], warnings: [], proposedActions: [{ id: "review", serviceId: "jobs", kind: "apply", recordId: "record", title: "Review this application", coverNote: "Please review my application." }] });
    const followup = await POST(request({ task: "Continue", conversationId: saved.conversationId, model: "muse-wonder-1.0" }));
    assert.equal(followup.status, 201);
    assert.deepEqual(sentModels, ["muse-spark-1.3", "muse-wonder-1.0"]);
    assert.equal(store.conversationHistory(actor, saved.conversationId).length, 2);
    assert.deepEqual(store.get(actor, pending.id).plan, pending.plan);
    assert.equal((await POST(request({ task: "Blocked", model: "muse-image-1.0" }))).status, 409);
    assert.equal(sentModels.length, 2);
    const publicPayload = JSON.stringify(await (await modelList(request())).json());
    assert.ok(!publicPayload.includes("test-only-model-selector-key"));
  } finally { globalThis.fetch = originalFetch; process.env = previous; }
});
