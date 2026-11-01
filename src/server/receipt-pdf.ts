import type { LiveExecution } from "@/src/domain/services";

const pdfText = (value: unknown) => String(value ?? "")
  .normalize("NFKD").replace(/[^\x20-\x7E]/g, "")
  .replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

/** Builds a small, standards-compliant PDF from an already verified live receipt. */
export function verifiedReceiptPdf(taskId: string, task: string, execution: LiveExecution) {
  if (execution.status !== "verified" || !execution.receipt) throw new Error("A verified execution receipt is required");
  const receipt = execution.receipt;
  const evidence = receipt.evidence as Array<Record<string, unknown>>;
  const lines = [
    "SMAJ AI VERIFIED DELEGATION RECEIPT",
    "",
    `Task: ${taskId}`,
    `Request: ${task}`,
    `Outcome: VERIFIED against SMAJ PI HUB backend records`,
    `Verified at: ${receipt.verifiedAt}`,
    `Proof SHA-256: ${receipt.proofHash}`,
    "",
    "Verified actions:",
    ...execution.actions.map((action, index) => {
      const record = evidence[index] || {};
      return `${index + 1}. ${action.kind} ${action.recordId} - backend record ${String(record.backendId || "")}, status ${String(record.status || "")}`;
    }),
    "",
    "This receipt records only actions independently verified against Hub records.",
  ].flatMap(line => {
    const clean = pdfText(line);
    const chunks: string[] = [];
    for (let i = 0; i < clean.length; i += 88) chunks.push(clean.slice(i, i + 88));
    return chunks.length ? chunks : [""];
  }).slice(0, 42);
  const stream = `BT\n/F1 10 Tf\n50 790 Td\n14 TL\n${lines.map(line => `(${line}) Tj\nT*`).join("\n")}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n%SMJ\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "ascii");
}
