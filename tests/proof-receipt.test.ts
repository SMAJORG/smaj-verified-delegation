import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { createUserSession, SESSION_COOKIE } from "@/src/server/auth";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { workspaceDatabase } from "@/src/server/workspace";
import { ServiceConnectionStore } from "@/src/server/service-connections";
import { LiveWorkflow } from "@/src/server/live-workflow";
import { genuineReceipt, receiptPdf } from "@/src/server/proof-receipt";
import { GET } from "@/app/api/tasks/[id]/receipt/route";
import { AppError } from "@/src/server/http";
import { taskState } from "@/src/domain/task-state";
import type { ServiceRoutePlan } from "@/src/domain/services";

test("PDF/JSON requires exact approved live evidence; phases reflect real adapter calls and no other user's receipt is exposed",async()=>{
  const previous={...process.env};
  Object.assign(process.env,{SMAJ_AI_SESSION_SECRET:"receipt-test-session-secret-32-characters",SMAJ_DELEGATION_DB_PATH:":memory:",SMAJ_AI_DELEGATION_SECRET:"receipt-capability-secret-at-least-32-characters",SMAJ_PRODUCTION_WRITES_ENABLED:"true"});
  const session={actorId:"receipt-owner",uid:"pi-owner",authType:"sso" as const};
  const request=(owner=session.actorId,format="json")=>new NextRequest(`https://test.example/api/tasks/t/receipt?format=${format}`,{headers:{cookie:`${SESSION_COOKIE}=${createUserSession({sub:owner,uid:"pi-owner"}).value}`}});
  const db=workspaceDatabase(request()),store=new AiTaskStore(db);
  const ai={provider:"meta" as const,model:"fixture-model",responseId:"fixture-response",receivedAt:new Date().toISOString()};
  const plan:ServiceRoutePlan={summary:"Fixture provider result",model:"fixture-model",ai,summaryAi:ai,services:["store"],steps:[],warnings:[],discovery:{approvedAt:ai.receivedAt,completedAt:ai.receivedAt,results:[],proofHash:"fixture"},actionReviewHash:"fixture-review",proposedActions:[{id:"save",serviceId:"store",kind:"save_product",recordId:"product",title:"Save product"}]};
  const task=store.create(session.actorId,"Save a published product",plan);const context={params:Promise.resolve({id:task.id})};
  let saved=false;const calls:string[]=[];
  const worker=new LiveWorkflow(db,{async perform(contract,action,operation){
    const current=store.get(session.actorId,task.id);calls.push(operation+":"+taskState(current.plan));
    assert.equal(current.plan.execution?.receipt,undefined);
    if(operation==="execute")saved=true;
    if(!saved)throw new AppError("hub_action_failed","Not saved yet",409);
    return {backendId:"backend-saved-id",ownerId:contract.ownerId,contractId:contract.taskId,serviceId:action.serviceId,kind:action.kind,recordId:action.recordId,status:"saved"};
  }});
  try{
    assert.equal((await GET(request(),context)).status,409);
    const connections=new ServiceConnectionStore(db);connections.list(session.actorId,"sso");connections.set(session.actorId,"store",true);
    worker.approve(session,task.id,["save"],"fixture-review");assert.equal((await GET(request(),context)).status,409);
    await worker.tick();assert.deepEqual(calls,["verify:Verifying","execute:Executing","verify:Verifying"]);
    const verified=store.get(session.actorId,task.id);assert.equal(taskState(verified.plan),"Completed");
    const exported=genuineReceipt(verified,session.actorId);assert.equal((exported.receipt.proof as any).evidence[0].backendId,"backend-saved-id");
    assert.match(new TextDecoder().decode(receiptPdf(exported)),/^%PDF-1.4/);
    assert.equal((await GET(request("other-user"),context)).status,404);
    const pdf=await GET(request(session.actorId,"pdf"),context);assert.equal(pdf.status,200);assert.equal(pdf.headers.get("content-type"),"application/pdf");assert.match(await pdf.text(),/backend-saved-id/);
    const json=await GET(request(),context);assert.equal(json.status,200);assert.equal((await json.json()).receipt.proofHash,verified.plan.execution?.receipt?.proofHash);
    const tampered=structuredClone(verified);(tampered.plan.execution!.receipt!.proof as any).evidence[0].ownerId="wrong-owner";
    tampered.plan.execution!.receipt!.proofHash=createHash("sha256").update(JSON.stringify(tampered.plan.execution!.receipt!.proof)).digest("hex");
    assert.throws(()=>genuineReceipt(tampered,session.actorId),/does not match/);
    const noReceipt=structuredClone(verified);delete noReceipt.plan.execution!.receipt;assert.equal(taskState(noReceipt.plan),"Verifying");assert.throws(()=>genuineReceipt(noReceipt,session.actorId),/requires completed/);
    const failed=structuredClone(verified);failed.plan.execution!.status="failed";assert.throws(()=>genuineReceipt(failed,session.actorId),/requires completed/);
  }finally{process.env=previous;}
});
