import test from "node:test";
import assert from "node:assert/strict";
import { apiError } from "@/src/server/http";
import { NextRequest } from "next/server";
import { POST as open } from "@/app/api/public/session/route";
import { GET as sessionInfo, DELETE as logout } from "@/app/api/auth/session/route";
import { GET as tasks, POST as ask } from "@/app/api/tasks/route";
import { GET as taskDetail } from "@/app/api/tasks/[id]/route";
import { POST as discover } from "@/app/api/tasks/[id]/discover/route";
import { POST as protectedApproval } from "@/app/api/tasks/[id]/approve/route";
import { GET as delegations, POST as protectedPlan } from "@/app/api/delegations/route";
import { GET as privateDetail } from "@/app/api/delegations/[id]/route";
import { POST as privateExecute } from "@/app/api/delegations/[id]/execute/route";
import { GET as connections } from "@/app/api/connections/route";
import { SESSION_COOKIE, requireActorSession, requireAuthenticatedSession } from "@/src/server/auth";
import { createDatabase, getDatabase } from "@/src/server/database";
import { issuePublicSession, readPublicSession, beginPublicWork, PUBLIC_SESSION_TTL } from "@/src/server/public-access";
import { AiTaskStore } from "@/src/server/ai-tasks";
import type { ServiceRoutePlan } from "@/src/domain/services";
const req=(path:string,cookie="",body?:unknown,origin="https://public.example")=>new NextRequest(`https://public.example${path}`,{method:body===undefined?"GET":"POST",headers:{origin,cookie,"content-type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});
const emptyPlan:ServiceRoutePlan={summary:"A public answer",model:"test-only",services:[],steps:[],warnings:[]};
const setup=()=>{process.env.SMAJ_DELEGATION_DB_PATH=":memory:";for(const key of ["SMAJ_AI_PUBLIC_URL","RENDER_EXTERNAL_URL","SMAJ_AI_CLIENT_SECRET","SMAJ_AI_SSO_SECRET","SMAJ_AI_SESSION_SECRET","SMAJ_DEMO_ACCESS_TOKEN","SMAJ_SAMPLE_TASKS_ENABLED"])delete process.env[key];};

test("public workspace needs no account or signing secret, isolates visitors, and cannot access protected data or actions",async()=>{
 const old={...process.env};setup();
 try{
  assert.equal((await open(req("/api/public/session","",{},"https://evil.example"))).status,403);
  const opened=await open(req("/api/public/session","",{authType:"sso",uid:"forged-user"}));assert.equal(opened.status,200);
  const data=await opened.json();assert.equal(data.authenticated,false);assert.equal(data.publicAccess,true);assert.equal(data.sandbox,false);assert.equal(data.sampleTasksEnabled,false);
  const token=opened.cookies.get(SESSION_COOKIE)!.value;assert.match(token,/^visitor_/);assert.match(opened.headers.get("set-cookie")!,/HttpOnly/);assert.match(opened.headers.get("set-cookie")!,/Secure/);assert.equal(JSON.stringify(data).includes(token),false);
  const cookie=`${SESSION_COOKIE}=${token}`;const actor=requireActorSession(req("/",cookie));assert.equal(actor.authType,"public");assert.equal(actor.uid,undefined);assert.throws(()=>requireAuthenticatedSession(req("/",cookie)));
  const again=await open(req("/api/public/session",cookie,{}));assert.equal(again.cookies.get(SESSION_COOKIE),undefined);assert.equal((await again.json()).authenticated,false);
  assert.equal((await (await sessionInfo(req("/api/auth/session",cookie))).json()).publicAccess,true);
  const db=getDatabase();const own=new AiTaskStore(db).create(actor.actorId,"My question",emptyPlan);const privateTask=new AiTaskStore(db).create("private-pi-account","Private account request",emptyPlan);
  const other=await open(req("/api/public/session","",{}));const otherCookie=`${SESSION_COOKIE}=${other.cookies.get(SESSION_COOKIE)!.value}`;
  const context={params:Promise.resolve({id:own.id})};assert.equal((await taskDetail(req("/api/tasks/id",cookie),context)).status,200);assert.equal((await taskDetail(req("/api/tasks/id",otherCookie),context)).status,404);
  assert.equal((await taskDetail(req("/api/tasks/id",cookie),{params:Promise.resolve({id:privateTask.id})})).status,404);
  const list=await (await tasks(req("/api/tasks",cookie))).json();assert.deepEqual(list.tasks.map((t:any)=>t.id),[own.id]);
  const available=await (await connections(req("/api/connections",cookie))).json();assert.deepEqual(available.connections.filter((c:any)=>c.connected).map((c:any)=>c.serviceId).sort(),["jobs","store","stream"]);
  assert.deepEqual((await (await delegations(req("/api/delegations",cookie))).json()).delegations,[]);
  assert.equal((await protectedPlan(req("/api/delegations",cookie,{}))).status,401);assert.equal((await privateDetail(req("/api/delegations/id",cookie),context)).status,401);assert.equal((await privateExecute(req("/api/delegations/id/execute",cookie,{}),context)).status,401);
  assert.equal((await protectedApproval(req("/api/tasks/id/approve",cookie,{approved:true,actionIds:["buy","apply","save"]}),context)).status,401);
  assert.equal((await logout(new NextRequest("https://public.example/api/auth/session",{method:"DELETE",headers:{cookie}}))).status,200);assert.throws(()=>requireActorSession(req("/",cookie)));assert.equal(new AiTaskStore(db).list(actor.actorId).length,0);assert.equal(new AiTaskStore(db).get("private-pi-account",privateTask.id).task,"Private account request");
 }finally{process.env=old;}
});

test("public car, software Jobs, services and Hub questions use Meta without SSO; catalog consent and grounded IDs remain enforced",async()=>{
 const old={...process.env},original=globalThis.fetch;setup();process.env.META_API_KEY="test-only-provider-secret";process.env.META_MODEL="test-only-public-model";
 let reads=0,modelCalls=0;
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));
  if(url.pathname==="/v1/models")return Response.json({data:[{id:"test-only-public-model"}]});
  if(url.pathname==="/marketplace/products"){reads++;assert.equal(init?.method,"GET");assert.equal(url.searchParams.get("currency"),"USD");assert.equal(url.searchParams.get("maxPrice"),"30000");return Response.json({products:[{id:"public-car",title:"Lexus SUV",priceUsdt:22500,imageUrl:"https://images.example/car.jpg"},{id:"too-expensive",title:"Lexus SUV",priceUsdt:40000},{id:"accessory",title:"Car cover",priceUsdt:50}]});}
  if(url.pathname==="/jobs/jobs"){reads++;assert.equal(url.searchParams.has("catalog_read"),false);return Response.json({jobs:[{slug:"react-sample",title:"React Frontend Engineer",company:"Orbit Commerce",companyId:"orbit-commerce",location:"Lagos, Nigeria",category:"Engineering",mode:"Hybrid",type:"Full time",salary:"π 0.007–0.00955 / mo",summary:"Build fast, accessible commerce tools.",skills:["React","TypeScript"]}],pagination:{page:1,pageSize:50,total:1,pages:1}});}
  assert.equal(url.origin,"https://api.meta.ai");assert.equal((init?.headers as Record<string,string>).Authorization,"Bearer test-only-provider-secret");modelCalls++;
  const prompt=JSON.parse(String(init?.body)).input as string;let answer:any;
  if(prompt.startsWith("Analyze the user request"))answer=prompt.includes('"public-car"')?{summary:"The returned Lexus is within the budget.",matches:[{serviceId:"store",id:"public-car",reason:"Within budget"},{serviceId:"store",id:"invented",reason:"Must be rejected"}],actions:[]}:{summary:"React Frontend Engineer is available as an unverified sample listing.",matches:[{serviceId:"jobs",id:"react-sample",reason:"Frontend engineering title and React skills match."}],actions:[{serviceId:"jobs",recordId:"react-sample",kind:"apply",title:"Apply to React Frontend Engineer",coverNote:"I am interested."}]};
  else {assert.match(prompt,/Public visitors may/);answer=prompt.includes("User task: Find cars")?{summary:"Search Store for cars",steps:[{serviceId:"store",query:{search:"cars",maxPrice:30000,currency:"USD"}}]}:prompt.includes("User task: Find software")?{summary:"Search published software engineering jobs",steps:[{serviceId:"jobs",query:{search:"software engineer"}}]}:prompt.includes("User task: Search available")?{summary:"Store, Jobs and Stream have public catalogs; other services may still be planned.",steps:[]}:{summary:"SMAJ PI HUB connects Pi community services. Account actions require sign-in.",steps:[]};}
  return Response.json({id:`test-meta-${modelCalls}`,model:"test-only-public-model",status:"completed",output:[{content:[{type:"output_text",text:JSON.stringify(answer)}]}]});
 };
 try{
  const opened=await open(req("/api/public/session","",{}));const cookie=`${SESSION_COOKIE}=${opened.cookies.get(SESSION_COOKIE)!.value}`;
  const queries=["Find cars under $30,000.","Find software engineering jobs.","Search available SMAJ PI HUB services.","What is SMAJ PI HUB?"];
  for(let index=0;index<queries.length;index++){
   const created=await ask(req("/api/tasks",cookie,{task:queries[index]}));assert.equal(created.status,201);const result=await created.json();assert.equal(result.plan.ai.provider,"meta");assert.equal(JSON.stringify(result).includes("test-only-provider-secret"),false);
   if(index<2){const before=reads;const context={params:Promise.resolve({id:result.task.id})};assert.equal((await discover(req("/api/tasks/id/discover",cookie,{approved:false}),context)).status,400);assert.equal((await discover(req("/api/tasks/id/discover",cookie,{approved:true},"https://evil.example"),context)).status,403);assert.equal(reads,before);
    const found=await discover(req("/api/tasks/id/discover",cookie,{approved:true}),context);assert.equal(found.status,200);const plan=(await found.json()).plan;assert.equal(plan.summaryAi.provider,"meta");
    if(index===0){assert.deepEqual(plan.discovery.results[0].records.map((r:any)=>r.id),["public-car"]);assert.equal(plan.discovery.results[0].records[0].price,"$22,500 USDT");assert.equal(plan.matches.length,1);}else{assert.deepEqual(plan.discovery.results[0].records.map((r:any)=>r.id),["react-sample"]);assert.equal(plan.discovery.results[0].records[0].listingProvenance,"sample_unverified");assert.equal(plan.matches.length,1);assert.equal(plan.proposedActions.length,0);assert.match(plan.summary,/unverified sample/i);}
   }else{assert.equal(result.plan.steps.length,0);assert.ok(result.plan.summary.length>20);}
  }
  assert.equal(reads,2);assert.equal(modelCalls,6);assert.equal((await (await sessionInfo(req("/api/auth/session",cookie))).json()).authenticated,false);
  const huge=await ask(req("/api/tasks",cookie,{task:"x".repeat(17000)}));assert.equal(huge.status,413);assert.equal(modelCalls,6);
 }finally{globalThis.fetch=original;process.env=old;}
});

