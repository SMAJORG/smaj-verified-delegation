import { requireSameOrigin } from "@/src/server/http";
import { NextRequest, NextResponse } from "next/server";
import { requireActorSession } from "@/src/server/auth";
import { workspaceDatabase } from "@/src/server/demo-workspace";
import { apiError, AppError } from "@/src/server/http";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { MetaServiceRouter } from "@/src/server/service-router";
import { ServiceConnectionStore } from "@/src/server/service-connections";

import { beginPublicWork, publicJson } from "@/src/server/public-access";
export const runtime = "nodejs";
export const maxDuration = 180;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = requireActorSession(request);
    return NextResponse.json({ tasks: new AiTaskStore(workspaceDatabase(request)).list(session.actorId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  let release = () => {};
  try {
    requireSameOrigin(request);
    const session = requireActorSession(request);
    const actorId = session.actorId;
    const body = await (session.authType === "public" ? publicJson(request) : request.json()) as { task?: unknown };
    if (typeof body.task !== "string" || !body.task.trim() || body.task.length > 2000) throw new AppError("invalid_task", "Enter a message of 1 to 2,000 characters", 400);
    const tasks = new AiTaskStore(workspaceDatabase(request));
    if ((session.sandbox || session.authType === "public") && tasks.list(actorId).length >= 50) throw new AppError("demo_limit", "This workspace has reached its AI task limit. Start a new public workspace.", 429);
    const connectedServiceIds = new ServiceConnectionStore(workspaceDatabase(request)).list(actorId, session.authType).filter(connection => connection.connected).map(connection => connection.serviceId);
    release = beginPublicWork(request, session);
    const plan = await new MetaServiceRouter().plan(String(body.task || ""), connectedServiceIds);
    const task = tasks.create(actorId, body.task.trim(), plan);
    return NextResponse.json({ plan, task }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { const response=apiError(error);if(response.status===429)response.headers.set("Retry-After","60");return response; }
  finally { release(); }
}
