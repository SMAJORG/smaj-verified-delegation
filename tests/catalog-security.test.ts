import test from "node:test";
import assert from "node:assert/strict";
import { catalogJson } from "@/src/server/catalog-http";
import { SmajJobsReadAdapter } from "@/src/server/jobs-adapter";
import { SmajStoreReadAdapter } from "@/src/server/store-adapter";
import { SmajStreamReadAdapter } from "@/src/server/stream-adapter";
import { discoverCatalogs } from "@/src/server/catalog-discovery";
import { requireSameOrigin } from "@/src/server/http";

for (const service of ["jobs", "store", "stream"] as const) {
  test(`${service}: validates payload, sends GET without credentials and blocks redirects`, async () => {
    const fetcher = (async (_url, init) => {
      assert.equal(init?.method, "GET"); assert.equal(init?.redirect, "error");
      assert.deepEqual(init?.headers, { Accept: "application/json" });
      const key = service === "jobs" ? "jobs" : service === "store" ? "products" : "results";
      return Response.json({ [key]: [{ employerId: "real-employer", id: "a", _id: "a", title: "Published item", posterUrl: "https://image.tmdb.org/t/p/w500/poster.jpg", mediaType: "movie", privateEmail: "private" }] });
    }) as typeof fetch;
    const adapter = service === "jobs" ? new SmajJobsReadAdapter(undefined, fetcher) : service === "store" ? new SmajStoreReadAdapter(undefined, fetcher) : new SmajStreamReadAdapter(undefined, fetcher);
    const records = adapter instanceof SmajJobsReadAdapter ? await adapter.listJobs() : adapter instanceof SmajStoreReadAdapter ? await adapter.listProducts() : await adapter.listContent();
    assert.equal(records.length, 1); assert.ok(!JSON.stringify(records).includes("privateEmail"));
    const bad = (async () => Response.json({ jobs: [{}], products: [{}], results: [{}] })) as typeof fetch;
    await assert.rejects(() => service === "jobs" ? new SmajJobsReadAdapter(undefined, bad).listJobs() : service === "store" ? new SmajStoreReadAdapter(undefined, bad).listProducts() : new SmajStreamReadAdapter(undefined, bad).listContent());
  });
}
test("outbound host/path restrictions and response limit fail closed", async () => {
  const never = (async () => { throw new Error("must not fetch"); }) as typeof fetch;
  await assert.rejects(() => catalogJson("https://evil.example/jobs/jobs", never), /origin/);
  await assert.rejects(() => catalogJson("https://smajpihub.onrender.com/stream/subscription", never), /path/);
  await assert.rejects(() => catalogJson("https://smajpihub.onrender.com/jobs/jobs", (async () => new Response("a".repeat(1_000_001))) as typeof fetch), /too large/);
});
test("disconnected services send no requests; failures remain independent and truthful", async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ products: [] }); };
  try {
    const proof = await discoverCatalogs(["jobs", "store", "stream"], id => id === "store");
    assert.equal(calls, 1); assert.deepEqual(proof.results.map(r => r.status), ["unavailable", "read", "unavailable"]);
    assert.equal(proof.proofHash.length, 64);
  } finally { globalThis.fetch = original; }
});
test("planning-only service discovery clearly reports no live results without making a request", async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({}); };
  try {
    const proof = await discoverCatalogs(["education"], () => true);
    assert.equal(calls, 0);
    assert.equal(proof.results[0].status, "unavailable");
    assert.match(proof.results[0].error || "", /not connected to SMAJ AI for live results yet/);
  } finally { globalThis.fetch = original; }
});
test("approval endpoints reject missing or cross-site origin", () => {
  assert.throws(() => requireSameOrigin(new Request("https://ai.example/api/tasks")), /Same-origin/);
  assert.throws(() => requireSameOrigin(new Request("https://ai.example/api/tasks", { headers: { origin: "https://evil.example" } })), /Same-origin/);
});

