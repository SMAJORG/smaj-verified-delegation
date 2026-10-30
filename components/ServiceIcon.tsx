import type { ServiceId } from "@/src/domain/services";

// Original Hub ServiceArt assets and serviceCatalog atlas positions (5 columns, 3 rows).
const serviceArt: Record<ServiceId, { atlasIndex: number; src?: string }> = {
  store: { atlasIndex: 0, src: "/assets/services/store.png" },
  stream: { atlasIndex: 12 },
  jobs: { atlasIndex: 2, src: "/assets/services/jobs.png" },
  education: { atlasIndex: 3, src: "/assets/services/education.png" },
  sports: { atlasIndex: 13 },
  food: { atlasIndex: 1 },
  health: { atlasIndex: 4, src: "/assets/services/health.png" },
  transport: { atlasIndex: 5, src: "/assets/services/transport.png" },
  agro: { atlasIndex: 6 },
  energy: { atlasIndex: 7 },
  charity: { atlasIndex: 8 },
  housing: { atlasIndex: 9 },
  events: { atlasIndex: 10 },
  swap: { atlasIndex: 11 },
  token: { atlasIndex: 14 },
};

export default function ServiceIcon({ serviceId }: { serviceId: ServiceId }) {
  const { atlasIndex, src } = serviceArt[serviceId];
  return <span className="serviceBadge hubServiceIcon" aria-hidden="true" data-service={serviceId} style={{
    backgroundColor: "transparent",
    backgroundImage: `url('${src || "/assets/smaj-service-atlas.png"}')`,
    backgroundPosition: src ? "center" : `${(atlasIndex % 5) * 25}% ${Math.floor(atlasIndex / 5) * 50}%`,
    backgroundRepeat: "no-repeat",
    backgroundSize: src ? "contain" : "500% 300%",
  }} />;
}
