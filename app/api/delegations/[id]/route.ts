import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/src/server/auth";
import { apiError } from "@/src/server/http";
import { DelegationWorkflow } from "@/src/server/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actorId = requireActor(request);
    const { id } = await context.params;
    return NextResponse.json({ delegation: new DelegationWorkflow().get(id, actorId) });
  } catch (error) { return apiError(error); }
}
