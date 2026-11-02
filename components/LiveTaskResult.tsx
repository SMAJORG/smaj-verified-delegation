"use client";
import { useEffect, useRef, useState } from "react";

import type { AiTask } from "@/src/server/ai-tasks";

function ResultImage({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="taskThumb">{src && !failed ? <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} /> : <span>{src ? "Image unavailable" : "No image provided"}</span>}</div>;
}

function ResultDescription({ children }: { children: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!children) return null;
  return <div className="taskDescription">
    <p className={expanded ? "" : "taskDescriptionClamp"}>{children}</p>
    {children.length > 120 && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "Read less" : "Read more"}</button>}
  </div>;
}

export default function LiveTaskResult({ task, busy, sandbox, discover, approve, retry, reportError }: { task: AiTask; busy: boolean; sandbox: boolean; discover: () => void; approve: (ids: string[]) => void; retry: () => void; reportError: (message: string) => void }) {
  const plan = task.plan;
  const [dismissed, setDismissed] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const lastReportedError = useRef("");
  const errors = [plan.summaryError?.message, ...(plan.discovery?.results.map(result => result.error) || []), plan.execution?.error].filter((message): message is string => Boolean(message));
  const errorDetails = errors.join("\n");
  useEffect(() => {
    const key = `${task.id}:${errorDetails}`;
    if (!errorDetails || lastReportedError.current === key) return;
    lastReportedError.current = key;
    reportError(errorDetails);
  }, [task.id, errorDetails, reportError]);
  const available = plan.services.some(id => ["jobs", "store", "stream"].includes(id));
  return <section className="liveTaskResults" aria-label="Live data and execution">
    {plan.steps.filter(step => step.status === "unavailable").map(step => <p className="taskResultMeta" key={step.id}>{step.reason}</p>)}
    {available && (!plan.discovery || plan.discovery.results.some(result=>result.status === "unavailable")) && !plan.execution && !dismissed && <div className="resultsApproval"><strong>Ready to continue?</strong><p>Search live listings and share listing details with Meta for analysis. No purchase or application will be made.</p><div className="resultsActions"><button className="primaryButton" disabled={busy} onClick={discover}>{busy ? "Searching…" : "Approve search"}</button><button className="secondaryButton" disabled={busy} onClick={() => setDismissed(true)}>Not now</button></div>{sandbox&&<p>Approve to sign in to SMAJ PI HUB and continue this search.</p>}</div>}
    {dismissed&&!plan.discovery&&<button className="taskViewLink" onClick={()=>setDismissed(false)}>Review search approval</button>}
    {plan.discovery && <>
      {plan.discovery.results.map(result => {
        const records = plan.summaryAi ? result.records.filter(value => plan.matches?.some(match => match.serviceId === result.serviceId && match.id === String((value as {id?:unknown}).id))) : result.records;
        const employerBacked = result.serviceId === "jobs" ? records.filter(value => (value as { listingProvenance?: string }).listingProvenance === "employer_backed") : [];
        const sampleJobs = result.serviceId === "jobs" ? records.filter(value => (value as { listingProvenance?: string }).listingProvenance !== "employer_backed") : [];
        const renderCards = (items: unknown[], sample = false) => <div className="taskResultCards">{items.map((value, index) => {
          const record = value as Record<string, unknown>;
          const id = typeof record.id === "string" ? record.id : "";
          const url = result.serviceId === "store" && id ? `https://smajpihub.com/product/${encodeURIComponent(id)}` : result.serviceId === "jobs" && id ? `https://smajpihub.com/services/jobs/job/${encodeURIComponent(id)}` : typeof record.url === "string" && /^https:\/\/smajpihub\.com\/app\/services\/stream\/(?:title|series|watch)\/[a-zA-Z0-9_-]+$/.test(record.url) ? record.url : undefined;
          const image = typeof record.imageUrl === "string" && /^https:\/\//i.test(record.imageUrl) ? record.imageUrl : undefined;
          const text = (key: string) => typeof record[key] === "string" && record[key] ? String(record[key]) : "";
          const matchReason = plan.matches?.find(match => match.serviceId === result.serviceId && match.id === id)?.reason;
          const details = [text("overview"), text("description"), text("summary")].find(Boolean);
          const skills = Array.isArray(record.skills) ? record.skills.filter((skill): skill is string => typeof skill === "string" && !!skill).join(", ") : "";
          const storeResult = result.serviceId === "store";
          return <article className="taskResultCard" key={id || index}>
            <ResultImage src={image} alt={text("title") || "Catalog result"} />
            <div className="taskResultInfo"><h3>{text("title") || "Title unavailable"}</h3>
            {storeResult && <p className="taskPrice">{record.price != null && String(record.price) !== "" ? String(record.price) : "Price not listed"}</p>}
            {!storeResult && record.price != null && String(record.price) !== "" && <p className="taskPrice">{String(record.price)}</p>}
            {record.salary != null && String(record.salary) !== "" && <p className="taskPrice">{String(record.salary)}</p>}
            {(storeResult || text("company") || text("creatorName") || text("sellerName")) && <p className="taskResultMeta">{storeResult ? `Seller: ${text("sellerName") || "Not listed"}` : text("company") || text("creatorName") || text("sellerName")}</p>}
            {(storeResult || text("location") || text("category")) && <p className="taskResultMeta">{storeResult ? `Location: ${text("location") || "Not listed"}` : [text("location"), text("category")].filter(Boolean).join(" · ")}</p>}
            {typeof record.quantity === "number" && Number.isFinite(record.quantity) && <p className="taskResultMeta">Quantity listed: {record.quantity}</p>}
            {(text("mode") || text("type")) && <p className="taskResultMeta">{[text("mode"), text("type")].filter(Boolean).join(" · ")}</p>}
            {skills && <p className="taskResultMeta">Skills: {skills}</p>}
            {(text("releaseDate") || typeof record.rating === "number") && <p className="taskResultMeta">{[text("releaseDate"), typeof record.rating === "number" ? `Rating ${record.rating}` : ""].filter(Boolean).join(" · ")}</p>}
            {details && <ResultDescription>{details}</ResultDescription>}
            {typeof matchReason === "string" && matchReason && <p className="taskResultMeta"><strong>Why it matches:</strong> {matchReason}</p>}
            {result.serviceId === "jobs" && !sample && <p className="taskResultMeta"><strong>{record.employerVerified === true ? "Verified employer" : "Employer not verified — applications unavailable"}</strong></p>}
            {sample && <p className="taskResultMeta"><strong>Sample Listing — Not Verified</strong><br />Applications are disabled for sample listings.</p>}
            {url && <a className="taskViewLink" href={url} target="_blank" rel="noreferrer">View {result.serviceId === "store" ? "product" : result.serviceId === "jobs" ? "job" : "content"} ↗</a>}
            </div>
          </article>;
        })}</div>;
        return <section key={result.serviceId}>
        <h3>{result.serviceId} · {result.status === "read" ? "Results" : "Unavailable"}</h3>
        {result.status === "unavailable" && result.error && <p>{result.error}</p>}
        {result.status === "read" && !records.length && <p>No matching listings were found. Try another search or a higher budget.</p>}
        {result.serviceId === "jobs" ? <>
          {!!employerBacked.length && <><h4>Employer-backed Listings</h4>{renderCards(employerBacked)}</>}
          {!!sampleJobs.length && <><h4>Sample Listings — Not Verified</h4><p>These listings are examples from the Hub catalog and cannot be used for applications.</p>{renderCards(sampleJobs, true)}</>}
        </> : renderCards(records)}
      </section>;})}
    </>}
    {!plan.execution && !!plan.proposedActions?.length && <div className="approvalBar"><div><h3>Review before submission</h3><p>Nothing is submitted until you approve the exact details below.</p>{plan.proposedActions.map(action => {
      const preview = action.applicationPreview;
      return <label className="liveAction" key={action.id}><input type="checkbox" checked={selected.includes(action.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, action.id] : ids.filter(id => id !== action.id))}/><span><strong>{action.title}</strong><small>{action.recordId}</small>{action.coverNote && <p><strong>Application note</strong><br />{action.coverNote}</p>}
        {action.kind === "apply" && (preview ? <div className="taskEvidence">
          <strong>Exact application details</strong>
          <p>Job: {preview.job.title} · {preview.job.company}</p>
          <p>Location: {preview.job.location} · {preview.job.type} · {preview.job.mode}</p>
          <p>Salary: {preview.job.salary} · Category: {preview.job.category}</p>
          <p>Profile: {preview.profile.title} · {preview.profile.skills.join(", ") || "No listed skills"}</p>
          <p>Profile location: {preview.profile.location || "Not specified"} · Photo: {preview.profile.profilePhoto || "not included"}</p>
          <p>Profile summary: {preview.profile.summary || "None"} · Portfolio: {preview.profile.portfolio || "None"}</p>
          <p>CV: {preview.cv.attached ? `Attached — ${preview.cv.name || "CV"} (${preview.cv.size || 0} bytes; ${preview.cv.visibility})` : `Not attached${preview.cv.visibility ? ` — visibility is ${preview.cv.visibility}` : ""}`}</p>
        </div> : <p>Sign in to SMAJ PI HUB to load your profile and CV sharing details before approval. No application has been submitted.</p>)}
      </span></label>;
    })}</div><button className="primaryButton" disabled={busy || sandbox || !selected.length} onClick={() => approve(selected)}>Approve {selected.length} live actions</button></div>}
    {plan.execution && <section aria-live="polite"><h3>Live execution · {plan.execution.status}</h3><details className="taskEvidence"><summary>Execution activity</summary><p>Approved {plan.execution.approvedAt} · Attempt {plan.execution.attempts}</p>{plan.execution.events?.map((event,index)=><p key={index}><small>{event.at}</small> · {event.message}</p>)}</details>{plan.execution.status === "failed" && plan.execution.retryable && <button className="secondaryButton" disabled={busy} onClick={retry}>Retry safely</button>}{plan.execution.receipt && <><p>Verified against Hub backend records · {plan.execution.receipt.verifiedAt}</p><a className="secondaryButton" href={`/api/tasks/${task.id}/receipt`} download>Download JSON receipt</a> <a className="secondaryButton" href={`/api/tasks/${task.id}/receipt/pdf`} download>Download PDF receipt</a></>}</section>}
  </section>;
}
