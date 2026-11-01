import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/src/server/auth";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { workspaceDatabase } from "@/src/server/demo-workspace";
import { apiError, AppError } from "@/src/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = requireActor(request);
    const task = new AiTaskStore(workspaceDatabase(request)).get(actor, (await context.params).id);
    const receipt = task.plan.execution?.receipt;
    if (task.plan.execution?.status !== "verified" || !receipt) throw new AppError("receipt_not_found", "A verified backend receipt is not available for this task", 404);
    const actual = createHash("sha256").update(JSON.stringify(receipt.proof)).digest();
    const expected = Buffer.from(receipt.proofHash, "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new AppError("receipt_integrity_failed", "The stored receipt failed its integrity check", 409);
    return NextResponse.json({ schemaVersion: "1.0", taskId: task.id, request: task.task, receipt: receipt.proof, proofHash: receipt.proofHash }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
