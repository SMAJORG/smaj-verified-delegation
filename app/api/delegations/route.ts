import { ServiceConnectionStore } from "@/src/server/service-connections";
import { workspaceDatabase } from "@/src/server/demo-workspace";
import { NextRequest, NextResponse } from "next/server";
import type { CreateDelegationInput } from "@/src/domain/types";
import { requireSandboxSession, requireActorSession } from "@/src/server/auth";
import { apiError, AppError, requireIdempotencyKey } from "@/src/server/http";
import { workspaceWorkflow } from "@/src/server/demo-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    if (requireActorSession(request).authType === "public") return NextResponse.json({delegations:[]});
    const actorId = requireSandboxSession(request).actorId;
    return NextResponse.json({ delegations: workspaceWorkflow(request).list(actorId) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const actorId = requireSandboxSession(request).actorId;
    const requestKey = requireIdempotencyKey(request);
    const body = await request.json() as CreateDelegationInput;
    const workflow = workspaceWorkflow(request);
    if (requireActorSession(request).sandbox) {
      if (typeof body.goal !== "string" || body.goal.length > 2000 || typeof body.candidateName !== "string" || body.candidateName.length > 100 || !Array.isArray(body.skills) || body.skills.length > 12 || body.skills.some(skill => typeof skill !== "string" || skill.length > 80)) {
        throw new AppError("invalid_demo_task", "Use a goal of up to 2,000 characters, a name of up to 100 characters, and at most 12 short skills.", 400);
      }
      if (workflow.list(actorId).length >= 50) throw new AppError("demo_limit", "This demo workspace has reached its task limit. Start a fresh demo after signing out.", 429);
    }
    const session = requireActorSession(request);
    if (!session.sandbox && !new ServiceConnectionStore(workspaceDatabase(request)).list(actorId, session.authType).some(c => c.serviceId === "jobs" && c.connected)) throw new AppError("service_not_connected", "Connect Jobs first", 409);
    const delegation = await workflow.create(actorId, body, requestKey);
    return NextResponse.json({ delegation }, { status: 201 });
  } catch (error) { return apiError(error); }
}
