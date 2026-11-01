import { NextRequest, NextResponse } from "next/server";
import { productionWritesEnabled, realPiPaymentsEnabled, ssoConfigured } from "@/src/server/auth";
import { getDatabase } from "@/src/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const database = getDatabase();
  database.prepare("SELECT 1").get();
  return NextResponse.json({
    status: "ok",
    service: "smaj-ai",
    publicUrl: process.env.SMAJ_AI_PUBLIC_URL || request.nextUrl.origin,
    ssoEnabled: ssoConfigured(),
    readOnlyServices: ["jobs", "store"],
    plannerConfigured: Boolean((process.env.META_API_KEY || process.env.MODEL_API_KEY)?.trim() && process.env.META_MODEL?.trim()),
    productionWrites: productionWritesEnabled(),
    realPiPayments: realPiPaymentsEnabled(),
  });
}
