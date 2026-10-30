import { NextRequest, NextResponse } from "next/server";
import { requireActorSession } from "@/src/server/auth";
import { apiError, AppError } from "@/src/server/http";
import { ServiceConnectionStore } from "@/src/server/service-connections";
import { SmajStoreReadAdapter } from "@/src/server/store-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = requireActorSession(request);
    const connections = new ServiceConnectionStore().list(session.actorId, session.authType);
    if (!connections.find(item => item.serviceId === "store")?.connected) {
      throw new AppError("service_not_connected", "Connect SMAJ Store before reading its catalog", 409);
    }
    const adapter = new SmajStoreReadAdapter();
    const products = await adapter.listProducts();
    return NextResponse.json({ products, source: adapter.sourceUrl, mode: "read_only" });
  } catch (error) {
    return apiError(error);
  }
}