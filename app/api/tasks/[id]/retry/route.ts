import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/src/server/auth";
import { workspaceDatabase } from "@/src/server/demo-workspace";
import { LiveWorkflow } from "@/src/server/live-workflow";
import { apiError, requireSameOrigin } from "@/src/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const session = requireAuthenticatedSession(request);
    const task = new LiveWorkflow(workspaceDatabase(request)).retry(session, (await context.params).id);
    return NextResponse.json({ task, plan: task.plan }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
