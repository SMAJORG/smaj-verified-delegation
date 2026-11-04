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
  reportError: (message: string) => void;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: Event & { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };

export default function HomeWorkspace({ task, setTask, selectedService, selectService, routeTask, busy, connectedIds, image, setImage, reportError }: Props) {
  const input = useRef<HTMLTextAreaElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const attachmentMenu = useRef<HTMLDivElement>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
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
    setAttachmentMenuOpen(false);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { reportError("Choose a JPEG, PNG, or WebP image."); return; }
    if (file.size > 4 * 1024 * 1024) { reportError("Images must be smaller than 4 MB."); return; }
    const reader = new FileReader();
    reader.onerror = () => reportError("The image could not be read. Try another file.");
    reader.onload = () => {
      if (typeof reader.result !== "string") { reportError("The image could not be read. Try another file."); return; }
      setImage({ mimeType: file.type as "image/jpeg" | "image/png" | "image/webp", data: reader.result.split(",", 2)[1] || "", name: file.name });
    };
    reader.readAsDataURL(file);
  };
  const startVoice = () => {
    const SpeechRecognition = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognition) { reportError("Voice input is not supported in this browser."); return; }
    try {
      const current = new SpeechRecognition();
      current.lang = navigator.language || "en-US";
      current.continuous = false;
      current.interimResults = true;
      current.onresult = event => setTask(Array.from(event.results).map(result => result[0]?.transcript || "").join("").trim());
      current.onerror = event => {
        reportError(event.error === "not-allowed" || event.error === "service-not-allowed" ? "Microphone permission was denied. Allow microphone access or type your message." : "Voice recognition failed. Please try again or type your message.");
      };
      current.onend = () => { recognition.current = null; };
      recognition.current = current;
      current.start();
    } catch { reportError("The microphone could not be started. Check browser permissions."); }
  };
  useEffect(() => {
    if (!attachmentMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => { if (!attachmentMenu.current?.contains(event.target as Node)) setAttachmentMenuOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setAttachmentMenuOpen(false); };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOnOutsideClick); document.removeEventListener("keydown", closeOnEscape); };
  }, [attachmentMenuOpen]);
  useEffect(() => () => recognition.current?.stop(), []);

  return <section className={`homeView launcherHome ${styles.root}`}>
    <p className={styles.eyebrow}>YOUR WORKSPACE</p><h1 className={styles.title}>What can I help you do?</h1>
    <form className={`centralComposer compactComposer ${styles.composer}`} onSubmit={routeTask} aria-label="Create an AI task" aria-busy={busy === "routing"}>
      <label className="visuallyHidden" htmlFor="ai-task">Your AI task</label>
      <div className={styles.promptInput}>
        {image&&<div className={styles.imagePreview}><img src={`data:${image.mimeType};base64,${image.data}`} alt="Attached image preview"/><button type="button" aria-label="Remove attached image" onClick={()=>setImage(null)}>×</button></div>}
        <textarea ref={input} id="ai-task" value={task} onChange={event => setTask(event.target.value)} onInput={event=>{event.currentTarget.style.height="auto";event.currentTarget.style.height=`${Math.min(event.currentTarget.scrollHeight,240)}px`;}} placeholder="" maxLength={1900} rows={1} />
        {!task && <span className={styles.rotatingPlaceholder} aria-hidden="true"><span key={placeholderIndex}>{SMAJ_SERVICES[placeholderIndex].example}…</span></span>}
      </div>
      <div className={styles.toolbar}>
        <input ref={gallery} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { chooseImage(event.target.files?.[0]); event.target.value = ""; }} />
        <input ref={camera} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event => { chooseImage(event.target.files?.[0]); event.target.value = ""; }} />
        <div className={styles.attachmentMenuWrap} ref={attachmentMenu}>
          <button type="button" className={styles.attachButton} aria-label="Add an attachment" aria-expanded={attachmentMenuOpen} aria-haspopup="menu" disabled={busy==="routing"} onClick={()=>setAttachmentMenuOpen(open=>!open)}>+</button>
          {attachmentMenuOpen&&<div className={styles.attachmentMenu} role="menu" aria-label="Add an attachment">
            <button type="button" role="menuitem" onClick={()=>{setAttachmentMenuOpen(false);gallery.current?.click();}}>Upload Image</button>
            <button type="button" role="menuitem" onClick={()=>{setAttachmentMenuOpen(false);camera.current?.click();}}>Camera</button>
            <button type="button" role="menuitem" onClick={()=>{setAttachmentMenuOpen(false);startVoice();}}>Microphone</button>
          </div>}
        </div>
        <button type="submit" className={styles.submit} aria-label="Send message" disabled={(!task.trim()&&!image) || busy === "routing"}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button>
      </div>
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
