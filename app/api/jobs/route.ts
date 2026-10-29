import { NextResponse } from "next/server";
import { apiError } from "@/src/server/http";
import { SmajJobsReadAdapter } from "@/src/server/jobs-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const adapter = new SmajJobsReadAdapter();
    const jobs = await adapter.listJobs();
    return NextResponse.json({ jobs, source: adapter.sourceUrl, mode: "read_only" });
  } catch (error) {
    return apiError(error);
  }
}
