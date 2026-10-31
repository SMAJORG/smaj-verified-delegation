"use client";

import { useEffect, useRef } from "react";
import styles from "./WhyItMatters.module.css";

const capabilities = [
  { title: "Understand Your Goal", description: "SMAJ AI understands what users want to accomplish.", icon: "goal" },
  { title: "AI-Powered Planning", description: "Meta AI generates structured, actionable plans.", icon: "plan" },
  { title: "Human Approval", description: "Users review and approve actions before execution.", icon: "approval", highlight: "You stay in control" },
  { title: "Smart Delegation", description: "Approved tasks move through the delegation workflow, using simulated execution in the current demo.", icon: "delegate" },
  { title: "Failure Recovery", description: "Track failures, retries, and recovery steps.", icon: "recovery" },
  { title: "Verifiable Proof", description: "Generate downloadable PDF and JSON receipts showing what happened.", icon: "proof", highlight: "Evidence you can keep" },
];

function CapabilityIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    goal: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="m12 12 8-8M16 4h4v4" /></>,
    plan: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="m8 8 1 1 2-2m2 1h3M8 13h8m-8 4h5" /></>,
    approval: <><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
    delegate: <><rect x="9" y="3" width="6" height="5" rx="1.5" /><rect x="3" y="16" width="6" height="5" rx="1.5" /><rect x="15" y="16" width="6" height="5" rx="1.5" /><path d="M12 8v4M6 16v-4h12v4" /></>,
    recovery: <><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" /><path d="M12 8v5l3 2" /></>,
    proof: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" /><path d="M14 3v6h6m-12 6 3 3 5-6" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function WhyItMatters() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add(styles.revealed);
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12 });
    const cards = section.querySelectorAll(`.${styles.card}`);
    cards.forEach(card => observer.observe(card));
    section.classList.add(styles.motionReady);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="compare" className={styles.section} ref={sectionRef} aria-labelledby="why-it-matters-heading">
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.label}><span aria-hidden="true" />Why it matters</span>
          <h2 id="why-it-matters-heading">Beyond Chatbots.<br /><span>AI Actions You Can Trust.</span></h2>
          <p>From understanding your goal to delivering verifiable results—with you in control.</p>
        </header>
        <ol className={styles.grid}>
          {capabilities.map((capability, index) => (
            <li key={capability.title} className={`${styles.card} ${capability.highlight ? styles.highlight : ""}`}>
              <div className={styles.cardTop}>
                <span className={styles.icon}><CapabilityIcon name={capability.icon} /></span>
                <span className={styles.number} aria-hidden="true">0{index + 1}</span>
              </div>
              <h3>{capability.title}</h3>
              <p>{capability.description}</p>
              {capability.highlight && <span className={styles.badge}><span aria-hidden="true">✦</span> {capability.highlight}</span>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
