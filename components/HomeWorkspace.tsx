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
  image: { mimeType: "image/jpeg" | "image/png" | "image/webp"; data: string; name: string } | null;
  setImage: (image: Props["image"]) => void;
};

export default function HomeWorkspace({ task, setTask, selectedService, selectService, routeTask, busy, connectedIds, image, setImage }: Props) {
  const input = useRef<HTMLTextAreaElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showAllServices, setShowAllServices] = useState(false);
  useEffect(() => {
    if (task.length > 0) return;
    const timer = window.setInterval(() => {
      setPlaceholderIndex(index => (index + 1) % SMAJ_SERVICES.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [task.length]);
  const selected = SMAJ_SERVICES.find(service => service.id === selectedService);
  const connectedServices = SMAJ_SERVICES.filter(service => service.adapterMode === "connected" && connectedIds.has(service.id));
  const connectedServiceIds = new Set(connectedServices.map(service => service.id));
  const orderedServices = [...connectedServices, ...SMAJ_SERVICES.filter(service => !connectedServiceIds.has(service.id))];
  const visibleServices = showAllServices ? orderedServices : orderedServices.slice(0, 5);
  const status = (id: ServiceId) => {
    const service = SMAJ_SERVICES.find(item => item.id === id)!;
    return service.adapterMode === "planning_only" ? "Planned" : connectedIds.has(id) ? "Connected" : "Not connected";
  };
  const ready = !selected || status(selected.id) === "Connected";
  const chooseImage = (file?: File) => {
    setImageError("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setImageError("Choose a JPEG, PNG, or WebP image."); return; }
    if (file.size > 4 * 1024 * 1024) { setImageError("Images must be smaller than 4 MB."); return; }
    const reader = new FileReader();
    reader.onerror = () => setImageError("The image could not be read. Try another file.");
    reader.onload = () => {
      if (typeof reader.result !== "string") { setImageError("The image could not be read. Try another file."); return; }
      setImage({ mimeType: file.type as "image/jpeg" | "image/png" | "image/webp", data: reader.result.split(",", 2)[1] || "", name: file.name });
    };
    reader.readAsDataURL(file);
  };

  return <section className={`homeView launcherHome ${styles.root}`}>
    <p className={styles.eyebrow}>YOUR WORKSPACE</p><h1 className={styles.title}>What can I help you do?</h1>
    <form className={`centralComposer compactComposer ${styles.composer}`} onSubmit={routeTask} aria-label="Create an AI task" aria-busy={busy === "routing"}>
      <label className="visuallyHidden" htmlFor="ai-task">Your AI task</label>
      <div className={styles.promptInput}>
        <textarea ref={input} id="ai-task" value={task} onChange={event => setTask(event.target.value)} placeholder="" maxLength={1900} rows={3} />
        {!task && <span className={styles.rotatingPlaceholder} aria-hidden="true"><span key={placeholderIndex}>{SMAJ_SERVICES[placeholderIndex].example}…</span></span>}
      </div>
      <div className={styles.toolbar}>
        <input ref={gallery} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { chooseImage(event.target.files?.[0]); event.target.value = ""; }} />
        <input ref={camera} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event => { chooseImage(event.target.files?.[0]); event.target.value = ""; }} />
        <button type="button" className={styles.mediaButton} aria-label="Attach an image from gallery" onClick={() => gallery.current?.click()}>＋ Image</button>
        <button type="button" className={styles.mediaButton} aria-label="Take a photo" onClick={() => camera.current?.click()}>Camera</button>
        {selected && <button type="button" className={`${styles.tool} ${styles.apps}`} onClick={() => selectService(null)} aria-label={`Clear ${selected.shortName} context`}><ServiceIcon serviceId={selected.id}/><span>{selected.shortName}</span><span className={styles.clear} aria-hidden="true">×</span></button>}
        <button type="submit" className={styles.submit} disabled={(!task.trim()&&!image) || busy === "routing"}>{busy === "routing" ? <><span className="spinner"/>Asking AI…</> : <>Ask SMAJ AI <span aria-hidden="true">↗</span></>}</button>
      </div>
      {image&&<div className={styles.imagePreview}><img src={`data:${image.mimeType};base64,${image.data}`} alt={`Preview of ${image.name}`}/><span>{image.name}</span><button type="button" aria-label="Remove attached image" onClick={()=>setImage(null)}>×</button></div>}
      {imageError&&<p className={styles.imageError} role="alert">{imageError}</p>}
      <small className={styles.mediaDisclosure}>Images are sent to the configured Meta model when you submit them and are not saved in history.</small>
    </form>
    {selected && <div className="serviceContext" role="status"><span><strong>{selected.name}</strong> · {status(selected.id)}{status(selected.id) === "Planned" ? " — integration not available yet." : !ready ? " — use Apps in the header to connect this app." : " — task context selected."}</span></div>}
    <div className={styles.suggestions} aria-label="Suggested requests">
      {[{ label: "Find jobs", prompt: "Find software engineering jobs" }, { label: "Shop cars", prompt: "Find cars under $30,000" }, { label: "Explore courses", prompt: "Show available online courses" }, { label: "Health services", prompt: "Find nearby health services" }].map(suggestion => <button key={suggestion.label} type="button" onClick={() => { selectService(null); setTask(suggestion.prompt); input.current?.focus({ preventScroll: true }); }}>{suggestion.label}</button>)}
    </div>
    <div className={styles.servicesHeading}>
      <div className={styles.servicesHeadingContent}>
        <h2>Connected services</h2>
      </div>
    </div>
    <div className={`launcherLegend ${styles.legend}`} aria-label="Service status legend"><span><i className="statusDot connected"/>Connected</span><span><i className="statusDot disconnected"/>Not connected</span><span><i className="statusDot unavailable"/>Planned</span></div>
    <div id="home-services-list" className={styles.services} aria-label="Choose a service">
      {visibleServices.map(service => {
        const state = status(service.id);
        return <button key={service.id} type="button" className={styles.service} aria-pressed={selectedService === service.id} aria-label={`${service.shortName}, ${state}`} onClick={() => { selectService(service.id); setTask(service.example); input.current?.focus({ preventScroll: true }); }}>
          <span className={styles.art}><ServiceIcon serviceId={service.id}/></span>
          <span className={styles.serviceLabel}>{service.shortName}<i className={`statusDot ${state === "Connected" ? "connected" : state === "Not connected" ? "disconnected" : "unavailable"}`}/></span>
        </button>;
      })}
    </div>
    {!showAllServices && orderedServices.length > 5 && <button type="button" className={styles.showAll} aria-expanded={showAllServices} aria-controls="home-services-list" onClick={() => setShowAllServices(true)}>Show all services</button>}
    {showAllServices && <button type="button" className={styles.showAll} aria-expanded={showAllServices} aria-controls="home-services-list" onClick={() => setShowAllServices(false)}>Show fewer services</button>}
  </section>;
}
