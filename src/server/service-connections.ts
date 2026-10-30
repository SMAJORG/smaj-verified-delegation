import { SERVICE_IDS, SMAJ_SERVICES, type ServiceId } from "@/src/domain/services";
import type { AppDatabase } from "@/src/server/database";
import { getDatabase } from "@/src/server/database";
import { AppError } from "@/src/server/http";

export type ServiceConnection = {
  serviceId: ServiceId;
  connected: boolean;
  available: boolean;
  adapterMode: "connected" | "planning_only";
};

export class ServiceConnectionStore {
  constructor(private readonly database: AppDatabase = getDatabase(), private readonly now: () => Date = () => new Date()) {}

  private initialize(ownerId: string, authType: "demo" | "sso" = "demo") {
    const count = this.database.prepare("SELECT COUNT(*) AS count FROM service_connections WHERE owner_id = ?").get(ownerId) as { count: number };
    if (count.count > 0) return;
    const insert = this.database.prepare("INSERT INTO service_connections (owner_id, service_id, connected, updated_at) VALUES (?, ?, ?, ?)");
    const timestamp = this.now().toISOString();
    this.database.transaction(() => {
      for (const service of SMAJ_SERVICES) insert.run(ownerId, service.id, authType === "demo" && service.id === "jobs" ? 1 : 0, timestamp);
    })();
  }

  list(ownerId: string, authType: "demo" | "sso" = "demo"): ServiceConnection[] {
    this.initialize(ownerId, authType);
    const rows = this.database.prepare("SELECT service_id, connected FROM service_connections WHERE owner_id = ?").all(ownerId) as Array<{ service_id: ServiceId; connected: number }>;
    const states = new Map(rows.map(row => [row.service_id, Boolean(row.connected)]));
    return SMAJ_SERVICES.map(service => ({ serviceId: service.id, connected: states.get(service.id) || false, available: service.adapterMode === "connected", adapterMode: service.adapterMode }));
  }

  set(ownerId: string, serviceId: string, connected: boolean): ServiceConnection[] {
    if (!SERVICE_IDS.has(serviceId as ServiceId)) throw new AppError("unknown_service", "Unknown SMAJ service", 404);
    const service = SMAJ_SERVICES.find(item => item.id === serviceId)!;
    if (service.adapterMode !== "connected") throw new AppError("integration_unavailable", `${service.name} does not have an authorized API connection yet`, 409);
    this.initialize(ownerId);
    this.database.prepare("UPDATE service_connections SET connected = ?, updated_at = ? WHERE owner_id = ? AND service_id = ?")
      .run(connected ? 1 : 0, this.now().toISOString(), ownerId, serviceId);
    return this.list(ownerId);
  }
}
