import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/src/server/auth";
import { apiError } from "@/src/server/http";
import { MetaServiceRouter } from "@/src/server/service-router";
import { ServiceConnectionStore } from "@/src/server/service-connections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const actorId = requireActor(request);
    const body = await request.json() as { task?: unknown };
    const connectedServiceIds = new ServiceConnectionStore().list(actorId).filter(connection => connection.connected).map(connection => connection.serviceId);
    const plan = await new MetaServiceRouter().plan(String(body.task || ""), connectedServiceIds);
    return NextResponse.json({ plan });
  } catch (error) { return apiError(error); }
}
