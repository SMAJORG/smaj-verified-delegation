import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/src/server/auth";
import { apiError, requireSameOrigin } from "@/src/server/http";
import { workspaceDatabase } from "@/src/server/demo-workspace";
import { LiveWorkflow } from "@/src/server/live-workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    requireSameOrigin(request);
    const session = requireAuthenticatedSession(request);
    const task = await new LiveWorkflow(workspaceDatabase(request)).refreshActionUpdates(session, (await context.params).id);
    return NextResponse.json({ task }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
