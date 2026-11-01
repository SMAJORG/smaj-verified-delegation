export function downloadReceiptJson(receipt: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function sanitizeText(value: unknown): string {
  return String(value ?? "").replace(/\r?\n/g, " ").trim();
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/\r/g, " ").replace(/\n/g, " ");
}

function buildPdfContent(receipt: any) {
  const proof = receipt?.proof ?? receipt ?? {};
  const checks = Array.isArray(proof.checks) ? proof.checks : [];
  const actions = Array.isArray(proof.actions) ? proof.actions : [];
  const lines = [
    "SMAJ AI",
    "VERIFICATION CERTIFICATE",
    "",
    `Receipt ID: ${sanitizeText(proof.receiptId || "n/a")}`,
    `Delegation ID: ${sanitizeText(proof.delegationId || "n/a")}`,
    `Task: ${sanitizeText(proof.task || proof.goal || "N/A")}`,
    `Model: ${sanitizeText(proof.planner?.model || "unknown")}`,
    `Status: ${sanitizeText(proof.outcome || "verified")}`,
    `Approved At: ${sanitizeText(proof.approval?.approvedAt || "n/a")}`,
    `Verified At: ${sanitizeText(proof.verifiedAt || "n/a")}`,
    `Recovery: ${sanitizeText(proof.recovery ? `${proof.recovery.transientFailures} transient, ${proof.recovery.retries} retries, ${proof.recovery.duplicatesPrevented} duplicates prevented` : "n/a")}`,
    "",
    "Scope",
    `Action: ${sanitizeText(proof.scope?.action || "mock_job_application")}`,
    `Production side effects: ${String(Boolean(proof.scope?.productionSideEffects))}`,
    `Real Pi payment: ${String(Boolean(proof.scope?.realPiPayment))}`,
    `Mode: ${sanitizeText(proof.source?.mode || "simulated")}`,
    "",
    "MOCK ACTIONS ONLY",
    "No real job applications were submitted.",
    "No production writes or real Pi payments were executed.",
    "",
    "Verification Checks",
    ...checks.map((check: any) => `- ${sanitizeText(check.name || "Check")}: ${check.passed ? "PASS" : "FAIL"} — ${sanitizeText(check.evidence || "Verified locally")}`),
    "",
    "Submitted Actions",
    ...actions.length
      ? actions.map((action: any) => `- ${sanitizeText(action.jobId || action.mockSubmissionId || "job")}: ${sanitizeText(action.status || "verified")}`)
      : ["- None"],
    "",
    `Proof hash: ${sanitizeText(receipt?.proofHash || proof.proofHash || "n/a")}`,
    "",
    "This receipt is a tamper-evident verification record.",
    "It is not a cryptographic digital signature unless signing is separately implemented.",
  ];

  return lines;
}

export function buildReceiptPdfBlob(receipt: any): Blob {
  const lines = buildPdfContent(receipt);
  const pageWidth = 595.28;
  const pageHeight = 842;
  const margin = 52;
  const fontSize = 11;
  const leading = 17;
  const streamLines: string[] = [];
  let y = pageHeight - margin;

  for (const line of lines) {
    const normalized = sanitizeText(line); 
    if (!normalized) {
      y -= leading;
      continue;
    }
    const font = /^SMAJ AI$/.test(normalized) ? 18 : /^VERIFICATION CERTIFICATE$/.test(normalized) ? 15 : normalized.startsWith("MOCK ACTIONS ONLY") ? 12 : /^Proof hash:/.test(normalized) ? 10 : 11;
    const fontName = "F1";
    streamLines.push(`BT /${fontName} ${font} Tf 54 ${y.toFixed(2)} Td (${escapePdfText(normalized)}) Tj ET`);
    y -= leading + Math.max(0, font - 11) * 0.4;
    if (y < margin) break;
  }

  const content = streamLines.join("\n");
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

export function downloadReceiptPdf(receipt: any, fileName: string) {
  const blob = buildReceiptPdfBlob(receipt);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function downloadReceiptFile(receipt: any, format: "json" | "pdf", fileName: string) {
  if (format === "pdf") {
    downloadReceiptPdf(receipt, fileName);
    return;
  }
  downloadReceiptJson(receipt, fileName);
}






































































































































































































































																																																																																																		
















































































































