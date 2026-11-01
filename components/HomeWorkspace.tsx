"use client";

import { useEffect, useRef, useState } from "react";
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
};

export default function HomeWorkspace({ task, setTask, selectedService, selectService, routeTask, busy, connectedIds }: Props) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  useEffect(() => {
    if (task.length > 0) return;
    const timer = window.setInterval(() => {
      setPlaceholderIndex(index => (index + 1) % SMAJ_SERVICES.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [task.length]);
  const selected = SMAJ_SERVICES.find(service => service.id === selectedService);
  const connectedServices = SMAJ_SERVICES.filter(service => service.adapterMode === "connected" && connectedIds.has(service.id));
  const status = (id: ServiceId) => {
    const service = SMAJ_SERVICES.find(item => item.id === id)!;
    return service.adapterMode === "planning_only" ? "Planned" : connectedIds.has(id) ? "Connected" : "Not connected";
  };
  const ready = !selected || status(selected.id) === "Connected";

  return <section className={`homeView launcherHome ${styles.root}`}>
    <p className={styles.eyebrow}>YOUR WORKSPACE</p><h1 className={styles.title}>What can I help you do?</h1>
    <form className={`centralComposer compactComposer ${styles.composer}`} onSubmit={routeTask} aria-label="Create an AI task" aria-busy={busy === "routing"}>
      <label className="visuallyHidden" htmlFor="ai-task">Your AI task</label>
      <div className={styles.promptInput}>
        <textarea ref={input} id="ai-task" value={task} onChange={event => setTask(event.target.value)} placeholder="" maxLength={1900} rows={3} />
        {!task && <span className={styles.rotatingPlaceholder} aria-hidden="true"><span key={placeholderIndex}>{SMAJ_SERVICES[placeholderIndex].example}…</span></span>}
      </div>
      <div className={styles.toolbar}>
        {selected && <button type="button" className={`${styles.tool} ${styles.apps}`} onClick={() => selectService(null)} aria-label={`Clear ${selected.shortName} context`}><ServiceIcon serviceId={selected.id}/><span>{selected.shortName}</span><span className={styles.clear} aria-hidden="true">×</span></button>}
        <button type="submit" className={styles.submit} disabled={!task.trim() || busy === "routing"}>{busy === "routing" ? <><span className="spinner"/>Asking AI…</> : <>Ask SMAJ AI <span aria-hidden="true">↗</span></>}</button>
      </div>
    </form>
    {selected && <div className="serviceContext" role="status"><span><strong>{selected.name}</strong> · {status(selected.id)}{status(selected.id) === "Planned" ? " — integration not available yet." : !ready ? " — use Apps in the header to connect this app." : " — task context selected."}</span></div>}
    <div className={styles.suggestions} aria-label="Suggested requests">
      {[{ label: "Find jobs", prompt: "Find software engineering jobs" }, { label: "Shop cars", prompt: "Find cars under $30,000" }, { label: "Explore courses", prompt: "Show available online courses" }, { label: "Health services", prompt: "Find nearby health services" }].map(suggestion => <button key={suggestion.label} type="button" onClick={() => { selectService(null); setTask(suggestion.prompt); input.current?.focus({ preventScroll: true }); }}>{suggestion.label}</button>)}
    </div>
    <div className={styles.servicesHeading}>
      <div className={styles.servicesHeadingContent}>
        <h2>Connected services</h2>
        {!!connectedServices.length && <div className={styles.connectedIcons} aria-label="Connected apps">
          {connectedServices.map(service => <span key={service.id} title={service.name}><ServiceIcon serviceId={service.id}/></span>)}
        </div>}
      </div>
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
