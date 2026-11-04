"use client";
import { useEffect, useRef, useState } from "react";

import type { AiTask } from "@/src/server/ai-tasks";
import type { StoreMessageEvidence } from "@/src/domain/services";

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

export default function LiveTaskResult({ task, busy, sandbox, approve, updateSellerMessage, cancelSellerAction, retry, refreshActionUpdates, reportError }: { task: AiTask; busy: boolean; sandbox: boolean; approve: (taskId: string, ids: string[]) => void; updateSellerMessage?: (taskId: string, actionId: string, message: string) => Promise<boolean>; cancelSellerAction?: (taskId: string, actionId: string) => void; retry: (taskId: string) => void; refreshActionUpdates?: (taskId: string) => void; reportError: (message: string) => void }) {
  const plan = task.plan;
  const [selected, setSelected] = useState<string[]>([]);
  const [editingSellerMessage, setEditingSellerMessage] = useState(false);
  const [sellerMessage, setSellerMessage] = useState("");
  const lastReportedError = useRef("");
  const errors = [...new Set([plan.summaryError?.message, ...(plan.discovery?.results.map(result => result.error) || []), plan.execution?.error].filter((message): message is string => Boolean(message)))];
  const errorDetails = errors.join("\n");
  const sellerConversation = plan.execution?.evidence?.find(item => Boolean(item) && typeof item === "object" && (item as Record<string, unknown>).kind === "contact_seller") as Record<string, unknown> | undefined;
  const pendingOrder = plan.execution?.evidence?.find(item => Boolean(item) && typeof item === "object" && (item as Record<string, unknown>).kind === "create_order") as Record<string, unknown> | undefined;
  const orderAction = plan.execution?.actions.find(item => item.kind === "create_order");
  const sellerAction = plan.proposedActions?.find((action): action is Extract<typeof action, { kind: "contact_seller" }> => action.kind === "contact_seller");
  const isSellerContactFollowUp = Boolean(plan.selectedStoreProduct && sellerAction);
  const sellerProductRecord = sellerAction && plan.discovery?.results.flatMap(result => result.records).find(value => String((value as { id?: unknown }).id) === sellerAction.recordId) as Record<string, unknown> | undefined;
  const sellerImage = sellerProductRecord && typeof sellerProductRecord.imageUrl === "string" && /^https:\/\//i.test(sellerProductRecord.imageUrl) ? sellerProductRecord.imageUrl : undefined;
  useEffect(() => {
    setSellerMessage(sellerAction?.message || "");
    setEditingSellerMessage(false);
  }, [sellerAction?.id, sellerAction?.message]);
  useEffect(() => {
    const key = `${task.id}:${errorDetails}`;
    if (!errorDetails || lastReportedError.current === key) return;
    lastReportedError.current = key;
    reportError(errorDetails);
  }, [task.id, errorDetails, reportError]);
  return <section className="liveTaskResults" aria-label="Live data and execution">
    {plan.discovery && !isSellerContactFollowUp && <>
      {plan.discovery.results.map(result => {
        const records = plan.summaryAi && result.serviceId !== "stream" ? result.records.filter(value => plan.matches?.some(match => match.serviceId === result.serviceId && match.id === String((value as {id?:unknown}).id))) : result.records;
        const employerBacked = result.serviceId === "jobs" ? records.filter(value => (value as { listingProvenance?: string }).listingProvenance === "employer_backed") : [];
        const sampleJobs = result.serviceId === "jobs" ? records.filter(value => (value as { listingProvenance?: string }).listingProvenance !== "employer_backed") : [];
        const renderCards = (items: unknown[], sample = false) => <div
          className={`taskResultCards taskResultCarousel${items.length === 1 ? " taskResultCarouselSingle" : ""}`}
          role={items.length > 1 ? "region" : undefined}
          aria-label={items.length > 1 ? `${result.serviceId} results` : undefined}
          tabIndex={items.length > 1 ? 0 : undefined}
        >{items.map((value, index) => {
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
        {result.status === "read" && !records.length && <p>No matching listings were found. Try another search or a higher budget.</p>}
        {result.serviceId === "jobs" ? <>
          {!!employerBacked.length && <><h4>Employer-backed Listings</h4>{renderCards(employerBacked)}</>}
          {!!sampleJobs.length && <><h4>Sample Listings — Not Verified</h4><p>These listings are examples from the Hub catalog and cannot be used for applications.</p>{renderCards(sampleJobs, true)}</>}
        </> : renderCards(records)}
      </section>;})}
    </>}
    {!plan.execution && sellerAction && <section className="sellerApprovalCard" aria-labelledby={`seller-review-${sellerAction.id}`}>
      <div className="sellerApprovalHeading"><span className="sellerApprovalCheck" aria-hidden="true">✓</span><div><h3 id={`seller-review-${sellerAction.id}`}>Request analyzed</h3><p>Verified Delegation · review the exact message before it is sent</p></div><span className="sellerApprovalStatus">Awaiting approval</span></div>
      <div className="sellerApprovalProduct">
        <ResultImage src={sellerImage} alt={sellerAction.storePreview?.product.title || "Selected product"} />
        <div><span className="sellerApprovalEyebrow">Selected SMAJ Store product</span><h4>{sellerAction.storePreview?.product.title || sellerAction.title}</h4>
          <p>Seller: {sellerAction.storePreview?.product.sellerName || "Not listed"}</p>
          {sellerAction.storePreview && <p>{sellerAction.storePreview.product.pricePi} Pi · {sellerAction.storePreview.product.quantityAvailable} available</p>}
          {sellerAction.storePreview && <a className="taskViewLink" href={`https://smajpihub.com/product/${encodeURIComponent(sellerAction.recordId)}`} target="_blank" rel="noreferrer">View product ↗</a>}
        </div>
      </div>
      <div className="sellerApprovalMessage">
        <div className="sellerApprovalMessageHeading"><strong>Proposed message to seller</strong><span>Not sent</span></div>
        {editingSellerMessage
          ? <textarea aria-label="Edit proposed seller message" maxLength={1000} value={sellerMessage} onChange={event => setSellerMessage(event.target.value)} />
          : <blockquote>{sellerAction.message}</blockquote>}
      </div>
      <p className="sellerApprovalNotice">SMAJ AI will contact the seller only after you explicitly approve this message.</p>
      <div className="resultsActions">
        {editingSellerMessage
          ? <><button type="button" className="primaryButton" disabled={busy || !updateSellerMessage || !sellerMessage.trim() || sellerMessage.trim() === sellerAction.message} onClick={async()=>{if(updateSellerMessage&&await updateSellerMessage(task.id,sellerAction.id,sellerMessage))setEditingSellerMessage(false);}}>Save message</button><button type="button" className="secondaryButton" disabled={busy} onClick={()=>{setSellerMessage(sellerAction.message);setEditingSellerMessage(false);}}>Discard edit</button></>
          : <button type="button" className="secondaryButton" disabled={busy} onClick={()=>setEditingSellerMessage(true)}>Edit Message</button>}
        <button type="button" className="primaryButton" disabled={busy || sandbox || editingSellerMessage || !plan.actionReviewHash} onClick={()=>approve(task.id,[sellerAction.id])}>Approve & contact seller</button>
        <button type="button" className="secondaryButton" disabled={busy || !cancelSellerAction} onClick={()=>cancelSellerAction?.(task.id,sellerAction.id)}>Cancel</button>
      </div>
    </section>}
    {!plan.execution && !!plan.proposedActions?.filter(action=>action.kind!=="contact_seller").length && <div className="approvalBar"><div><h3>Review before submission</h3><p>Nothing is submitted until you approve the exact details below.</p>{plan.proposedActions.filter(action=>action.kind!=="contact_seller").map(action => {
      const preview = action.kind === "apply" ? action.applicationPreview : undefined;
      const storePreview = action.kind === "create_order" ? action.storePreview : undefined;
      return <label className="liveAction" key={action.id}><input type="checkbox" checked={selected.includes(action.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, action.id] : ids.filter(id => id !== action.id))}/><span><strong>{action.title}</strong><small>{action.recordId}</small>{action.kind === "apply" && <p><strong>Application note</strong><br />{action.coverNote}</p>}
        {action.kind === "create_order" && <div className="taskEvidence"><strong>Pending order review</strong>{storePreview&&<p>{action.quantity} × {storePreview.product.title} · {storePreview.product.sellerName} · {(storePreview.product.pricePi*action.quantity).toFixed(7).replace(/0+$/,"").replace(/\.$/,"")} Pi</p>}<p>Approval reserves the item in SMAJ PI HUB. Payment stays pending; you must separately complete checkout.</p></div>}
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
    })}</div><button className="primaryButton" disabled={busy || sandbox || !selected.length} onClick={() => approve(task.id, selected)}>Approve {selected.length} live actions</button></div>}
    {plan.cancelledActions?.map(({action,cancelledAt})=>action.kind==="contact_seller"&&<section className="sellerCancelledNotice" key={`${action.id}-${cancelledAt}`} aria-live="polite"><strong>Seller request cancelled</strong><p>No message was sent. The proposed message to {action.storePreview?.product.sellerName || "the seller"} about {action.storePreview?.product.title || action.title} was cancelled.</p><small>{cancelledAt}</small></section>)}
    {plan.execution && <section aria-live="polite"><h3>Live execution · {plan.execution.status === "verified" ? "Verified complete" : plan.execution.status === "queued" ? "Approved · queued for execution" : plan.execution.status === "running" ? "Executing approved action" : plan.execution.status === "retrying" ? "Retrying approved action" : "Action failed"}</h3>{plan.execution.actions.some(action=>action.kind==="contact_seller")&&<section className="taskEvidence"><h4>Seller conversation</h4>{refreshActionUpdates&&<button type="button" className="secondaryButton" disabled={busy} onClick={()=>refreshActionUpdates(task.id)}>Refresh seller replies</button>}{Array.isArray(sellerConversation?.messages)&&sellerConversation.messages.map((value,index)=>{const message=value as StoreMessageEvidence;return <p key={message.id||index}><strong>{message.senderName||message.senderId}</strong> · {message.createdAt}<br/>{message.message}</p>;})}{!Array.isArray(sellerConversation?.messages)&&<p>{plan.execution.status==="verified"?"No seller replies have been retrieved yet.":"The approved action has not been verified as sent yet."}</p>}</section>}{pendingOrder&&orderAction&&<section className="taskEvidence"><h4>SMAJ PI HUB order</h4><p>Order status: {String(pendingOrder.status)} · Payment status: {String(pendingOrder.paymentStatus)} · Total: {String(pendingOrder.totalPricePi)} Pi</p><p>Payment has not been initiated by SMAJ AI. Complete payment only in the secure SMAJ PI HUB checkout.</p>{refreshActionUpdates&&<button type="button" className="secondaryButton" disabled={busy} onClick={()=>refreshActionUpdates(task.id)}>Refresh order status</button>}{pendingOrder.paymentStatus==="pending"&&<a className="taskViewLink" href={`https://smajpihub.com/product/${encodeURIComponent(orderAction.recordId)}`} target="_blank" rel="noreferrer">Open SMAJ PI HUB to continue checkout ↗</a>}</section>}<details className="taskEvidence"><summary>Execution activity</summary><p>Approved {plan.execution.approvedAt} · Attempt {plan.execution.attempts}</p>{plan.execution.events?.map((event,index)=><p key={index}><small>{event.at}</small> · {event.message}</p>)}</details>{plan.execution.status === "failed" && plan.execution.retryable && <button className="secondaryButton" disabled={busy} onClick={()=>retry(task.id)}>Retry safely</button>}{plan.execution.receipt && <><p>Verified against Hub backend records · {plan.execution.receipt.verifiedAt}</p><a className="secondaryButton" href={`/api/tasks/${task.id}/receipt`} download>Download JSON receipt</a> <a className="secondaryButton" href={`/api/tasks/${task.id}/receipt/pdf`} download>Download PDF receipt</a></>}</section>}
  </section>;
}
