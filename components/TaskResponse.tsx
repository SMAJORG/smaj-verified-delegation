"use client";
import { useEffect, useState } from "react";

export function Analyzing() {
  return <div className="taskAnalyzing" role="status"><span className="taskDots" aria-hidden="true"><i/><i/><i/></span><span>Analyzing your request…</span></div>;
}

export function TypedResponse({ text }: { text: string }) {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    setVisible(0);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setVisible(text.length); return; }
    let position = 0;
    let timer: ReturnType<typeof setTimeout>;
    const type = () => {
      position = Math.min(text.length, position + Math.max(1, Math.ceil(text.length / 350)));
      setVisible(position);
      if (position < text.length) timer = setTimeout(type, /[,.!?]/.test(text[position - 1]) ? 100 : 18);
    };
    timer = setTimeout(type, 30);
    return () => clearTimeout(timer);
  }, [text]);
  return <div className="taskAnswer"><span className="taskSrOnly">{text}</span><span aria-hidden="true" className={visible < text.length ? "taskCursor" : ""}>{text.slice(0, visible)}</span></div>;
}
