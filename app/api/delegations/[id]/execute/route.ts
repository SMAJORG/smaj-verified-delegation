import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/src/server/auth";
import { apiError, requireIdempotencyKey } from "@/src/server/http";
import { workspaceWorkflow } from "@/src/server/demo-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actorId = requireActor(request);
    const requestKey = requireIdempotencyKey(request);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({})) as { injectTransientFailure?: boolean };
    const delegation = await workspaceWorkflow(request).execute(actorId, id, body.injectTransientFailure !== false, requestKey);
    return NextResponse.json({ delegation });
  } catch (error) { return apiError(error); }
}