test("public limits persist, concurrent provider calls are bounded, and expiring visitor cookies cannot grant identity",()=>{
 const db=createDatabase(":memory:");const now=Date.now();const request=new Request("https://public.example",{headers:{"x-forwarded-for":"198.51.100.17"}});const visitor=issuePublicSession(request,db,now);const session=readPublicSession(visitor.value,db,now);
 const release=beginPublicWork(request,session,db,now);assert.throws(()=>beginPublicWork(request,session,db,now),(e:any)=>e.status===429);release();
 for(let i=0;i<9;i++)beginPublicWork(request,session,db,now)();assert.throws(()=>beginPublicWork(request,session,db,now),(e:any)=>{assert.equal(e.status,429);const response=apiError(e);assert.ok(Number(response.headers.get("Retry-After"))>0);assert.equal(response.headers.get("Cache-Control"),"no-store");return true;});
 assert.throws(()=>readPublicSession(visitor.value+"tampered",db,now));assert.throws(()=>readPublicSession(visitor.value,db,now+PUBLIC_SESSION_TTL*1000));
 const future=now+60001;const leases:Array<()=>void>=[];
 for(let i=0;i<8;i++){const r=new Request("https://public.example",{headers:{"x-forwarded-for":`198.51.100.${i+30}`}});const next=issuePublicSession(r,db,future);leases.push(beginPublicWork(r,readPublicSession(next.value,db,future),db,future));}
 const r=new Request("https://public.example",{headers:{"x-forwarded-for":"198.51.100.90"}});const ninth=issuePublicSession(r,db,future);assert.throws(()=>beginPublicWork(r,readPublicSession(ninth.value,db,future),db,future),(e:any)=>e.status===429);leases.forEach(done=>done());beginPublicWork(r,readPublicSession(ninth.value,db,future),db,future)();
 const dayBucket=`ai:global-day:${Math.floor(future/86400000)*86400000}`;db.prepare("UPDATE public_limits SET hits = 1000 WHERE bucket = ?").run(dayBucket);assert.throws(()=>beginPublicWork(r,readPublicSession(ninth.value,db,future),db,future),(e:any)=>e.status===429);
 db.close();
});
