"use client";
import { useState } from "react";
import { TypedResponse } from "@/components/TaskResponse";
import type { AiTask } from "@/src/server/ai-tasks";

export default function LiveTaskResult({ task, busy, sandbox, discover, approve }: { task: AiTask; busy: boolean; sandbox: boolean; discover: () => void; approve: (ids: string[]) => void }) {
  const plan = task.plan;
  const [selected, setSelected] = useState<string[]>([]);
  const download = (value: unknown, name: string) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  };
  const available = plan.services.some(id => ["jobs", "store", "stream"].includes(id));
  return <section className="routePlan liveTaskResults" aria-label="Live data and execution">
    {available && !plan.execution && <><p>Allow SMAJ AI to read the selected live catalogs and share listing details with Meta for analysis. No applications or purchases will be made.</p><button className="primaryButton" disabled={busy || sandbox} onClick={discover}>{busy ? "Please wait…" : "Approve search"}</button></>}
    {plan.discovery && <>
      <TypedResponse text={plan.discovery.results.some(result => result.status === "read") ? "Here's what I found based on your request." : "The live catalogs are currently unavailable. Please try again."}/>
      <details className="taskEvidence"><summary>Catalog evidence</summary><p>Retrieved {plan.discovery.completedAt}. Availability can change.</p><button className="secondaryButton" onClick={() => download(plan.discovery, `catalog-${task.id}.json`)}>Download JSON</button></details>
      {plan.summaryError && <p role="alert">{plan.summaryError.message} ({plan.summaryError.code}). No Meta analysis was received for these results.</p>}
      {plan.discovery.results.map(result => <section key={result.serviceId}>
        <h3>{result.serviceId} · {result.status === "read" ? "Live API data" : "Unavailable"}</h3>
        {result.error && <p role="alert">{result.error}</p>}
        {result.status === "read" && !result.records.length && <p>No published listings were returned for this search.</p>}
        <div className="taskResultCards">{result.records.map((value, index) => {
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
      </section>)}
    </>}
    {!plan.execution && !!plan.proposedActions?.length && <div className="approvalBar"><div><h3>Review live actions</h3><p>These actions change your real Jobs applications or Store saved products. Review each draft, then approve. Purchases and payments are unavailable.</p>{plan.proposedActions.map(action => <label className="liveAction" key={action.id}><input type="checkbox" checked={selected.includes(action.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, action.id] : ids.filter(id => id !== action.id))}/><span><strong>{action.title} · {action.kind}</strong><small>{action.recordId}</small>{action.coverNote && <p>{action.coverNote}</p>}</span></label>)}</div><button className="primaryButton" disabled={busy || sandbox || !selected.length} onClick={() => approve(selected)}>Approve {selected.length} live actions</button></div>}
    {plan.execution && <section aria-live="polite"><h3>Live execution · {plan.execution.status}</h3><details className="taskEvidence"><summary>Execution activity</summary><p>Approved {plan.execution.approvedAt} · Attempt {plan.execution.attempts}</p>{plan.execution.events?.map((event,index)=><p key={index}><small>{event.at}</small> · {event.message}</p>)}</details>{plan.execution.error && <p role="alert">{plan.execution.error}</p>}{plan.execution.receipt && <><p>Verified against Hub backend records · {plan.execution.receipt.verifiedAt}</p><code>{plan.execution.receipt.proofHash}</code><button className="secondaryButton" onClick={() => download({ taskId: task.id, request: task.task, approval: plan.execution, ai: plan.ai, analysis: plan.summaryAi }, `live-proof-${task.id}.json`)}>Download live proof receipt</button></>}</section>}
  </section>;
}
