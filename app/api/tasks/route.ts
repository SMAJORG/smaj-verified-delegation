import { NextRequest, NextResponse } from "next/server";
import { requireActorSession } from "@/src/server/auth";
import { workspaceDatabase } from "@/src/server/demo-workspace";
import { apiError, AppError } from "@/src/server/http";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { MetaServiceRouter } from "@/src/server/service-router";
import { ServiceConnectionStore } from "@/src/server/service-connections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = requireActorSession(request);
    return NextResponse.json({ tasks: new AiTaskStore(workspaceDatabase(request)).list(session.actorId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireActorSession(request);
    const actorId = session.actorId;
    const body = await request.json() as { task?: unknown };
    if (typeof body.task !== "string" || !body.task.trim() || body.task.length > 2000) throw new AppError("invalid_task", "Enter a message of 1 to 2,000 characters", 400);
    const tasks = new AiTaskStore(workspaceDatabase(request));
    if (session.sandbox && tasks.list(actorId).length >= 50) throw new AppError("demo_limit", "This demo has reached its AI task limit. Start a new demo session.", 429);
    const connectedServiceIds = new ServiceConnectionStore(workspaceDatabase(request)).list(actorId).filter(connection => connection.connected).map(connection => connection.serviceId);
    const plan = await new MetaServiceRouter().plan(String(body.task || ""), connectedServiceIds);
    const task = tasks.create(actorId, body.task.trim(), plan);
    return NextResponse.json({ plan, task }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