test("public catalog reads need no separate approval, enforce task ownership, and persist evidence despite Meta failure", async () => {
  const { POST } = await import("@/app/api/tasks/[id]/discover/route");
  const { NextRequest } = await import("next/server");
  const { createUserSession, SESSION_COOKIE } = await import("@/src/server/auth");
  const { workspaceDatabase } = await import("@/src/server/demo-workspace");
  const { AiTaskStore } = await import("@/src/server/ai-tasks");
  const { ServiceConnectionStore } = await import("@/src/server/service-connections");
  const previous = { ...process.env }, original = globalThis.fetch;
  process.env.SMAJ_DELEGATION_DB_PATH = ":memory:";
  process.env.SMAJ_AI_SESSION_SECRET = "test-independent-session-secret";
  delete process.env.SMAJ_AI_PUBLIC_URL; delete process.env.META_API_KEY; delete process.env.MODEL_API_KEY;
  const alice = createUserSession({ sub: "catalog-alice" }), bob = createUserSession({ sub: "catalog-bob" });
  const request = (value: string, approved: boolean) => new NextRequest("https://test.example/api/tasks/t/discover", { method: "POST", headers: { cookie: `${SESSION_COOKIE}=${value}`, origin: "https://test.example", "Content-Type": "application/json" }, body: JSON.stringify({ approved }) });
  try {
    const db = workspaceDatabase(request(alice.value, true)), tasks = new AiTaskStore(db);
    const task = tasks.create("catalog-alice", "Find available products", { summary: "Plan", model: "fixture", services: ["store"], steps: [], warnings: [] });
    new ServiceConnectionStore(db).set("catalog-alice", "store", true);
    const context = { params: Promise.resolve({ id: task.id }) };
    assert.equal((await POST(request(bob.value, true), context)).status, 404);
    globalThis.fetch = async () => Response.json({ products: [{ id: "real-id", title: "Catalog product" }] });
    const response = await POST(request(alice.value, false), context);
    assert.equal(response.status, 200);
    const saved = tasks.get("catalog-alice", task.id);
    assert.equal(saved.plan.discovery?.results[0].records.length, 1);
    assert.equal(saved.plan.discovery?.proofHash.length, 64);
    assert.match(saved.plan.summary, /Search finished/);
    assert.equal(saved.plan.summaryAi, undefined);
    assert.equal(saved.plan.summaryError?.code, "meta_not_configured");
    assert.throws(() => tasks.get("catalog-bob", task.id), /not found/);
  } finally {
    globalThis.fetch = original;
    for (const name of Object.keys(process.env)) if (!(name in previous)) delete process.env[name];
    Object.assign(process.env, previous);
  }
});

test("search preserves dollar budgets and labels sample Jobs separately from employer-backed listings", async () => {
  const { catalogSearchUrl } = await import("@/src/server/catalog-http");
  const url = new URL(catalogSearchUrl("https://smajpihub.onrender.com/marketplace/products", { search: "car", maxPrice: 30000, currency: "USD" }, "store"));
  assert.equal(url.searchParams.get("currency"), "USD"); assert.equal(url.searchParams.get("maxPrice"), "30000");
  const store = new SmajStoreReadAdapter(undefined, async () => Response.json({ products: [{ id: "cheap", title: "Car A", pricePi: 2, priceUsdt: 25000 }, { id: "expensive", title: "Car B", pricePi: 1, priceUsdt: 50000 }] }));
  assert.deepEqual((await store.listProducts({maxPrice:30000,currency:"USD"})).map(p=>p.id), ["cheap"]);
  const jobs = new SmajJobsReadAdapter(undefined, async () => Response.json({ jobs: [{ id: "seed", title: "Fictional seed" }, { id: "demo", title: "Demo employer", employerId: "employer", isDemo: true }, { id: "published", slug: "published-slug", title: "Published employer job", employerId: "employer" }] }));
  const rows = await jobs.listJobs();
  assert.deepEqual(rows.map(j=>j.id), ["seed", "published-slug"]);
  assert.deepEqual(rows.map(j=>j.listingProvenance), ["sample_unverified", "employer_backed"]);
});

test("Store leaves unknown attributes and prices blank instead of supplying invented values", async () => {
  const store = new SmajStoreReadAdapter(undefined, async () => Response.json({ products: [{ id: "actual-id", title: "Catalog product", pricePi: null, priceUsdt: null, quantity: null, category: null, location: null }] }));
  const [product] = await store.listProducts();
  assert.equal(product.title, "Catalog product");
  assert.equal(product.price, "");
  assert.equal(product.category, "");
  assert.equal(product.location, "");
  assert.equal(product.quantity, undefined);
});
