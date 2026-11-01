import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/src/server/auth";
import { workspaceDatabase } from "@/src/server/demo-workspace";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { apiError } from "@/src/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  try {
    const actor = requireActor(request);
    return NextResponse.json({ task: new AiTaskStore(workspaceDatabase(request)).get(actor, (await context.params).id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const actor = requireActor(request);
    new AiTaskStore(workspaceDatabase(request)).delete(actor, (await context.params).id);
    return new NextResponse(null, { status: 204 });
  } catch (error) { return apiError(error); }
}
