"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { MetaModel } from "@/src/server/meta-client";
import styles from "./ModelSelector.module.css";

type ModelsState = { models: MetaModel[]; selected: string; error: string; notice: string; refresh: () => Promise<void>; select: (id: string) => void };
const ModelContext = createContext<ModelsState | null>(null);
const STORAGE_KEY = "smaj-ai-selected-meta-model";
export function ModelProvider({ children }: { children: ReactNode }) {
  const [models, setModels] = useState<MetaModel[]>([]);
  const [selected, setSelected] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return window.localStorage.getItem(STORAGE_KEY) || ""; } catch { return ""; }
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inFlight = useRef<Promise<void> | null>(null);
  const select = useCallback((id: string) => {
    setSelected(id); setNotice("");
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* Selection still works without browser storage. */ }
  }, []);
  const refresh = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    const load = async () => {
      try {
        const response = await fetch("/api/models", { cache: "no-store", signal: AbortSignal.timeout(15000) });
        const payload = await response.json();
        if (!response.ok) throw new Error(`${payload.message || "Meta models could not be loaded."} (${payload.error || response.status})`);
        setModels(payload.models); setError("");
        let saved = "";
        try { saved = localStorage.getItem(STORAGE_KEY) || ""; } catch { /* Storage is optional. */ }
        const next = payload.models.some((model: MetaModel) => model.id === saved) ? saved : payload.defaultModel;
        select(next);
        if (saved && saved !== next) setNotice("Your previous model is unavailable. The available default is selected for your next message.");
      } catch (failure) {
        setModels([]); setError(failure instanceof Error ? failure.message : "Meta models could not be loaded.");
      }
    };
    inFlight.current = load().finally(() => { inFlight.current = null; });
    return inFlight.current;
  }, [select]);
  return <ModelContext.Provider value={{ models, selected, error, notice, refresh, select }}>{children}</ModelContext.Provider>;
}
export function useMetaModels() {
  const state = useContext(ModelContext);
  if (!state) throw new Error("Meta model controls require ModelProvider");
  return state;
}
export default function ModelSelector() {
  const { models, selected, error, notice, refresh, select } = useMetaModels();
  const [open, setOpen] = useState(false);
  const [menuHeight, setMenuHeight] = useState(300);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    root.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const current = models.find(model => model.id === selected);
  return <div ref={root} className={styles.root}>
    <button ref={trigger} type="button" className={styles.trigger} aria-label={`Select Meta model: ${current?.name || "models unavailable"}`} aria-haspopup="menu" aria-expanded={open} aria-controls={id} title={current?.id} onClick={() => { setMenuHeight(Math.min(390, window.innerHeight * .55, Math.max(100, (trigger.current?.getBoundingClientRect().top || 300) - 16))); setOpen(value => !value); }}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></svg>
      <span>{current?.name || "Meta models"}</span><span aria-hidden="true">⌄</span>
    </button>
    {open && <div id={id} className={styles.menu} style={{ maxHeight: menuHeight }} role="menu" aria-label="Meta models" onKeyDown={event => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="menuitemradio"]')];
      if (!items.length) return;
      event.preventDefault(); const index = items.indexOf(document.activeElement as HTMLButtonElement);
      items[event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
    }}>
      <p className={styles.heading}>Choose a Meta model</p>
      {notice && <p className={styles.status} role="status">{notice}</p>}
      {error && <p className={styles.status} role="alert">{error}</p>}
      {models.map(model => <button type="button" role="menuitemradio" aria-checked={model.id === selected} key={model.id} className={styles.option} onClick={() => { select(model.id); setOpen(false); trigger.current?.focus(); }}><span><strong>{model.name}</strong><small>{model.description}</small></span><span aria-hidden="true">{model.id === selected ? "✓" : ""}</span></button>)}
      <button type="button" role="menuitem" className={styles.retry} onClick={() => void refresh()}>Refresh models</button>
    </div>}
    {notice && !open && <span className={styles.srOnly} role="status">{notice}</span>}
  </div>;
}
