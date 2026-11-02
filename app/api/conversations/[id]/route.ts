import { NextRequest, NextResponse } from "next/server";
import { requireActorSession } from "@/src/server/auth";
import { workspaceDatabase } from "@/src/server/demo-workspace";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { apiError, AppError, requireSameOrigin } from "@/src/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    requireSameOrigin(request);
    const session = requireActorSession(request);
    const body = await request.json() as { title?: unknown };
    if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 120) {
      throw new AppError("invalid_conversation_title", "Enter a conversation name of 1 to 120 characters.", 400);
    }
    const conversation = new AiTaskStore(workspaceDatabase(request)).renameConversation(session.actorId, (await context.params).id, body.title.trim());
    return NextResponse.json({ conversation }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    requireSameOrigin(request);
    const session = requireActorSession(request);
    new AiTaskStore(workspaceDatabase(request)).deleteConversation(session.actorId, (await context.params).id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
