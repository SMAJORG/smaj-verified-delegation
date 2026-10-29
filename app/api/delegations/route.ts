import { NextRequest, NextResponse } from "next/server";
import type { CreateDelegationInput } from "@/src/domain/types";
import { apiError } from "@/src/server/http";
import { DelegationWorkflow } from "@/src/server/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateDelegationInput;
    const delegation = await new DelegationWorkflow().create(body);
    return NextResponse.json({ delegation }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
