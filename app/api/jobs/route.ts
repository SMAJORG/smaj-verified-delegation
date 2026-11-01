import { ServiceConnectionStore } from "@/src/server/service-connections";
import { workspaceDatabase } from "@/src/server/workspace";
import { AppError } from "@/src/server/http";
import { NextResponse } from "next/server";
import { apiError } from "@/src/server/http";
import { SmajJobsReadAdapter } from "@/src/server/jobs-adapter";
import { requireActorSession } from "@/src/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = requireActorSession(request);
    if (!new ServiceConnectionStore(workspaceDatabase(request)).list(session.actorId, session.authType).some(c => c.serviceId === "jobs" && c.connected)) throw new AppError("service_not_connected", "Connect Jobs first", 409);
    const adapter = new SmajJobsReadAdapter();
    const jobs = await adapter.listJobs();
    return NextResponse.json({ jobs, source: adapter.sourceUrl, mode: "read_only" });
  } catch (error) {
    return apiError(error);
  }
}
