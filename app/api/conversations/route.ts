import { NextRequest, NextResponse } from "next/server";
import { requireActorSession } from "@/src/server/auth";
import { workspaceDatabase } from "@/src/server/demo-workspace";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { apiError } from "@/src/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = requireActorSession(request);
    const conversations = new AiTaskStore(workspaceDatabase(request)).conversations(session.actorId);
    return NextResponse.json({ conversations }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
