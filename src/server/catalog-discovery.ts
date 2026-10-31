import { createHash } from "node:crypto";
import { SmajJobsReadAdapter } from "@/src/server/jobs-adapter";
import { SmajStoreReadAdapter } from "@/src/server/store-adapter";
import { SmajStreamReadAdapter } from "@/src/server/stream-adapter";
import type { ServiceId, ServiceRoutePlan } from "@/src/domain/services";

export async function discoverCatalogs(ids: ServiceId[], authorized: (id: ServiceId) => boolean) {
  const approvedAt = new Date().toISOString();
  const results: NonNullable<ServiceRoutePlan["discovery"]>["results"] = [];
  for (const id of [...new Set(ids)]) {
    if (!["jobs", "store", "stream"].includes(id)) continue;
    if (!authorized(id)) { results.push({ serviceId: id, source: "", status: "unavailable", records: [], error: "Service disconnected; no request sent" }); continue; }
    const adapter = id === "jobs" ? new SmajJobsReadAdapter() : id === "store" ? new SmajStoreReadAdapter() : new SmajStreamReadAdapter();
    try {
      const records = adapter instanceof SmajJobsReadAdapter ? await adapter.listJobs() : adapter instanceof SmajStoreReadAdapter ? await adapter.listProducts() : await adapter.listContent();
      if (!authorized(id)) throw new Error("Service disconnected during read");
      results.push({ serviceId: id, source: adapter.sourceUrl, status: "read", records });
    } catch { results.push({ serviceId: id, source: adapter.sourceUrl, status: "unavailable", records: [], error: "Catalog unavailable or invalid; check backend deployment and configuration" }); }
  }
  const proof = { approvedAt, completedAt: new Date().toISOString(), results };
  return { ...proof, proofHash: createHash("sha256").update(JSON.stringify(proof)).digest("hex") };
}
