import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { POST as retiredLogin } from "@/app/api/auth/demo/route";
import { POST as tokenLogin, DELETE as logout, GET as sessionStatus } from "@/app/api/auth/session/route";
import { GET as oldHistory, POST as oldCreate } from "@/app/api/delegations/route";
import { POST as oldApprove } from "@/app/api/delegations/[id]/approve/route";
import { POST as oldExecute } from "@/app/api/delegations/[id]/execute/route";
import { requireActorSession, createUserSession, SESSION_COOKIE } from "@/src/server/auth";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { workspaceDatabase } from "@/src/server/workspace";

test("retired demo authentication and execution cannot be re-enabled by old environment settings; stored records are preserved", async()=>{
  const previous={...process.env};
  process.env.SMAJ_DEMO_AUTH_ENABLED="true";process.env.SMAJ_DEMO_ACCESS_TOKEN="old-test-only-token";
  process.env.SMAJ_AI_SESSION_SECRET="test-independent-session-secret-32-chars";process.env.SMAJ_DELEGATION_DB_PATH=":memory:";
  const cookie=`${SESSION_COOKIE}=${createUserSession({sub:"real-user",uid:"real-pi"}).value}`;
  const request=(value=cookie)=>new NextRequest("https://test.example/api/tasks",{method:"POST",headers:{cookie:value,origin:"https://test.example"},body:"{}"});
  try{
    const db=workspaceDatabase(request());const store=new AiTaskStore(db);
    store.create("real-user","Existing user record",{summary:"Existing answer",model:"previous-model",steps:[],services:[],warnings:[]});
    const visible=store.create("real-user","Real model request",{summary:"Fixture response",model:"fixture",ai:{provider:"meta",model:"fixture",responseId:"fixture",receivedAt:new Date().toISOString()},steps:[],services:[],warnings:[]});
    for(const handler of [retiredLogin,tokenLogin,oldHistory,oldCreate,oldApprove,oldExecute])assert.equal((await handler()).status,410);
    assert.throws(()=>requireActorSession(request(`${SESSION_COOKIE}=hackathon_old-token`)),/Sign in/);
    const encoded=Buffer.from(JSON.stringify({actorId:"old-user",authType:"demo",expiresAt:Date.now()+10000})).toString("base64url");
    const signed=`${encoded}.${createHmac("sha256",process.env.SMAJ_AI_SESSION_SECRET!).update(encoded).digest("base64url")}`;
    assert.throws(()=>requireActorSession(request(`${SESSION_COOKIE}=${signed}`)),/Authentication/);
    assert.equal((await sessionStatus(request())).status,200);
    assert.deepEqual(store.list("real-user").map(t=>t.id),[visible.id]);
    assert.equal((await logout(request())).status,200);
    assert.equal((db.prepare("SELECT COUNT(*) n FROM ai_tasks").get() as {n:number}).n,2);
  }finally{process.env=previous;}
});
