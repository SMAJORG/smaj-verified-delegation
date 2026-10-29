import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/src/server/http";
import { DelegationWorkflow } from "@/src/server/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { selectedJobIds?: string[] };
    const delegation = new DelegationWorkflow().approve(id, body.selectedJobIds);
    return NextResponse.json({ delegation });
  } catch (error) {
    return apiError(error);
  }
}
