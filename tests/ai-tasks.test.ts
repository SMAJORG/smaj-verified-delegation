import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { metaResponse } from "@/src/server/meta-client";
import { MetaServiceRouter } from "@/src/server/service-router";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { createDatabase } from "@/src/server/database";
import { NextRequest } from "next/server";
import { POST, GET } from "@/app/api/tasks/route";
import { GET as detail, DELETE as remove } from "@/app/api/tasks/[id]/route";
import { GET as listConversations } from "@/app/api/conversations/route";
import { GET as getConversation, PATCH as renameConversation, DELETE as deleteConversation } from "@/app/api/conversations/[id]/route";
import { issueDemoSession } from "@/src/server/demo-sessions";
import { SESSION_COOKIE } from "@/src/server/auth";
import { workspaceDatabase } from "@/src/server/demo-workspace";

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

test("planning-only services give a truthful live-availability answer", async () => {
  const previous = { ...process.env };
  process.env.META_API_KEY = "test-only-secret";
  process.env.META_MODEL = "test-account-model";
  const fetcher = async (_url: string | URL | Request, init?: RequestInit) => {
    if (String(_url).endsWith("/models")) return Response.json({ data: [{ id: "test-account-model" }] });
    const prompt = String(JSON.parse(String(init?.body)).input);
    assert.match(prompt, /adapterMode/);
    return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ summary: "I found several courses for you.", steps: [{ id: "courses", serviceId: "education", title: "Find courses", capability: "course discovery" }], services: ["education"], warnings: [] }) }] }] });
  };
  try {
    const plan = await new MetaServiceRouter(fetcher as typeof fetch).plan("Find current product design courses", []);
    assert.match(plan.summary, /not connected to SMAJ AI for live results yet/i);
    assert.match(plan.steps[0].description, /cannot verify current listings or availability/i);
    assert.equal(plan.steps[0].status, "unavailable");
  } finally {
    for (const name of Object.keys(process.env)) if (!(name in previous)) delete process.env[name];
    Object.assign(process.env, previous);
  }
});

