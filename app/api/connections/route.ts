import { NextRequest, NextResponse } from "next/server";
import { requireActorSession } from "@/src/server/auth";
import { apiError } from "@/src/server/http";
import { ServiceConnectionStore } from "@/src/server/service-connections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = requireActorSession(request);
    return NextResponse.json({ connections: new ServiceConnectionStore().list(session.actorId, session.authType) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireActorSession(request);
    const body = await request.json() as { serviceId?: unknown; connected?: unknown };
    const connections = new ServiceConnectionStore().set(session.actorId, String(body.serviceId || ""), body.connected === true);
    return NextResponse.json({ connections });
  } catch (error) { return apiError(error); }
}
