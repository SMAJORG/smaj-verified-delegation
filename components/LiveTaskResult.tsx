"use client";
import { useState } from "react";
import type { AiTask } from "@/src/server/ai-tasks";
import CatalogResultCard from "./CatalogResultCard";
import { taskState } from "@/src/domain/task-state";

export default function LiveTaskResult({task,busy,discover,cancel,approve}:{task:AiTask;busy:boolean;discover:()=>void;cancel:()=>void;approve:(ids:string[],bindingConfirmed:boolean)=>void}) {
  const plan=task.plan;
  const [selected,setSelected]=useState<string[]>([]);const [bindingConfirmed,setBindingConfirmed]=useState(false);
  const available=plan.services.some(id=>["jobs","store","stream"].includes(id));
  const needsPermission=available&&!plan.execution&&(!plan.discovery||plan.summaryError||plan.searchCancelledAt);
  const binding=(plan.proposedActions||[]).some(action=>selected.includes(action.id)&&action.kind==="apply");
  return <section className="taskResults" aria-label="Service results and approved actions">
    {needsPermission&&<section className="permissionCard"><h3>SMAJ AI needs your permission</h3><p>{task.task}</p><small>Search the selected services and let Meta analyze the returned listings. No purchase, payment or application is authorized.</small><div className="permissionButtons"><button className="primaryButton" disabled={busy} onClick={discover}>{busy?"Searching…":"Approve & Search"}</button><button className="secondaryButton" disabled={busy||Boolean(plan.searchCancelledAt)} onClick={cancel}>Cancel</button></div>{plan.searchCancelledAt&&<p role="status">Search cancelled. No new service request was sent.</p>}</section>}
    {plan.summaryError&&<p className="errorBanner" role="alert">{plan.summaryError.message} ({plan.summaryError.code}). The saved records below are backend data; no Meta analysis was received.</p>}
    {plan.discovery?.results.map(result=>{
      const rows=plan.summaryAi&&!plan.summaryError?result.records.filter(value=>plan.matches?.some(match=>match.serviceId===result.serviceId&&match.id===(value as {id:string}).id)):result.records;
      return <section key={result.serviceId}><h3>{result.serviceId} · {result.status==="read"?"Results":"Unavailable"}</h3>{result.error&&<p role="alert">{result.error}</p>}{result.status==="read"&&!rows.length&&<p>No matching published listings were found in the returned catalog.</p>}<div className="catalogResults">{rows.map((value,index)=>{const record=value as Record<string,unknown>;return <CatalogResultCard key={String(record.id||index)} service={result.serviceId} record={record} reason={plan.matches?.find(match=>match.serviceId===result.serviceId&&match.id===record.id)?.reason}/>;})}</div></section>;
    })}
    {!plan.execution&&!!plan.proposedActions?.length&&<section className="permissionCard"><h3>Review supported actions</h3>{plan.proposedActions.map(action=><label className="liveAction" key={action.id}><input type="checkbox" checked={selected.includes(action.id)} disabled={busy} onChange={event=>{setBindingConfirmed(false);setSelected(ids=>event.target.checked?[...ids,action.id]:ids.filter(id=>id!==action.id));}}/><span><strong>{action.title}</strong><small>{action.kind} · {action.recordId}</small>{action.coverNote&&<p>{action.coverNote}</p>}</span></label>)}{binding&&<label className="liveAction"><input type="checkbox" checked={bindingConfirmed} onChange={event=>setBindingConfirmed(event.target.checked)}/><span>I explicitly confirm submitting the selected application drafts to these employers.</span></label>}<button className="primaryButton" disabled={busy||!selected.length||(binding&&!bindingConfirmed)} onClick={()=>approve(selected,bindingConfirmed)}>Approve {selected.length} actions</button><small>Purchases and payments continue through the existing Hub checkout with separate confirmation.</small></section>}
    {plan.execution&&<section className="routePlan" aria-live="polite"><h3>{taskState(plan)}</h3>{plan.execution.events?.map((event,index)=><p key={index}><small>{event.at}</small> · {event.message}</p>)}{plan.execution.error&&<p role="alert">{plan.execution.error}</p>}{plan.execution.receipt&&<><p>Backend records verified · {plan.execution.receipt.verifiedAt}</p><code>{plan.execution.receipt.proofHash}</code><div className="permissionButtons"><a className="secondaryButton" href={`/api/tasks/${task.id}/receipt?format=pdf`}>Download PDF proof</a><a className="secondaryButton" href={`/api/tasks/${task.id}/receipt?format=json`}>Download JSON proof</a></div></>}</section>}
  </section>;
}
