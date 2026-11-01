import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/src/server/auth";
import { workspaceDatabase } from "@/src/server/workspace";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { apiError, AppError } from "@/src/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  try {
    const actor = requireActor(request);
    const task = new AiTaskStore(workspaceDatabase(request)).get(actor, (await context.params).id);
    if (!task.plan.ai) throw new AppError("task_not_found", "Live task not found", 404);
    return NextResponse.json({ task }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const actor = requireActor(request);
    new AiTaskStore(workspaceDatabase(request)).delete(actor, (await context.params).id);
    return new NextResponse(null, { status: 204 });
  } catch (error) { return apiError(error); }
}
