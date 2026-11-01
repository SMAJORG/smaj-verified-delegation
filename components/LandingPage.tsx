"use client";
import { useState } from "react";
import "./reference-landing.css";
import BrandLogo from "./BrandLogo";
import HubServicesSection from "./HubServicesSection";
import WhyItMatters from "./WhyItMatters";
import { TASK_PHASES } from "@/src/domain/task-state";

export default function LandingPage({ checking, ssoEnabled, error }: { checking: boolean; ssoEnabled: boolean; error: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const signIn = <a className="pill" href={ssoEnabled ? "/api/auth/sso" : "https://smajpihub.com/ai"}>Continue with SMAJ PI HUB →</a>;
  return <div className="referenceLanding">
    <header className="nav"><a className="brand" href="#top" aria-label="SMAJ AI home"><BrandLogo className="navLogo"/></a><div className="navright">{signIn}<button className="menu" type="button" aria-label="Open menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(!menuOpen)}>☰</button></div><nav className="menuPanel" hidden={!menuOpen}><a href="#how">How it works</a><a href="#compare">Why SMAJ AI</a><a href="https://smajpihub.com/ai">Open SMAJ PI HUB</a></nav></header>
    <main id="top"><section className="hero"><div className="eyebrow">SMAJ PI HUB · VERIFIED DELEGATION</div><h1>AI actions you can verify.</h1><p>Ask Meta AI to plan your request, discover published Jobs, Store and Stream records, and review supported actions before execution.</p>{signIn}<small>Real model responses · Your approval · Backend evidence</small>{checking&&<p role="status">Checking secure session…</p>}{error&&<p role="alert">{error}</p>}</section>
      <section className="wrap" id="how"><span className="sectionlabel">Your request, your control</span><h2 className="sectiontitle">From a request to recorded evidence.</h2><div className="progressFlow" aria-label="Request workflow">{TASK_PHASES.map(phase=><span key={phase}>{phase}</span>)}</div><p>Activity appears only when a model response, service read, approved action, or backend verification actually occurs. Failed connections and unavailable services are reported. Proof receipts are available only after approved actions are verified.</p></section>
      <HubServicesSection/><WhyItMatters/>
    </main><footer className="footer">SMAJ AI · Verified Delegation<br/>Part of SMAJ PI HUB</footer>
  </div>;
}
