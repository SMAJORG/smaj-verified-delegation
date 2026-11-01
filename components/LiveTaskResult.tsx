"use client";
import { useState } from "react";

import type { AiTask } from "@/src/server/ai-tasks";

export default function LiveTaskResult({ task, busy, sandbox, discover, approve, retry }: { task: AiTask; busy: boolean; sandbox: boolean; discover: () => void; approve: (ids: string[]) => void; retry: () => void }) {
  const plan = task.plan;
  const [dismissed, setDismissed] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const available = plan.services.some(id => ["jobs", "store", "stream"].includes(id));
  return <section className="liveTaskResults" aria-label="Live data and execution">
    {available && (!plan.discovery || plan.discovery.results.some(result=>result.status === "unavailable")) && !plan.execution && !dismissed && <div className="resultsApproval"><strong>Ready to continue?</strong><p>Search live listings and share listing details with Meta for analysis. No purchase or application will be made.</p><div className="resultsActions"><button className="primaryButton" disabled={busy} onClick={discover}>{busy ? "Searching…" : "Approve search"}</button><button className="secondaryButton" disabled={busy} onClick={() => setDismissed(true)}>Not now</button></div>{sandbox&&<p>Approve to sign in to SMAJ PI HUB and continue this search.</p>}</div>}
    {dismissed&&!plan.discovery&&<button className="taskViewLink" onClick={()=>setDismissed(false)}>Review search approval</button>}
    {plan.discovery && <>
      {plan.summaryError && <p role="alert">AI analysis is unavailable. You can still review the listings below.</p>}
      {plan.discovery.results.map(result => {
        const records = plan.summaryAi && result.serviceId !== "jobs" ? result.records.filter(value => plan.matches?.some(match => match.serviceId === result.serviceId && match.id === String((value as {id?:unknown}).id))) : result.records;
        return <section key={result.serviceId}>
        <h3>{result.serviceId} · {result.status === "read" ? "Results" : "Unavailable"}</h3>
        {result.error && <p role="alert">{result.error}</p>}
        {result.status === "read" && !records.length && <p>No matching listings were found. Try another search or a higher budget.</p>}
        <div className="taskResultCards">{records.map((value, index) => {
          const record = value as Record<string, unknown>;
          const id = typeof record.id === "string" ? record.id : "";
          const url = result.serviceId === "store" && id ? `https://smajpihub.com/product/${encodeURIComponent(id)}` : result.serviceId === "jobs" && id ? `https://smajpihub.com/services/jobs/job/${encodeURIComponent(id)}` : typeof record.url === "string" && /^https:\/\/smajpihub\.com\/app\/services\/stream\/watch\/[a-zA-Z0-9_-]+$/.test(record.url) ? record.url : undefined;
          const image = typeof record.imageUrl === "string" && /^https:\/\//i.test(record.imageUrl) ? record.imageUrl : undefined;
          return <article className="taskResultCard" key={id || index}>
            <div className="taskThumb">{image ? <img src={image} alt={String(record.title || "Listing")} loading="lazy" onError={event => { event.currentTarget.hidden = true; }}/>: <span>No image</span>}</div>
            <div className="taskResultInfo"><h3>{String(record.title || "Untitled listing")}</h3>
            {record.price != null && <p className="taskPrice">{String(record.price)}</p>}
            {record.salary != null && <p className="taskPrice">{String(record.salary)}</p>}
            <p className="taskResultMeta">{String(record.company || record.creatorName || record.sellerName || "SMAJ PI HUB")}</p>
            {url && <a className="taskViewLink" href={url} target="_blank" rel="noreferrer">View {result.serviceId === "store" ? "product" : result.serviceId === "jobs" ? "job" : "content"} ↗</a>}
            </div>
          </article>;
        })}</div>
      </section>;})}
    </>}
    {!plan.execution && !!plan.proposedActions?.length && <div className="approvalBar"><div><h3>Ready to continue?</h3><p>Review the selected applications or saved products before approving. No purchase or payment will be made.</p>{plan.proposedActions.map(action => <label className="liveAction" key={action.id}><input type="checkbox" checked={selected.includes(action.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, action.id] : ids.filter(id => id !== action.id))}/><span><strong>{action.title}</strong><small>{action.recordId}</small>{action.coverNote && <p>{action.coverNote}</p>}</span></label>)}</div><button className="primaryButton" disabled={busy || sandbox || !selected.length} onClick={() => approve(selected)}>Approve {selected.length} live actions</button></div>}
    {plan.execution && <section aria-live="polite"><h3>Live execution · {plan.execution.status}</h3><details className="taskEvidence"><summary>Execution activity</summary><p>Approved {plan.execution.approvedAt} · Attempt {plan.execution.attempts}</p>{plan.execution.events?.map((event,index)=><p key={index}><small>{event.at}</small> · {event.message}</p>)}</details>{plan.execution.error && <p role="alert">{plan.execution.error}</p>}{plan.execution.status === "failed" && plan.execution.retryable && <button className="secondaryButton" disabled={busy} onClick={retry}>Retry safely</button>}{plan.execution.receipt && <><p>Verified against Hub backend records · {plan.execution.receipt.verifiedAt}</p><a className="secondaryButton" href={`/api/tasks/${task.id}/receipt`} download>Download JSON receipt</a> <a className="secondaryButton" href={`/api/tasks/${task.id}/receipt/pdf`} download>Download PDF receipt</a></>}</section>}
  </section>;
}
