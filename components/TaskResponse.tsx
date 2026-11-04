"use client";
import { useEffect, useState } from "react";

export function Analyzing() {
  return <span className="taskDots" role="status" aria-label="SMAJ AI is responding"><i/><i/><i/></span>;
}

export function TypedResponse({ text }: { text: string }) {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(text.length);
      return;
    }
    if (visible >= text.length) return;
    const timer = setTimeout(() => setVisible(position => Math.min(text.length, position + 1)), /[,.!?]/.test(text[visible - 1] || "") ? 90 : 18);
    return () => clearTimeout(timer);
  }, [text, visible]);
  return <div className="taskAnswer"><span className="taskSrOnly">{text}</span><span aria-hidden="true" className={visible < text.length ? "taskCursor" : ""}>{text.slice(0, visible)}</span></div>;
}
