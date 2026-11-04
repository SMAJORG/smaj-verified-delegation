import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/src/server/auth";
import { workspaceDatabase } from "@/src/server/demo-workspace";
import { LiveWorkflow } from "@/src/server/live-workflow";
import { apiError, AppError, requireSameOrigin } from "@/src/server/http";
export const runtime = "nodejs";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request); const session = requireAuthenticatedSession(request);
    const body = await request.json();
    if (body.approved !== true || !Array.isArray(body.actionIds) || body.actionIds.some((id: unknown) => typeof id !== "string")) throw new AppError("approval_required", "Explicitly approve the selected live actions", 400);
    const task = new LiveWorkflow(workspaceDatabase(request)).approve(session, (await context.params).id, body.actionIds, body.reviewHash);
    return NextResponse.json({ task, plan: task.plan }, { status: task.plan.execution?.status === "unavailable" ? 200 : 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
