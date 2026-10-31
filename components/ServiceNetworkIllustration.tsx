import type { CSSProperties } from "react";
import { SMAJ_SERVICES } from "@/src/domain/services";
import BrandLogo from "./BrandLogo";
import ServiceIcon from "./ServiceIcon";
import styles from "./ServiceNetworkIllustration.module.css";

// Presentation only: use the existing Hub artwork without interpreting service status.
const nodes = SMAJ_SERVICES.map((service, index) => {
  const angle = ((-90 + (index * 360) / SMAJ_SERVICES.length) * Math.PI) / 180;
  return {
    ...service,
    x: 50 + 40 * Math.cos(angle),
    y: 50 + 39 * Math.sin(angle),
  };
});

export default function ServiceNetworkIllustration() {
  return (
    <div
      className={styles.network}
      role="img"
      aria-label={`Illustrative SMAJ PI HUB service network around SMAJ AI: ${nodes.map((node) => node.name).join(", ")}. Service artwork does not indicate a live connection.`}
    >
      <svg
        className={styles.connections}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {nodes.map((node) => (
          <line
            key={node.id}
            x1="500"
            y1="500"
            x2={node.x * 10}
            y2={node.y * 10}
          />
        ))}
      </svg>
      <div className={styles.center} aria-hidden="true">
        <BrandLogo className={styles.logo} />
      </div>
      {nodes.map((node, index) => (
        <div
          key={node.id}
          className={styles.node}
          title={node.name}
          aria-hidden="true"
          style={
            {
              left: `${node.x}%`,
              top: `${node.y}%`,
              "--float-delay": `${-index * 0.47}s`,
              "--float-duration": `${5 + (index % 4) * 0.6}s`,
            } as CSSProperties
          }
        >
          <div className={styles.floating}>
            <div className={styles.art}>
              <ServiceIcon serviceId={node.id} />
            </div>
            <span className={styles.name}>{node.name}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
