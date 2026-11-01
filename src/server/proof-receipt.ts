import { createHash } from "node:crypto";
import type { AiTask } from "@/src/server/ai-tasks";
import { AppError } from "@/src/server/http";

export function genuineReceipt(task: AiTask, owner: string) {
  const execution = task.plan.execution;
  const receipt = execution?.receipt;
  if (!task.plan.ai || !task.plan.summaryAi || execution?.status !== "verified" || receipt?.mode !== "live") throw new AppError("receipt_unavailable", "A proof receipt requires completed backend verification of approved live actions", 409);
  const proof = receipt.proof as { contract?: { ownerId?: string; taskId?: string; approvedAt?: string; bindingConfirmed?: boolean }; actions?: Array<{kind:string;serviceId:string;recordId:string}>; mode?: string; evidence?: Array<Record<string,unknown>>; verifiedAt?: string };
  if (!proof || proof.mode !== "live" || proof.contract?.ownerId !== owner || proof.contract.taskId !== task.id || proof.contract.approvedAt !== execution.approvedAt || (!proof.verifiedAt || proof.verifiedAt !== receipt.verifiedAt) || !Array.isArray(proof.actions) || !proof.actions.length || !Array.isArray(proof.evidence) || proof.actions.length !== proof.evidence.length || JSON.stringify(proof.actions) !== JSON.stringify(execution.actions) || proof.actions.some((action,index) => {
    const row=proof.evidence![index];
    return (action.kind === "apply" && proof.contract?.bindingConfirmed !== true) || !row || row.ownerId!==owner || row.contractId!==task.id || row.kind!==action.kind || row.serviceId!==action.serviceId || row.recordId!==action.recordId || typeof row.backendId!=="string" || !row.backendId || (action.kind === "apply" ? !["submitted","reviewing","shortlisted","hired","rejected"].includes(String(row.status)) : action.kind !== "save_product" || row.status !== "saved");
  }) || createHash("sha256").update(JSON.stringify(proof)).digest("hex") !== receipt.proofHash) throw new AppError("invalid_receipt", "Stored receipt does not match approved actions and genuine backend evidence", 409);
  return { taskId: task.id, request: task.task, planner: task.plan.ai, analysis: task.plan.summaryAi, receipt };
}

// Self-contained PDF with wrapped text and multiple pages. Non-ASCII characters
// are represented with Unicode escape notation; the JSON export preserves text.
export function receiptPdf(value: ReturnType<typeof genuineReceipt>): Uint8Array {
  const proof = value.receipt.proof as any;
  const sourceLines = ["SMAJ AI - Verified Delegation", "LIVE EXECUTION PROOF RECEIPT", "", `Task: ${value.taskId}`, `Request: ${value.request}`, `Model: ${value.analysis.model}`, `Response: ${value.analysis.responseId || "Not supplied by provider"}`, `Approved: ${proof.contract.approvedAt}`, `Verified: ${proof.verifiedAt}`, "", "Backend records checked at the verification timestamp:", ...proof.evidence.map((row:any)=>`${row.serviceId} / ${row.kind}: ${row.recordId} | Backend ID: ${row.backendId} | Status: ${row.status}`), "", `SHA-256: ${value.receipt.proofHash}`, "", "Full proof (also available as JSON):", JSON.stringify(proof), "", "This hash records evidence integrity; it is not a digital signature."];
  const lines = sourceLines.flatMap(line => {
    const ascii=String(line).replace(/[^\x20-\x7e]/gu,char=>`\\u{${char.codePointAt(0)!.toString(16)}}`);
    return ascii.match(/.{1,85}/g)||[""];
  });
  const pages: string[][]=[]; for(let i=0;i<lines.length;i+=46)pages.push(lines.slice(i,i+46));
  const objects:string[]=["", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  const pageIds:number[]=[];
  for(const page of pages){
    const pageId=objects.length+1, streamId=pageId+1;pageIds.push(pageId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`);
    const stream=page.map((line,index)=>`BT /F1 10 Tf 42 ${798-index*16} Td (${line.replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)")}) Tj ET`).join("\n");
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  objects[0]="<< /Type /Catalog /Pages 2 0 R >>";objects[1]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  let pdf="%PDF-1.4\n";const offsets=[0];
  objects.forEach((object,index)=>{offsets.push(pdf.length);pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;});
  const xref=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(const offset of offsets.slice(1))pdf+=`${String(offset).padStart(10,"0")} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
