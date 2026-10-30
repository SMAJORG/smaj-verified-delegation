import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/src/server/auth";
import { apiError } from "@/src/server/http";
import { MetaServiceRouter } from "@/src/server/service-router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    requireActor(request);
    const body = await request.json() as { task?: unknown };
    const plan = await new MetaServiceRouter().plan(String(body.task || ""));
    return NextResponse.json({ plan });
  } catch (error) { return apiError(error); }
}
