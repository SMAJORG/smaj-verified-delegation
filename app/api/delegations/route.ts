import { NextRequest, NextResponse } from "next/server";
import type { CreateDelegationInput } from "@/src/domain/types";
import { requireActor } from "@/src/server/auth";
import { apiError, requireIdempotencyKey } from "@/src/server/http";
import { DelegationWorkflow } from "@/src/server/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actorId = requireActor(request);
    return NextResponse.json({ delegations: new DelegationWorkflow().list(actorId) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const actorId = requireActor(request);
    const requestKey = requireIdempotencyKey(request);
    const body = await request.json() as CreateDelegationInput;
    const delegation = await new DelegationWorkflow().create(actorId, body, requestKey);
    return NextResponse.json({ delegation }, { status: 201 });
  } catch (error) { return apiError(error); }
}
