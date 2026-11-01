"use client";

import { useRef } from "react";
import styles from "./HomeWorkspace.module.css";
import ServiceIcon from "@/components/ServiceIcon";
import { SMAJ_SERVICES, type ServiceId } from "@/src/domain/services";

type Props = {
  task: string;
  setTask: (value: string) => void;
  selectedService: ServiceId | null;
  selectService: (value: ServiceId | null) => void;
  routeTask: (event: React.FormEvent) => void;
  busy: string | null;
  connectedIds: Set<ServiceId>;
  manageApps: () => void;
};

export default function HomeWorkspace({ task, setTask, selectedService, selectService, routeTask, busy, connectedIds, manageApps }: Props) {
  const input = useRef<HTMLTextAreaElement>(null);
  const selected = SMAJ_SERVICES.find(service => service.id === selectedService);
  const status = (id: ServiceId) => {
    const service = SMAJ_SERVICES.find(item => item.id === id)!;
    return service.adapterMode === "planning_only" ? "Planned" : connectedIds.has(id) ? "Connected" : "Not connected";
  };
  const ready = !selected || status(selected.id) === "Connected";

  return <section className={`homeView launcherHome ${styles.root}`}>
    <p className={styles.eyebrow}>YOUR WORKSPACE</p><h1 className={styles.title}>What can I help you do?</h1>
    <form className={`centralComposer compactComposer ${styles.composer}`} onSubmit={routeTask} aria-label="Create an AI task" aria-busy={busy === "routing"}>
      <label className="visuallyHidden" htmlFor="ai-task">Your AI task</label>
      <textarea ref={input} id="ai-task" value={task} onChange={event => setTask(event.target.value)} placeholder="Find software engineering jobs…" maxLength={1900} rows={3} />
      <div className={styles.toolbar}>
        <button type="button" className={styles.tool} onClick={manageApps} aria-label="Manage connected apps">+</button>
        {selected ? <button type="button" className={`${styles.tool} ${styles.apps}`} onClick={() => selectService(null)} aria-label={`Clear ${selected.shortName} context`}><ServiceIcon serviceId={selected.id}/><span>{selected.shortName}</span><span className={styles.clear} aria-hidden="true">×</span></button> : <button type="button" className={`${styles.tool} ${styles.apps}`} onClick={manageApps}><span aria-hidden="true">▦</span> Apps</button>}
        <button type="submit" className={styles.submit} disabled={!task.trim() || busy === "routing"}>{busy === "routing" ? <><span className="spinner"/>Asking AI…</> : <>Ask SMAJ AI <span aria-hidden="true">↗</span></>}</button>
      </div>
    </form>
    {selected && <div className="serviceContext" role="status"><span><strong>{selected.name}</strong> · {status(selected.id)}{status(selected.id) === "Planned" ? " — integration not available yet." : !ready ? " — connect this app to continue." : " — task context selected."}</span>{!ready && selected.adapterMode === "connected" && <button onClick={manageApps}>Connect app</button>}</div>}
    <div className={styles.suggestions} aria-label="Suggested requests">
      {[{ label: "Find jobs", prompt: "Find software engineering jobs" }, { label: "Shop cars", prompt: "Find cars under $30,000" }, { label: "Explore courses", prompt: "Show available online courses" }, { label: "Health services", prompt: "Find nearby health services" }].map(suggestion => <button key={suggestion.label} type="button" onClick={() => { selectService(null); setTask(suggestion.prompt); input.current?.focus({ preventScroll: true }); }}>{suggestion.label}</button>)}
    </div>
    <div className={styles.servicesHeading}>
      <div><h2>Connected services</h2><small>Explore SMAJ PI HUB · {connectedIds.size} connected</small></div>
      <button type="button" className={styles.manage} onClick={manageApps}>Manage <span aria-hidden="true">↗</span></button>
    </div>
    <div className={`launcherLegend ${styles.legend}`} aria-label="Service status legend"><span><i className="statusDot connected"/>Connected</span><span><i className="statusDot disconnected"/>Not connected</span><span><i className="statusDot unavailable"/>Planned</span></div>
    <div className={styles.services} aria-label="Choose a service">
      {SMAJ_SERVICES.map(service => {
        const state = status(service.id);
        return <button key={service.id} type="button" className={styles.service} aria-pressed={selectedService === service.id} aria-label={`${service.shortName}, ${state}`} onClick={() => { selectService(service.id); setTask(service.example); input.current?.focus({ preventScroll: true }); }}>
          <span className={styles.art}><ServiceIcon serviceId={service.id}/></span>
          <span className={styles.serviceLabel}>{service.shortName}<i className={`statusDot ${state === "Connected" ? "connected" : state === "Not connected" ? "disconnected" : "unavailable"}`}/></span>
        </button>;
      })}
    </div>
  </section>;
}
