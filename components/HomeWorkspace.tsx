"use client";

import { useRef } from "react";
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

  return <section className="homeView launcherHome">
    <p className="eyebrow">YOUR WORKSPACE</p><h1>What will we create today?</h1><p className="workspaceIntro">Ask about SMAJ PI HUB, its White Paper, policies, or services. White Paper and policy answers need no task approval. Live catalog reads and real actions require separate approvals.</p>
    <form className="centralComposer compactComposer" onSubmit={routeTask} aria-label="Create an AI task" aria-busy={busy === "routing"}>
      <label className="visuallyHidden" htmlFor="ai-task">Your AI task</label>
      <textarea ref={input} id="ai-task" value={task} onChange={event => setTask(event.target.value)} placeholder="Find software engineering jobs, cars under $30,000, or content on SMAJ Stream…" maxLength={1900} />
      <div className="composerToolbar">
        <button type="button" className="roundButton" onClick={manageApps} aria-label="Manage connected apps">+</button>
        {selected ? <button type="button" className="contextChip" onClick={() => selectService(null)} aria-label={`Clear ${selected.shortName} context`}><ServiceIcon serviceId={selected.id}/><span>{selected.shortName}</span><span aria-hidden="true">×</span></button> : <button type="button" className="contextChip" onClick={manageApps}><span aria-hidden="true">▦</span> Apps</button>}
        <button className="createButton" disabled={!task.trim() || busy === "routing"}>{busy === "routing" ? <><span className="spinner"/>Asking AI…</> : <>Ask SMAJ AI <span aria-hidden="true">↗</span></>}</button>
      </div>
    </form>
    {selected && <div className="serviceContext" role="status"><span><strong>{selected.name}</strong> · {status(selected.id)}{status(selected.id) === "Planned" ? " — integration not available yet." : !ready ? " — connect this app to continue." : " — task context selected."}</span>{!ready && selected.adapterMode === "connected" && <button onClick={manageApps}>Connect app</button>}</div>}
    <button className="connectionStrip" onClick={manageApps}>
      <span className="connectionArt" aria-hidden="true"><ServiceIcon serviceId="jobs"/><ServiceIcon serviceId="store"/></span>
      <span><strong>Your connected workspace</strong><small>{connectedIds.size} app{connectedIds.size === 1 ? "" : "s"} connected</small></span>
      <span className="managePill">Manage <span aria-hidden="true">↗</span></span>
    </button>
    <div className="launcherLegend" aria-label="Service status legend"><span><i className="statusDot connected"/>Connected</span><span><i className="statusDot disconnected"/>Not connected</span><span><i className="statusDot unavailable"/>Planned</span></div>
    <div className="serviceLauncher" aria-label="Choose a service">
      {SMAJ_SERVICES.map(service => {
        const state = status(service.id);
        return <button key={service.id} type="button" className="launcherItem" aria-pressed={selectedService === service.id} aria-label={`${service.shortName}, ${state}`} onClick={() => { selectService(service.id); setTask(service.example); input.current?.focus({ preventScroll: true }); }}>
          <span className="launcherArt"><ServiceIcon serviceId={service.id}/><i className={`statusDot ${state === "Connected" ? "connected" : state === "Not connected" ? "disconnected" : "unavailable"}`}/></span>
          <span>{service.shortName}</span>
        </button>;
      })}
    </div>
  </section>;
}
