import test from "node:test";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { POST as start } from "@/app/api/auth/search/route";
import { GET as authorize } from "@/app/api/auth/sso/route";
import { GET as callback } from "@/app/api/auth/callback/route";
import { POST as discover } from "@/app/api/tasks/[id]/discover/route";
import { POST as enter } from "@/app/api/auth/demo/route";
import { SESSION_COOKIE, requireActorSession } from "@/src/server/auth";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { workspaceDatabase } from "@/src/server/demo-workspace";
import { SearchSignInStore, SEARCH_SIGNIN_COOKIE } from "@/src/server/search-signin";
import { SSO_STATE_COOKIE } from "@/src/server/sso";
import { ServiceConnectionStore } from "@/src/server/service-connections";
import type { ServiceRoutePlan } from "@/src/domain/services";

const plan:ServiceRoutePlan={summary:"Search cars under $30,000",model:"test-only",services:["store"],steps:[{id:"read",serviceId:"store",title:"Read Store",description:"",capability:"product discovery",status:"approval_required",approvalRequired:true,reason:"",query:{search:"cars",maxPrice:30000,currency:"USD"}}],warnings:[]};

test("approved search requires verified SSO, transfers only the approved request, resumes once, and uses live catalog GET",async()=>{
 const old={...process.env},fetcher=globalThis.fetch;
 process.env.SMAJ_DELEGATION_DB_PATH=":memory:";process.env.SMAJ_HACKATHON_DB_PATH=join(mkdtempSync(join(tmpdir(),"search-signin-")),"sandbox.sqlite");
 process.env.SMAJ_AI_SESSION_SECRET="test-only-session-secret-at-least-32";process.env.SMAJ_DEMO_AUTH_ENABLED="true";
 delete process.env.SMAJ_SAMPLE_TASKS_ENABLED;delete process.env.SMAJ_AI_PUBLIC_URL;
 process.env.RENDER_EXTERNAL_URL="https://ai.example";process.env.PIHUB_API_BASE_URL="https://hub.example";
 process.env.SMAJ_AI_CLIENT_ID="smaj-ai";process.env.SMAJ_AI_CLIENT_SECRET="test-only-client-secret-at-least-32-characters";process.env.SMAJ_AI_SSO_SECRET="test-only-sso-secret-at-least-32-characters";
 let reads=0,exchanges=0;
 const req=(path:string,cookie:string,body?:unknown)=>new NextRequest(`https://ai.example${path}`,{method:body===undefined?"GET":"POST",headers:{cookie,origin:"https://ai.example","content-type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});
 try{
  const login=await enter(req("/api/auth/demo","",{}));assert.equal(login.status,200);
  const demo=login.cookies.get(SESSION_COOKIE)!.value,demoCookie=`${SESSION_COOKIE}=${demo}`;
  const actor=requireActorSession(req("/",demoCookie));const db=workspaceDatabase(req("/",demoCookie));
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM delegations").get() && (db.prepare("SELECT COUNT(*) AS n FROM delegations").get() as {n:number}).n,0);
  const source=new AiTaskStore(db).create(actor.actorId,"Find cars under $30,000",plan);
  assert.equal((await start(req("/api/auth/search",demoCookie,{taskId:source.id,approved:false}))).status,400);
  assert.equal((await start(req("/api/auth/search","",{taskId:source.id,approved:true}))).status,401);
  assert.equal((await start(req("/api/auth/search",demoCookie,{taskId:"another-user-task",approved:true}))).status,404);
  const staged=await start(req("/api/auth/search",demoCookie,{taskId:source.id,approved:true}));assert.equal(staged.status,200);
  const token=staged.cookies.get(SEARCH_SIGNIN_COOKIE)!.value;assert.match(staged.headers.get("set-cookie")!,/HttpOnly/);
  const handoffCookie=`${demoCookie}; ${SEARCH_SIGNIN_COOKIE}=${token}`;
  const redirect=await authorize(req("/api/auth/sso",handoffCookie));assert.equal(redirect.status,307);
  const target=new URL(redirect.headers.get("location")!);assert.equal(target.origin,"https://hub.example");assert.equal(target.searchParams.get("redirect_uri"),"https://ai.example/api/auth/callback");
  const state=redirect.cookies.get(SSO_STATE_COOKIE)!.value;
  globalThis.fetch=async(input,init)=>{
   const url=new URL(String(input));
   if(url.pathname==="/sso/token"){
    exchanges++;const body=JSON.parse(String(init?.body));assert.equal(body.client_secret,process.env.SMAJ_AI_CLIENT_SECRET);
    const h=Buffer.from(JSON.stringify({alg:"HS256"})).toString("base64url");const p=Buffer.from(JSON.stringify({iss:"smajpihub",aud:"smaj-ai",sub:"verified-hub-owner",uid:"verified-pi-user",scope:"profile:read jobs:read store:read",exp:Math.floor(Date.now()/1000)+60})).toString("base64url");
    return Response.json({access_token:`${h}.${p}.${createHmac("sha256",process.env.SMAJ_AI_SSO_SECRET!).update(`${h}.${p}`).digest("base64url")}`});
   }
   if(url.pathname==="/marketplace/products"){reads++;assert.equal(init?.method,"GET");assert.equal(url.searchParams.get("category"),"Vehicles");assert.equal(url.searchParams.get("maxPrice"),"30000");assert.equal(url.searchParams.get("currency"),"USD");assert.equal(url.searchParams.has("search"),false);return Response.json({products:[{id:"fixture-car",title:"Lexus SUV",priceUsdt:22500,pricePi:1,imageUrl:"https://images.example/car.jpg"},{id:"fixture-bike",title:"Motorcycle",priceUsdt:2000},{id:"fixture-cover",title:"Car cover",priceUsdt:100},{id:"fixture-costly",title:"BMW sedan",priceUsdt:40000}]});}
   throw new Error("Meta analysis unavailable in this test; evidence must remain usable");
  };
  const cookies=`${handoffCookie}; ${SSO_STATE_COOKIE}=${state}`;
  const invalid=await callback(req("/api/auth/callback?code=one-time&state=wrong",cookies));assert.match(invalid.headers.get("location")!,/invalid_state/);assert.equal(exchanges,0);
  const completed=await callback(req(`/api/auth/callback?code=one-time&state=${state}`,cookies));assert.equal(exchanges,1);
  const location=new URL(completed.headers.get("location")!);assert.equal(location.origin,"https://ai.example");assert.equal(location.searchParams.get("resumeSearch"),"1");
  const taskId=location.searchParams.get("task")!;const signed=completed.cookies.get(SESSION_COOKIE)!.value;
  const signedCookie=`${SESSION_COOKIE}=${signed}; ${SEARCH_SIGNIN_COOKIE}=${token}`;
  const owner=requireActorSession(req("/",signedCookie));assert.equal(owner.actorId,"verified-hub-owner");assert.equal(owner.sandbox,undefined);assert.equal(reads,0);
  const production=workspaceDatabase(req("/",signedCookie));assert.equal(new AiTaskStore(production).get(owner.actorId,taskId).task,source.task);
  assert.throws(()=>new AiTaskStore(production).get("another-user",taskId));
  const context={params:Promise.resolve({id:taskId})};
  assert.equal((await discover(req("/api/tasks/id/discover",signedCookie.replace(token,"wrong"),{resume:true}),context)).status,409);assert.equal(reads,0);
  const searched=await discover(req("/api/tasks/id/discover",signedCookie,{resume:true}),context);assert.equal(searched.status,200);assert.equal(searched.cookies.get(SEARCH_SIGNIN_COOKIE)?.value, "");assert.equal(reads,1);
  const result=(await searched.json()).plan.discovery.results[0];assert.deepEqual(result.records.map((r:any)=>r.id),["fixture-car"]);assert.equal(result.records[0].price,"$22,500");assert.equal(result.records[0].imageUrl,"https://images.example/car.jpg");
  assert.equal(new ServiceConnectionStore(production).list(owner.actorId,"sso").find(c=>c.serviceId==="store")!.connected,true);
  assert.equal((await discover(req("/api/tasks/id/discover",signedCookie,{resume:true}),context)).status,409);assert.equal(reads,1);
  const expired=new SearchSignInStore(production);const handle=expired.create(source);expired.bind(handle,"state");production.prepare("UPDATE search_signins SET expires_at = 0").run();assert.throws(()=>expired.complete(handle,"state",owner.actorId));
 }finally{globalThis.fetch=fetcher;process.env=old;}
});

test("Jobs uses the same explicit approval, authentication and connected live-discovery path, including empty results",async()=>{
 const old={...process.env},fetcher=globalThis.fetch;
 process.env.SMAJ_DELEGATION_DB_PATH=":memory:";process.env.SMAJ_AI_SESSION_SECRET="test-only-session-secret-at-least-32";delete process.env.META_API_KEY;delete process.env.MODEL_API_KEY;delete process.env.SMAJ_AI_PUBLIC_URL;delete process.env.RENDER_EXTERNAL_URL;
 const {createUserSession}=await import("@/src/server/auth");const session=createUserSession({sub:"jobs-verified-owner",uid:"jobs-pi-owner"});
 const cookie=`${SESSION_COOKIE}=${session.value}`;
 const req=(body:unknown,credentials=cookie,origin="https://jobs.example")=>new NextRequest("https://jobs.example/api/tasks/id/discover",{method:"POST",headers:{cookie:credentials,origin,"content-type":"application/json"},body:JSON.stringify(body)});
 const db=workspaceDatabase(req({}));const jobsPlan:ServiceRoutePlan={...plan,services:["jobs"],steps:[{...plan.steps[0],serviceId:"jobs",query:{search:"jobs"}}]};
 let calls=0,empty=false;
 globalThis.fetch=async(input,init)=>{calls++;const url=new URL(String(input));assert.equal(url.pathname,"/jobs/jobs");assert.equal(url.searchParams.get("catalog_read"),"true");assert.equal(url.searchParams.has("search"),false);assert.equal(init?.method,"GET");return Response.json({jobs:empty?[]:[{id:"real-employer-job",title:"Engineer",employerId:"employer"},{id:"seed",title:"Unbacked seed"},{id:"demo",title:"Demo",employerId:"employer",isDemo:true}]});};
 try{
  const task=new AiTaskStore(db).create("jobs-verified-owner","Find current jobs",jobsPlan);const context={params:Promise.resolve({id:task.id})};
  assert.equal((await discover(req({approved:true},""),context)).status,401);assert.equal((await discover(req({approved:true},cookie,"https://evil.example"),context)).status,403);assert.equal((await discover(req({approved:false}),context)).status,400);assert.equal(calls,0);
  const found=await discover(req({approved:true}),context);assert.equal(found.status,200);const results=(await found.json()).plan.discovery.results;assert.deepEqual(results[0].records.map((r:any)=>r.id),["real-employer-job"]);assert.equal(calls,1);
  empty=true;const next=new AiTaskStore(db).create("jobs-verified-owner","Find current jobs",jobsPlan);const none=await discover(req({approved:true}),{params:Promise.resolve({id:next.id})});assert.equal(none.status,200);const payload=await none.json();assert.equal(payload.plan.discovery.results[0].records.length,0);assert.match(payload.plan.summary,/No matching listings/);
 }finally{globalThis.fetch=fetcher;process.env=old;}
});
