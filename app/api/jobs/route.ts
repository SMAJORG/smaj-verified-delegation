import { NextResponse } from "next/server";
import { apiError } from "@/src/server/http";
import { SmajJobsReadAdapter } from "@/src/server/jobs-adapter";
import { requireActorSession } from "@/src/server/auth";
import { demoJobs } from "@/src/server/demo-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = requireActorSession(request);
    if (session.sandbox) return NextResponse.json({ jobs: demoJobs, source: "demo://fictional-opportunities", mode: "simulated" });
    const adapter = new SmajJobsReadAdapter();
    const jobs = await adapter.listJobs();
    return NextResponse.json({ jobs, source: adapter.sourceUrl, mode: "read_only" });
  } catch (error) {
    return apiError(error);
  }
}
