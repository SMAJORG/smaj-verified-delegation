"use client";
import { useState } from "react";
import type { AiTask } from "@/src/server/ai-tasks";

export default function LiveTaskResult({ task, busy, discover, approve }: { task: AiTask; busy: boolean; discover: () => void; approve: (ids: string[]) => void }) {
  const plan = task.plan;
  const [selected, setSelected] = useState<string[]>([]);
  const available = plan.services.some(id => ["jobs", "store", "stream"].includes(id));
  return <section className="routePlan" aria-label="Live data and execution">
    {available && !plan.execution && <><p>Approve reading the proposed Jobs, Store or Stream catalogs and sharing listing metadata with Meta for analysis. This also connects the proposed available apps for read-only discovery. This does not submit applications or save products.</p><button className="primaryButton" disabled={busy} onClick={discover}>{busy ? "Please wait…" : "Approve read-only discovery"}</button></>}
    {plan.discovery && <>
      <p>Live API reads · {plan.discovery.completedAt}. These records describe the returned catalog page; availability can change.</p>

      {plan.summaryError && <p role="alert">{plan.summaryError.message} ({plan.summaryError.code}). No Meta analysis was received for these results.</p>}
      {plan.discovery.results.map(result => <section key={result.serviceId}>
        <h3>{result.serviceId} · {result.status === "read" ? "Live API data" : "Unavailable"}</h3>
        {result.error && <p role="alert">{result.error}</p>}
        {result.status === "read" && !result.records.length && <p>No published listings were returned for this search.</p>}
        <div className="jobCards">{result.records.map((value, index) => { const record = value as Record<string, unknown>; const match = plan.matches?.find(m => m.serviceId === result.serviceId && m.id === record.id); return <article key={String(record.id || index)}><h3>{String(record.title)}</h3><p>{String(record.company || record.creatorName || record.sellerName || "")}</p><p>{String(record.summary || record.description || "")}</p>{Boolean(record.price) && <p>{String(record.price)}{record.priceUsdt != null ? ` · ${record.priceUsdt} USDT reference` : ""}</p>}{match && <p>{match.reason}</p>}<small>Record ID: {String(record.id)}</small></article>; })}</div>
      </section>)}
    </>}
    {!plan.execution && !!plan.proposedActions?.length && <div className="approvalBar"><div><h3>Review live actions</h3><p>These actions change your real Jobs applications or Store saved products. Review each draft, then approve. Purchases and payments are unavailable.</p>{plan.proposedActions.map(action => <label className="liveAction" key={action.id}><input type="checkbox" checked={selected.includes(action.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, action.id] : ids.filter(id => id !== action.id))}/><span><strong>{action.title} · {action.kind}</strong><small>{action.recordId}</small>{action.coverNote && <p>{action.coverNote}</p>}</span></label>)}</div><button className="primaryButton" disabled={busy || !selected.length} onClick={() => approve(selected)}>Approve {selected.length} live actions</button></div>}
    {plan.execution && <section aria-live="polite"><h3>Live execution · {plan.execution.status === "verified" && plan.execution.receipt ? "Completed" : plan.execution.status === "running" ? "Executing" : plan.execution.status === "verifying" ? "Verifying" : plan.execution.status}</h3><p>Approved {plan.execution.approvedAt} · Attempt {plan.execution.attempts}. A separate worker processes persisted approvals, including after this page closes.</p>{plan.execution.events?.map((event,index)=><p key={index}><small>{event.at}</small> · {event.message}</p>)}{plan.execution.error && <p role="alert">{plan.execution.error}</p>}{plan.execution.receipt && <><p>Verified against Hub backend records · {plan.execution.receipt.verifiedAt}</p><code>{plan.execution.receipt.proofHash}</code><a className="secondaryButton" href={`/api/tasks/${task.id}/receipt?format=pdf`}>Download PDF proof</a> <a className="secondaryButton" href={`/api/tasks/${task.id}/receipt?format=json`}>Download JSON proof</a></>}</section>}
  </section>;
}
