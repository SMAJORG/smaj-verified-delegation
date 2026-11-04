import { NextRequest, NextResponse } from "next/server";
import { requireActorSession } from "@/src/server/auth";
import { listMetaModels } from "@/src/server/meta-client";
import { apiError } from "@/src/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    requireActorSession(request);
    return NextResponse.json(await listMetaModels(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
