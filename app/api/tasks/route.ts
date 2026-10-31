import { NextRequest, NextResponse } from "next/server";
import { requireActorSession } from "@/src/server/auth";
import { demoTaskPlan, workspaceDatabase } from "@/src/server/demo-workspace";
import { apiError } from "@/src/server/http";
import { MetaServiceRouter } from "@/src/server/service-router";
import { ServiceConnectionStore } from "@/src/server/service-connections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = requireActorSession(request);
    const actorId = session.actorId;
    const body = await request.json() as { task?: unknown };
    if (session.sandbox) return NextResponse.json({ plan: demoTaskPlan(String(body.task || "")) });
    const connectedServiceIds = new ServiceConnectionStore(workspaceDatabase(request)).list(actorId).filter(connection => connection.connected).map(connection => connection.serviceId);
    const plan = await new MetaServiceRouter().plan(String(body.task || ""), connectedServiceIds);
    return NextResponse.json({ plan });
  } catch (error) { return apiError(error); }
}
