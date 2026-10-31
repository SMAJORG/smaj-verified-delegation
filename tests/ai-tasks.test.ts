import assert from "node:assert/strict";
import test from "node:test";
import { metaResponse } from "@/src/server/meta-client";
import { MetaServiceRouter } from "@/src/server/service-router";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { createDatabase } from "@/src/server/database";
import { NextRequest } from "next/server";
import { POST, GET } from "@/app/api/tasks/route";
import { GET as detail, DELETE as remove } from "@/app/api/tasks/[id]/route";
import { issueDemoSession } from "@/src/server/demo-sessions";
import { SESSION_COOKIE } from "@/src/server/auth";

test("short messages produce a provider answer and tasks remain owner-scoped through deletion", async () => {
  const previous = { ...process.env };
  process.env.META_API_KEY = "test-only-secret";
  process.env.META_MODEL = "test-account-model";
  const requests: string[] = [];
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    requests.push(String(url));
    if (String(url).endsWith("/models")) return Response.json({ data: [{ id: "test-account-model" }] });
    assert.equal(JSON.parse(String(init?.body)).model, "test-account-model");
    return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ summary: "Test provider greeting", steps: [], services: [], warnings: [] }) }] }] });
  };
  const database = createDatabase(":memory:");
  try {
    const plan = await new MetaServiceRouter(fetcher as typeof fetch).plan("Hi", []);
    assert.equal(plan.summary, "Test provider greeting");
    assert.deepEqual(plan.steps, []);
    assert.equal(requests.length, 2);
    const store = new AiTaskStore(database);
    const task = store.create("alice", "Hi", plan);
    assert.equal(store.list("alice").length, 1);
    assert.equal(store.list("bob").length, 0);
    assert.throws(() => store.get("bob", task.id), /not found/);
    assert.throws(() => store.delete("bob", task.id), /not found/);
    assert.equal(store.get("alice", task.id).plan.summary, plan.summary);
    store.delete("alice", task.id);
    assert.equal(store.list("alice").length, 0);
  } finally {
    database.close();
    for (const name of Object.keys(process.env)) if (!(name in previous)) delete process.env[name];
    Object.assign(process.env, previous);
  }
});

test("AI rejects missing credentials and blank models, uses the default model, and reports upstream failures", async () => {
  const previous = { ...process.env };
  try {
    delete process.env.META_API_KEY; delete process.env.MODEL_API_KEY;
    await assert.rejects(() => metaResponse("Hi", 100), /not configured/);
    process.env.META_API_KEY = "test-only-secret";
    process.env.META_MODEL = " ";
    await assert.rejects(() => metaResponse("Hi", 100), /META_MODEL/);
    delete process.env.META_MODEL;
    const calls: string[] = [];
    const result = await metaResponse("Hi", 100, (async (url, init) => {
      calls.push(String(url));
      if (String(url).endsWith("/models")) return Response.json({ data: [] });
      assert.equal(JSON.parse(String(init?.body)).model, "muse-spark-1.3");
      return Response.json({ status: "completed", output: [] });
    }) as typeof fetch);
    assert.equal(result.model, "muse-spark-1.3");
    assert.equal(calls.length, 2);
    process.env.META_MODEL = "test-account-model";
    await assert.rejects(() => metaResponse("Hi", 100, (async url => String(url).endsWith("/models") ? Response.json({ data: [{ id: "test-account-model" }] }) : Response.json({ error: { code: "model_not_found", message: "private upstream details" } }, { status: 404 })) as typeof fetch), (error: any) => error.code === "meta_model_not_found" && !error.message.includes("private upstream details"));
    await assert.rejects(() => metaResponse("Hi", 100, (async () => { throw new Error("private network error"); }) as typeof fetch), /could not be reached/);
  } finally {
    for (const name of Object.keys(process.env)) if (!(name in previous)) delete process.env[name];
    Object.assign(process.env, previous);
  }
});

test("task HTTP routes authenticate, save a short answer, list, open, and enforce owner-only deletion", async () => {
  const previous = { ...process.env }, originalFetch = globalThis.fetch;
  process.env.SMAJ_HACKATHON_DB_PATH = ":memory:";
  process.env.SMAJ_DEMO_AUTH_ENABLED = "true";
  process.env.META_API_KEY = "test-only-secret";
  process.env.META_MODEL = "test-account-model";
  globalThis.fetch = async url => Response.json(String(url).endsWith("/models") ? { data: [{ id: "test-account-model" }] } : { status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ summary: "Fixture greeting", steps: [], services: [], warnings: [] }) }] }] });
  const request = (cookie: string, method = "GET", body?: unknown) => new NextRequest("https://test.example/api/tasks", { method, headers: { cookie, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    assert.equal((await GET(request(""))).status, 401);
    const alice = `${SESSION_COOKIE}=${issueDemoSession().value}`, bob = `${SESSION_COOKIE}=${issueDemoSession().value}`;
    const created = await POST(request(alice, "POST", { task: "Hi" }));
    assert.equal(created.status, 201);
    const saved = (await created.json()).task;
    assert.equal(saved.plan.summary, "Fixture greeting");
    const context = { params: Promise.resolve({ id: saved.id }) };
    assert.equal((await (await GET(request(alice))).json()).tasks.length, 1);
    assert.equal((await detail(request(alice), context)).status, 200);
    assert.equal((await detail(request(bob), context)).status, 404);
    assert.equal((await remove(request(bob, "DELETE"), context)).status, 404);
    assert.equal((await remove(request(alice, "DELETE"), context)).status, 204);
    assert.equal((await (await GET(request(alice))).json()).tasks.length, 0);
    assert.equal((await detail(request(alice), context)).status, 404);
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of Object.keys(process.env)) if (!(name in previous)) delete process.env[name];
    Object.assign(process.env, previous);
  }
});
