import BrandLogo from "@/components/BrandLogo";
import ServiceIcon from "@/components/ServiceIcon";
import { SMAJ_SERVICES, type ServiceId } from "@/src/domain/services";
import type { ServiceConnection } from "@/src/server/service-connections";
import styles from "./Services.module.css";

type Props = {
  connections: ServiceConnection[];
  setConnection: (id: ServiceId, value: boolean) => void;
  busy: string | null;
};

export default function Services({ connections, setConnection, busy }: Props) {
  const states = new Map(connections.map(item => [item.serviceId, item]));
  const connected = SMAJ_SERVICES.filter(service => {
    const state = states.get(service.id);
    return state?.available && state.connected;
  });

  return (
    <section className={styles.page} aria-labelledby="connect-apps-heading">
      <h1 id="connect-apps-heading">Connect your SMAJ PI HUB apps</h1>
      <div className={styles.banner} aria-label="Your connected apps">
        <BrandLogo className={styles.logo} />
        <span className={styles.link} aria-hidden="true">↔</span>
        {connected.length ? <ul className={styles.connectedIcons}>
          {connected.map(service => <li key={service.id} aria-label={`${service.name} connected`}><ServiceIcon serviceId={service.id} /></li>)}
        </ul> : <span className={styles.empty}>No apps connected</span>}
      </div>
      <p className={styles.note}>Choose the apps SMAJ AI can use. Authorized read-only connections; simulated actions only.</p>
      <ul className={styles.list} aria-label="SMAJ PI HUB services">
        {SMAJ_SERVICES.map(service => {
          const state = states.get(service.id);
          const updating = busy === `connection-${service.id}`;
          return (
            <li className={styles.row} key={service.id}>
              <ServiceIcon serviceId={service.id} />
              <div className={styles.copy}>
                <h2>{service.name}</h2>
                <p>{service.description}</p>
              </div>
              <button
                type="button"
                className={`${styles.button} ${!state?.available ? styles.unavailable : state.connected ? styles.connected : ""}`}
                disabled={!state?.available || updating}
                aria-label={!state?.available ? `${service.name} unavailable` : `${state.connected ? "Disconnect" : "Connect"} ${service.name}`}
                aria-busy={updating}
                onClick={() => state?.available && setConnection(service.id, !state.connected)}
              >
                {updating ? "Updating…" : !state?.available ? "Unavailable" : state.connected ? "Connected" : "Connect"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
