import { ServiceConnectionStore } from "@/src/server/service-connections";
import { workspaceDatabase } from "@/src/server/demo-workspace";
import { AppError } from "@/src/server/http";
import { NextResponse } from "next/server";
import { apiError } from "@/src/server/http";
import { SmajJobsReadAdapter } from "@/src/server/jobs-adapter";
import { requireActorSession } from "@/src/server/auth";
import { demoJobs } from "@/src/server/demo-workspace";

import { beginPublicWork } from "@/src/server/public-access";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let release=()=>{};
  try {
    const session = requireActorSession(request);
    release=beginPublicWork(request,session);
    if (session.sandbox) return NextResponse.json({ jobs: demoJobs, source: "demo://fictional-opportunities", mode: "simulated" });
    if (!new ServiceConnectionStore(workspaceDatabase(request)).list(session.actorId, session.authType).some(c => c.serviceId === "jobs" && c.connected)) throw new AppError("service_not_connected", "Connect Jobs first", 409);
    const adapter = new SmajJobsReadAdapter();
    const jobs = await adapter.listJobs();
    return NextResponse.json({ jobs, source: adapter.sourceUrl, mode: "read_only" });
  } catch (error) {
    const response=apiError(error);if(response.status===429&&!response.headers.has("Retry-After"))response.headers.set("Retry-After","60");return response;
  } finally {release();}
}
