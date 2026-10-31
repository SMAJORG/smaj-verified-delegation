import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/src/server/auth";
import { apiError } from "@/src/server/http";
import { workspaceWorkflow } from "@/src/server/demo-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actorId = requireActor(request);
    const { id } = await context.params;
    return NextResponse.json({ delegation: workspaceWorkflow(request).get(id, actorId) });
  } catch (error) { return apiError(error); }
}