test("connected catalog requests are read-only by default and recommendations use saved context", async () => {
  const previous = { ...process.env };
  process.env.META_API_KEY = "test-only-secret";
  process.env.META_MODEL = "test-account-model";
  let prompt = "";
  const fetcher = async (_url: string | URL | Request, init?: RequestInit) => {
    if (String(_url).endsWith("/models")) return Response.json({ data: [{ id: "test-account-model" }] });
    prompt = String(JSON.parse(String(init?.body)).input);
    return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ summary: "I can search the connected catalog.", steps: [{ id: "store", serviceId: "store", title: "Search products", capability: "product discovery" }], services: ["store"], warnings: [] }) }] }] });
  };
  try {
    const plan = await new MetaServiceRouter(fetcher as typeof fetch).plan(
      "Find a smaller one",
      ["store"],
      [{ task: "Find a desk lamp", summary: "A lamp is listed for $25.", services: ["store"] }],
      ["Prefer adjustable lamps"],
    );
    assert.equal(plan.steps[0].status, "ready");
    assert.equal(plan.steps[0].approvalRequired, false);
    assert.match(prompt, /Prefer adjustable lamps/);
    assert.match(prompt, /Find a desk lamp/);
    assert.match(prompt, /Rank live matches by explicit constraints/);
  } finally {
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
      return Response.json({ id: "fixture-response", model: "muse-spark-1.3", status: "completed", output: [{ content: [{ type: "output_text", text: "Fixture hello" }] }] });
    }) as typeof fetch);
    assert.equal(result.model, "muse-spark-1.3");
    assert.equal(calls.length, 2);
    assert.equal(result.provenance.responseId, "fixture-response");
    await assert.rejects(() => metaResponse("Hi", 100, (async url => String(url).endsWith("/models") ? Response.json({data:[]}) : Response.json({status:"completed",output:[]})) as typeof fetch), (error: any) => error.code === "meta_empty_response");
    await assert.rejects(() => metaResponse("Hi", 100, (async url => String(url).endsWith("/models") ? Response.json({data:[]}) : Response.json({status:"incomplete",output:[{content:[{type:"output_text",text:"Partial"}]}]})) as typeof fetch), (error: any) => error.code === "meta_incomplete");
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
  const request = (cookie: string, method = "GET", body?: unknown) => new NextRequest("https://test.example/api/tasks", { method, headers: { cookie, origin: "https://test.example", "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
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

test("conversation threads keep saved turns, owner-scoped names, and deletion safeguards", async () => {
  const database = createDatabase(":memory:");
  try {
    const store = new AiTaskStore(database);
    const first = store.create("alice", "Find remote design jobs", { summary: "Found remote jobs.", model: "fixture", services: ["jobs"], steps: [], warnings: [] });
    const followUp = store.create("alice", "Only senior roles", { summary: "Filtered to senior roles.", model: "fixture", services: ["jobs"], steps: [], warnings: [] }, first.conversationId);
    const privateTask = store.create("bob", "My private request", { summary: "Private.", model: "fixture", services: [], steps: [], warnings: [] });
    const conversation = store.conversations("alice")[0];
    assert.equal(conversation.id, first.conversationId);
    assert.equal(conversation.title, "Find remote design jobs");
    assert.equal(conversation.taskCount, 2);
    assert.equal(conversation.latestTaskId, followUp.id);
    assert.deepEqual(store.conversation("alice", first.conversationId!).map(task => task.task), ["Find remote design jobs", "Only senior roles"]);
    assert.equal(store.conversations("bob")[0].title, "My private request");

    store.renameConversation("alice", first.conversationId!, "Senior design search");
    assert.equal(new AiTaskStore(database).conversations("alice")[0].title, "Senior design search");
    assert.throws(() => store.renameConversation("bob", first.conversationId!, "Leaked"), /not found/);
    store.deleteConversation("alice", first.conversationId!);
    assert.equal(store.list("alice").length, 0);
    assert.equal(store.conversations("alice").length, 0);
    assert.equal(store.get("bob", privateTask.id).task, "My private request");

    const active = store.create("alice", "Application running", {
      summary: "Running.", model: "fixture", services: [], steps: [], warnings: [], execution: { status: "running", approvedAt: "", expiresAt: "", actions: [], attempts: 0 },
    });
    assert.throws(() => store.deleteConversation("alice", active.conversationId!), /Wait for live actions/);
    assert.equal(store.get("alice", active.id).task, "Application running");
  } finally {
    database.close();
  }
});

test("existing saved task threads migrate to searchable conversations without losing turns", () => {
  const directory = mkdtempSync(join(tmpdir(), "smaj-ai-conversations-"));
  const path = join(directory, "legacy.sqlite");
  const legacy = new Database(path);
  legacy.exec("CREATE TABLE ai_tasks (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, task TEXT NOT NULL, plan_json TEXT NOT NULL, created_at TEXT NOT NULL, conversation_id TEXT NOT NULL DEFAULT '')");
  const plan = JSON.stringify({ summary: "Saved response", model: "fixture", services: [], steps: [], warnings: [] });
  legacy.prepare("INSERT INTO ai_tasks (id, owner_id, task, plan_json, created_at, conversation_id) VALUES (?, ?, ?, ?, ?, ?)").run("turn-1", "alice", "Original saved request", plan, "2026-01-01T10:00:00.000Z", "thread-1");
  legacy.prepare("INSERT INTO ai_tasks (id, owner_id, task, plan_json, created_at, conversation_id) VALUES (?, ?, ?, ?, ?, ?)").run("turn-2", "alice", "Saved follow-up", plan, "2026-01-01T10:05:00.000Z", "thread-1");
  legacy.close();
  const migrated = createDatabase(path);
  try {
    const store = new AiTaskStore(migrated);
    assert.equal(store.list("alice").length, 2);
    assert.equal(store.conversations("alice")[0].title, "Original saved request");
    assert.equal(store.conversations("alice")[0].taskCount, 2);
  } finally {
    migrated.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("conversation HTTP routes authenticate and enforce owner-scoped rename and deletion", async () => {
  const previous = { ...process.env };
  process.env.SMAJ_HACKATHON_DB_PATH = ":memory:";
  process.env.SMAJ_DEMO_AUTH_ENABLED = "true";
  const aliceSession = issueDemoSession(), bobSession = issueDemoSession();
  const alice = `${SESSION_COOKIE}=${aliceSession.value}`;
  const bob = `${SESSION_COOKIE}=${bobSession.value}`;
  const request = (cookie: string, method = "GET", body?: unknown, origin = "https://test.example") => new NextRequest("https://test.example/api/conversations", {
    method,
    headers: { cookie, origin, "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  try {
    const seedRequest = request(alice);
    const seed = new AiTaskStore(workspaceDatabase(seedRequest)).create(aliceSession.actorId, "Saved question", { summary: "Saved answer.", model: "fixture", services: [], steps: [], warnings: [] });
    const seedStore = new AiTaskStore(workspaceDatabase(seedRequest));
    for (let index = 0; index < 12; index++) seedStore.create(aliceSession.actorId, `Follow-up ${index + 1}`, { summary: `Answer ${index + 1}.`, model: "fixture", services: [], steps: [], warnings: [] }, seed.conversationId);
    const context = { params: Promise.resolve({ id: seed.conversationId! }) };
    assert.equal((await listConversations(request(""))).status, 401);
    const listed = await listConversations(request(alice));
    assert.equal(listed.status, 200);
    assert.equal((await listed.json()).conversations[0].title, "Saved question");
    assert.equal((await getConversation(request(""), context)).status, 401);
    assert.equal((await getConversation(request(bob), context)).status, 404);
    const restored = await getConversation(request(alice), context);
    assert.equal(restored.status, 200);
    const restoredPayload = await restored.json();
    assert.equal(restoredPayload.tasks.length, 13);
    assert.equal(restoredPayload.tasks[0].task, "Saved question");
    assert.equal(restoredPayload.tasks[12].task, "Follow-up 12");
    assert.equal((await renameConversation(request(bob, "PATCH", { title: "Not yours" }), context)).status, 404);
    assert.equal((await renameConversation(request(alice, "PATCH", { title: "  Named chat  " }), context)).status, 200);
    assert.equal((await listConversations(request(alice)).then(response => response.json())).conversations[0].title, "Named chat");
    assert.equal((await renameConversation(request(alice, "PATCH", { title: " " }), context)).status, 400);
    assert.equal((await deleteConversation(request(alice, "DELETE", undefined, "https://other.example"), context)).status, 403);
    assert.equal((await deleteConversation(request(bob, "DELETE"), context)).status, 404);
    assert.equal((await deleteConversation(request(alice, "DELETE"), context)).status, 204);
  } finally {
    for (const name of Object.keys(process.env)) if (!(name in previous)) delete process.env[name];
    Object.assign(process.env, previous);
  }
});
