import { NextResponse } from "next/server";
import { apiError } from "@/src/server/http";
import { DelegationWorkflow } from "@/src/server/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ delegation: new DelegationWorkflow().get(id) });
  } catch (error) {
    return apiError(error);
  }
}
