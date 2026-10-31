import BrandLogo from "./BrandLogo";
import ServiceIcon from "./ServiceIcon";
import "./hub-services-section.css";

const hubServices = [
  { id: "store", name: "SMAJ Store" },
  { id: "jobs", name: "SMAJ Jobs" },
  { id: "stream", name: "SMAJ Stream" },
  { id: "education", name: "SMAJ Education" },
  { id: "health", name: "SMAJ Health" },
  { id: "transport", name: "SMAJ Transport" },
] as const;

export default function HubServicesSection() {
  return (
    <section className="wrap hubServicesSection" aria-labelledby="hub-services-heading">
      <div className="hubServicesCard">
        <div className="hubServicesCopy">
          <h2 id="hub-services-heading">Works Across <span>SMAJ PI HUB</span></h2>
          <p className="hubServicesSubtitle">One AI. Multiple Services.</p>
          <p className="hubServicesAvailability" id="hub-services-availability">Store and Jobs support authorized read-only access. Stream, Education, Health, and Transport are planning only; integrations are not yet available.</p>
        </div>
        <div className="hubServicesIllustration" aria-describedby="hub-services-availability">
          <div className="hubServicesDiagram">
            <svg className="hubServicesConnections" viewBox="0 0 270 180" fill="none" aria-hidden="true">
              <g stroke="#c4a882" strokeDasharray="3 4" strokeWidth="1.25">
                <path d="M44 22C80 22 96 90 135 90" />
                <path d="M44 90H96" />
                <path d="M44 158C80 158 96 90 135 90" />
                <path d="M226 22C190 22 174 90 135 90" />
                <path d="M226 90H174" />
                <path d="M226 158C190 158 174 90 135 90" />
              </g>
            </svg>
            {hubServices.map(service => (
              <div className={`hubServicesNode hubServicesNode-${service.id}`} key={service.id} role="img" aria-label={service.name}>
                <ServiceIcon serviceId={service.id} />
              </div>
            ))}
            <BrandLogo className="hubServicesCenter" />
          </div>
        </div>
      </div>
    </section>
  );
}
