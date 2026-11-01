import { requireSameOrigin } from "@/src/server/http";
import { NextRequest, NextResponse } from "next/server";
import { requireActorSession } from "@/src/server/auth";
import { workspaceDatabase } from "@/src/server/workspace";
import { apiError, AppError } from "@/src/server/http";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { MetaServiceRouter } from "@/src/server/service-router";
import { ServiceConnectionStore } from "@/src/server/service-connections";

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
  try {
    requireSameOrigin(request);
    const session = requireActorSession(request);
    const actorId = session.actorId;
    const body = await request.json() as { task?: unknown };
    if (typeof body.task !== "string" || !body.task.trim() || body.task.length > 2000) throw new AppError("invalid_task", "Enter a message of 1 to 2,000 characters", 400);
    const tasks = new AiTaskStore(workspaceDatabase(request));
    const connectedServiceIds = new ServiceConnectionStore(workspaceDatabase(request)).list(actorId, session.authType).filter(connection => connection.connected).map(connection => connection.serviceId);
    const analyzingAt = new Date().toISOString();
    const plan = await new MetaServiceRouter().plan(String(body.task || ""), connectedServiceIds);
    plan.activity = [
      { at: analyzingAt, phase: "Analyzing", message: "Request sent to the Meta planning API" },
      { at: plan.ai!.receivedAt, phase: "Planning", message: `Completed Meta response received; selected services: ${plan.services.join(", ") || "none"}` },
      { at: new Date().toISOString(), phase: plan.steps.length ? "Awaiting Approval" : "Completed", message: plan.steps.length ? "Review and approve service discovery" : "Model answer received; no service action required" },
    ];
    const task = tasks.create(actorId, body.task.trim(), plan);
    return NextResponse.json({ plan, task }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
