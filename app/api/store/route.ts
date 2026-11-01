import { NextRequest, NextResponse } from "next/server";
import { requireActorSession } from "@/src/server/auth";
import { apiError, AppError } from "@/src/server/http";
import { ServiceConnectionStore } from "@/src/server/service-connections";
import { SmajStoreReadAdapter } from "@/src/server/store-adapter";
import { workspaceDatabase } from "@/src/server/demo-workspace";

import { beginPublicWork } from "@/src/server/public-access";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let release=()=>{};
  try {
    const session = requireActorSession(request);
    release=beginPublicWork(request,session);
    const connections = new ServiceConnectionStore(workspaceDatabase(request)).list(session.actorId, session.authType);
    if (!connections.find(item => item.serviceId === "store")?.connected) {
      throw new AppError("service_not_connected", "Connect SMAJ Store before reading its catalog", 409);
    }
    if (session.sandbox) return NextResponse.json({ products: [{ id: "sample-laptop", title: "Developer Laptop (Sample)", category: "Electronics", price: "$650 (sample)", sellerName: "Fictional Demo Store", location: "Lagos", summary: "Fictional marketplace listing for the hackathon walkthrough." }], source: "demo://fictional-products", mode: "simulated" });
    const adapter = new SmajStoreReadAdapter();
    const products = await adapter.listProducts();
    return NextResponse.json({ products, source: adapter.sourceUrl, mode: "read_only" });
  } catch (error) {
    const response=apiError(error);if(response.status===429)response.headers.set("Retry-After","60");return response;
  } finally {release();}
}
