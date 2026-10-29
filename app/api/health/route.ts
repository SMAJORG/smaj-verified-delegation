import { NextResponse } from "next/server";
import { getDatabase } from "@/src/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const database = getDatabase();
  database.prepare("SELECT 1").get();
  return NextResponse.json({
    status: "ok",
    service: "smaj-verified-delegation",
    planner: "muse-spark-1.3",
    productionWrites: false,
    realPiPayments: false,
  });
}
