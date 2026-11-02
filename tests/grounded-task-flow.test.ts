import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as create } from "@/app/api/tasks/route";
import { POST as discover } from "@/app/api/tasks/[id]/discover/route";
import { POST as approve } from "@/app/api/tasks/[id]/approve/route";
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
