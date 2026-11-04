import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as create } from "@/app/api/tasks/route";
import { POST as discover } from "@/app/api/tasks/[id]/discover/route";
import { POST as approve } from "@/app/api/tasks/[id]/approve/route";
import { POST as cancel } from "@/app/api/tasks/[id]/cancel/route";
import { PATCH as editReview } from "@/app/api/tasks/[id]/review/route";
import { createUserSession, SESSION_COOKIE } from "@/src/server/auth";
import { workspaceDatabase } from "@/src/server/demo-workspace";
import { ServiceConnectionStore } from "@/src/server/service-connections";
import { LiveWorkflow } from "@/src/server/live-workflow";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { AppError } from "@/src/server/http";

test("authenticated natural request routes through provider, approved live catalog, grounded response, exact-draft approval and independent execution", async () => {
  const old = { ...process.env }, original = globalThis.fetch;
  process.env.SMAJ_DELEGATION_DB_PATH = ":memory:";
  process.env.SMAJ_AI_SESSION_SECRET = "fixture-independent-session-secret";
  process.env.SMAJ_AI_DELEGATION_SECRET = "fixture-live-capability-secret-at-least-32-characters";
  process.env.SMAJ_PRODUCTION_WRITES_ENABLED = "true";
  process.env.META_API_KEY = "fixture-provider-key"; process.env.META_MODEL = "fixture-model";
  delete process.env.SMAJ_AI_PUBLIC_URL; delete process.env.RENDER_EXTERNAL_URL;
  const identity = { sub: "aaaaaaaaaaaaaaaaaaaaaaaa", uid: "fixture-pi-owner" };
  const session = createUserSession(identity);
  const request = (body: unknown, origin = "https://fixture.example") => new NextRequest("https://fixture.example/api/tasks", { method: "POST", headers: { cookie: `${SESSION_COOKIE}=${session.value}`, origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let modelCalls = 0, catalogCalls = 0, writes = 0, saved = false;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/v1/models") return Response.json({ data: [{id:"fixture-model"}] });
    if (url.pathname === "/marketplace/products") {
      catalogCalls++; assert.equal(init?.method,"GET"); assert.equal(url.searchParams.get("currency"),"USD"); assert.equal(url.searchParams.get("maxPrice"),"30000");
      return Response.json({ products: [{id:"product-one",title:"Available car",priceUsdt:25000,pricePi:2}, {id:"over-budget",title:"Expensive car",priceUsdt:50000,pricePi:1}] });
    }
    assert.equal(url.origin,"https://api.meta.ai"); assert.equal(url.pathname,"/v1/responses"); modelCalls++;
    const prompt = JSON.parse(String(init?.body)).input as string;
    const answer = modelCalls === 1
      ? {summary:"Review Store discovery for cars within the specified budget",services:["store"],steps:[{id:"search",serviceId:"store",title:"Search cars",capability:"product discovery",query:{search:"car",maxPrice:30000,currency:"USD"}}],warnings:[]}
      : {summary:"I found one car within your budget. It is listed for $25,000 USDT.",matches:[{serviceId:"store",id:"product-one",reason:"Within budget"},{serviceId:"store",id:"invented",reason:"Must be dropped"}],actions:[{serviceId:"store",recordId:"product-one",kind:"save_product",title:"Save available car"},{serviceId:"store",recordId:"invented",kind:"save_product",title:"Must be dropped"}]};
    if (modelCalls === 2) {
      assert.match(prompt,/product-one/);
      assert.doesNotMatch(prompt,/Expensive car/);
      assert.match(prompt,/1–3 short sentences/);
      assert.match(prompt,/Do not copy or repeat long database descriptions/);
    }
    return Response.json({ id:`fixture-${modelCalls}`, model:"fixture-model", status:"completed", output:[{content:[{type:"output_text",text:JSON.stringify(answer)}]}] });
  };
  try {
    const response = await create(request({task:"Find cars available for $30,000 and save a shortlist."})); assert.equal(response.status,201);
    const task = (await response.json()).task; assert.equal(task.plan.ai.responseId,"fixture-1"); assert.equal(catalogCalls,0); assert.equal(writes,0);
    const context = {params:Promise.resolve({id:task.id})};
    const db = workspaceDatabase(request({})); const connections = new ServiceConnectionStore(db); connections.list(identity.sub,"sso"); connections.set(identity.sub,"store",true);
    const discovered = await discover(request({}),context); assert.equal(discovered.status,200);
    const grounded = (await discovered.json()).task;
    assert.match(grounded.plan.summary,/^I found one car within your budget\. It is listed for \$25,000 USDT\./);
    assert.match(grounded.plan.summary,/Would you like to contact a seller/);
    assert.equal(grounded.plan.summaryAi.responseId,"fixture-2"); assert.equal(grounded.plan.proposedActions.length,1); assert.equal(grounded.plan.matches.length,1); assert.equal(writes,0);
    assert.match(grounded.plan.matches[0].reason, /25,?000 USDT reference.*30,?000 USDT limit/);
    assert.equal((await approve(request({approved:true,actionIds:["action-1"],reviewHash:"stale"}),context)).status,409);
    assert.equal((await approve(request({approved:true,actionIds:["action-1"],reviewHash:grounded.plan.actionReviewHash},"https://evil.example"),context)).status,403);
    const approved = await approve(request({approved:true,actionIds:["action-1"],reviewHash:grounded.plan.actionReviewHash}),context); assert.equal(approved.status,202); assert.equal(writes,0);
    const worker = new LiveWorkflow(db,{async perform(_contract,_action,operation){if(operation==="execute"){writes++;saved=true;}if(!saved)throw new AppError("hub_action_failed","Not saved",409);return {backendId:"fixture-saved-record",status:"saved"};}});
    await worker.tick(); assert.equal(writes,1);
    const execution = new AiTaskStore(db).get(identity.sub,task.id).plan.execution!;
    assert.equal(execution.status,"verified"); assert.equal(execution.receipt?.mode,"live");
    assert.equal(modelCalls,2); assert.equal(catalogCalls,1);
  } finally { globalThis.fetch=original; process.env=old; }
});

test("a confirmed unique car result becomes one bound seller approval draft without repeating the search", async () => {
  const old = { ...process.env }, original = globalThis.fetch;
  process.env.SMAJ_DELEGATION_DB_PATH = ":memory:";
  process.env.SMAJ_AI_SESSION_SECRET = "fixture-seller-continuation-session";
  process.env.SMAJ_AI_DELEGATION_SECRET = "fixture-live-capability-secret-at-least-32-characters";
  process.env.SMAJ_PRODUCTION_WRITES_ENABLED = "true";
  process.env.SMAJ_HUB_API_ORIGIN = "https://hub.fixture.example";
  process.env.META_API_KEY = "fixture-provider-key";
  process.env.META_MODEL = "fixture-model";
  const identity = { sub: "bbbbbbbbbbbbbbbbbbbbbbbb", uid: "fixture-pi-owner" };
  const session = createUserSession(identity);
  const request = (body: unknown) => new NextRequest("https://fixture.example/api/tasks", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE}=${session.value}`, origin: "https://fixture.example", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let modelCalls = 0, catalogCalls = 0, preparedRecordId = "";
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/v1/models") return Response.json({ data: [{ id: "fixture-model" }] });
    if (url.pathname === "/marketplace/products") {
      catalogCalls++;
      return Response.json({ products: [{
        id: "car-one", sellerId: "seller-one", title: "Toyota Corolla",
        sellerName: "Store Seller", pricePi: 2, priceUsdt: 25000, quantity: 1,
      }] });
    }
    if (url.pathname === "/ai-delegation/prepare") {
      const signed = init?.headers && new Headers(init.headers).get("X-SMAJ-Delegation");
      assert.ok(signed);
      const encoded = signed!.split(".")[0];
      const contract = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
      assert.equal(contract.operation, "prepare");
      preparedRecordId = contract.action.recordId;
      return Response.json({ preview: { product: {
        recordId: "car-one", sellerId: "seller-one", title: "Toyota Corolla",
        sellerName: "Store Seller", pricePi: 2, quantityAvailable: 1,
      } } });
    }
    assert.equal(url.origin, "https://api.meta.ai");
    assert.equal(url.pathname, "/v1/responses");
    modelCalls++;
    const prompt = String(JSON.parse(String(init?.body)).input);
    const answer = modelCalls === 1
      ? { summary: "I can find Toyota cars.", services: ["store"], steps: [{
        id: "store-search", serviceId: "store", title: "Find Toyota cars",
        capability: "product discovery", query: { search: "Toyota", maxPrice: 30000, currency: "USD" },
      }], warnings: [] }
      : modelCalls === 2
        ? { summary: "One Toyota Corolla matches.", matches: [{ serviceId: "store", id: "car-one", reason: "Toyota listing" }], actions: [] }
        : { summary: "The Toyota Corolla is listed. Would you like me to contact the seller?",
          matches: [{ serviceId: "store", id: "car-one", reason: "Selected car" }],
          actions: [{ serviceId: "store", recordId: "wrong-car", kind: "contact_seller", title: "Wrong car", message: "Wrong draft" }] };
    if (modelCalls === 3) assert.match(prompt, /Toyota Corolla/);
    return Response.json({ id: `seller-fixture-${modelCalls}`, model: "fixture-model", status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(answer) }] }] });
  };
  try {
    const db = workspaceDatabase(request({}));
    const connections = new ServiceConnectionStore(db);
    connections.list(identity.sub, "sso");
    connections.set(identity.sub, "store", true);

    const first = await create(request({ task: "Find a Toyota car under $30,000" }));
    assert.equal(first.status, 201);
    const firstTask = (await first.json()).task;
    const firstContext = { params: Promise.resolve({ id: firstTask.id }) };
    const firstDiscovery = await discover(request({}), firstContext);
    assert.equal(firstDiscovery.status, 200);
    const found = (await firstDiscovery.json()).task;
    assert.equal(found.plan.selectedStoreProduct.id, "car-one");
    assert.equal(found.plan.selectedStoreProduct.sellerId, "seller-one");
    assert.match(found.plan.summary, /Would you like to contact a seller/);

    const confirmation = await create(request({ task: "Yes, contact the seller", conversationId: firstTask.conversationId }));
    assert.equal(confirmation.status, 201);
    const followUpTask = (await confirmation.json()).task;
    assert.equal(followUpTask.plan.selectedStoreProduct.id, "car-one");
    const followUpContext = { params: Promise.resolve({ id: followUpTask.id }) };
    const prepared = await discover(request({}), followUpContext);
    assert.equal(prepared.status, 200);
    const result = (await prepared.json()).task;

    assert.equal(catalogCalls, 1, "confirmation must reuse the listed car instead of searching again");
    assert.equal(preparedRecordId, "car-one", `Hub preparation must be bound to the exact matched car: ${JSON.stringify(result.plan)}`);
    assert.equal(result.plan.proposedActions.length, 1);
    assert.equal(result.plan.proposedActions[0].kind, "contact_seller");
    assert.equal(result.plan.proposedActions[0].recordId, "car-one");
    assert.equal(result.plan.proposedActions[0].storePreview.product.sellerId, "seller-one");
    assert.match(result.plan.summary, /Review the exact draft below/);
    assert.doesNotMatch(result.plan.summary, /Would you like me to contact/i);
    assert.equal(result.plan.execution, undefined, "preparing the approval draft must not send a seller message");

    const repeated = await create(request({ task: "Yes, contact the seller", conversationId: firstTask.conversationId }));
    assert.equal(repeated.status, 201);
    const repeatedPayload = await repeated.json();
    assert.deepEqual(repeatedPayload.plan.services, []);
    assert.match(repeatedPayload.plan.summary, /already prepared above/i);

    const taskStore = new AiTaskStore(db);
    const edited = await editReview(request({
      actionId: result.plan.proposedActions[0].id,
      message: "Hello, is the Toyota Corolla still available?",
      reviewHash: result.plan.actionReviewHash,
    }), followUpContext);
    assert.equal(edited.status, 200);
    const editedTask = (await edited.json()).task;
    assert.equal(editedTask.plan.proposedActions[0].message, "Hello, is the Toyota Corolla still available?");
    const approved = await approve(request({
      approved: true,
      actionIds: [editedTask.plan.proposedActions[0].id],
      reviewHash: editedTask.plan.actionReviewHash,
    }), followUpContext);
    assert.equal(approved.status, 202);
    assert.equal((await approved.json()).task.plan.execution.status, "queued");
    assert.equal(result.plan.execution, undefined, "only the explicit approval request may queue execution");

    const cancellationTask = taskStore.create(identity.sub, "Cancel seller draft", result.plan);
    const cancellation = await cancel(request({
      actionId: result.plan.proposedActions[0].id,
      reviewHash: result.plan.actionReviewHash,
    }), { params: Promise.resolve({ id: cancellationTask.id }) });
    assert.equal(cancellation.status, 200);
    const cancelledTask = (await cancellation.json()).task;
    assert.equal(cancelledTask.plan.proposedActions.length, 0);
    assert.equal(cancelledTask.plan.cancelledActions[0].action.recordId, "car-one");

    assert.equal(modelCalls, 3, "a repeated confirmation must not invoke routing or discovery again");
  } finally {
    globalThis.fetch = original;
    process.env = old;
  }
});
