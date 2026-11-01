import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import type { ServiceRoutePlan } from "@/src/domain/services";
import { createUserSession, SESSION_COOKIE } from "@/src/server/auth";
import { createDatabase } from "@/src/server/database";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { verifiedReceiptPdf } from "@/src/server/receipt-pdf";
import { GET as getReceipt } from "@/app/api/tasks/[id]/receipt/route";
import { GET as getPdf } from "@/app/api/tasks/[id]/receipt/pdf/route";

test("receipt downloads contain the hash-checked, independently verified Hub evidence and enforce task ownership", async () => {
  const previous = { ...process.env };
  const dir = mkdtempSync(join(tmpdir(), "smaj-receipt-"));
  process.env.SMAJ_DELEGATION_DB_PATH = join(dir, "receipt.sqlite");
  process.env.SMAJ_AI_SESSION_SECRET = "test-session-secret-long-enough";
  const db = createDatabase(process.env.SMAJ_DELEGATION_DB_PATH);
  const proof = { contract: { taskId: "task-1" }, actions: [{ recordId: "published-job" }], mode: "live", verifiedAt: new Date().toISOString(), evidence: [{ backendId: "hub-application-123", status: "submitted", serviceId: "jobs", recordId: "published-job", kind: "apply", contractId: "task-1", ownerId: "hub-user" }] };
  const execution: NonNullable<ServiceRoutePlan["execution"]> = { status: "verified", approvedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), actions: [{ id: "a1", serviceId: "jobs", kind: "apply", recordId: "published-job", title: "Apply: Engineer", coverNote: "Reviewed draft", applicationPreview: { detailsHash: "details-hash", job: { recordId: "published-job", title: "Engineer", company: "Verified Employer", location: "Lagos", type: "Full time", mode: "Hybrid", salary: "100 Pi", category: "Engineering" }, profile: { title: "Engineer", skills: ["TypeScript"], location: "Lagos", portfolio: "", summary: "Build services", profilePhoto: "" }, cv: { attached: false } } }], attempts: 1, receipt: { mode: "live", verifiedAt: proof.verifiedAt, evidence: proof.evidence, proofHash: createHash("sha256").update(JSON.stringify(proof)).digest("hex"), proof } };
  const plan: ServiceRoutePlan = { model: "fixture", summary: "receipt test", services: ["jobs"], steps: [], warnings: [], execution };
  const task = new AiTaskStore(db).create("hub-user", "Apply for Engineer", plan);
  const session = createUserSession({ sub: "hub-user", uid: "pi-user" });
  const req = (cookie = `${SESSION_COOKIE}=${session.value}`) => new NextRequest(`https://ai.example/api/tasks/${task.id}/receipt`, { headers: { cookie } });
  try {
    const json = await getReceipt(req(), { params: Promise.resolve({ id: task.id }) });
    assert.equal(json.status, 200);
    const payload = await json.json();
    assert.equal(payload.receipt.evidence[0].backendId, "hub-application-123");
    assert.equal(payload.proofHash, execution.receipt!.proofHash);
    const pdf = await getPdf(req(), { params: Promise.resolve({ id: task.id }) });
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers.get("content-type") || "", /application\/pdf/);
    const bytes = Buffer.from(await pdf.arrayBuffer());
    assert.ok(bytes.subarray(0, 8).toString("ascii").startsWith("%PDF-1."));
    assert.match(bytes.toString("ascii"), /hub-application-123/);
    assert.match(bytes.toString("ascii"), /Application ID/);
    assert.match(bytes.toString("ascii"), /Verified Employer/);
    assert.match(bytes.toString("ascii"), /Submitted at/);
    assert.match(bytes.toString("ascii"), /startxref/);
    assert.equal((await getReceipt(req(`${SESSION_COOKIE}=invalid`), { params: Promise.resolve({ id: task.id }) })).status, 401);
  } finally {
    db.close(); rmSync(dir, { recursive: true, force: true }); process.env = previous;
  }
});

test("PDF receipt generator refuses an unverified execution", () => {
  assert.throws(() => verifiedReceiptPdf("task", "request", { status: "failed", approvedAt: "", expiresAt: "", actions: [], attempts: 1 }));
});
