import { NextResponse } from "next/server";
import { productionWritesEnabled, realPiPaymentsEnabled, ssoConfigured } from "@/src/server/auth";
import { getDatabase } from "@/src/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const database = getDatabase();
  database.prepare("SELECT 1").get();
  return NextResponse.json({
    status: "ok",
    service: "smaj-ai",
    publicUrl: process.env.SMAJ_AI_PUBLIC_URL || "https://ai.smajpihub.com",
    ssoEnabled: ssoConfigured(),
    readOnlyServices: ["jobs", "store"],
    planner: "muse-spark-1.3",
    productionWrites: productionWritesEnabled(),
    realPiPayments: realPiPaymentsEnabled(),
  });
}