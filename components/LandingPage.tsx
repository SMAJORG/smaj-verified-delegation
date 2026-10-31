"use client";

import { useEffect, useRef, useState } from "react";
import "./reference-landing.css";
import ServiceIcon from "./ServiceIcon";
import ConversationShowcase from "./ConversationShowcase";
import HubServicesSection from "./HubServicesSection";

type LandingPageProps = {
  authenticated: boolean | null;
  ssoEnabled: boolean;
  demoEnabled: boolean;
  startDemo: () => void;
  accessToken: string;
  setAccessToken: (value: string) => void;
  busy: string | null;
  error: string;
  login: (event: React.FormEvent) => void;
};

const comparison = [
  ["What matters", "Basic chatbot", "SMAJ AI"],
  ["Action plan", "Text suggestions", "Structured AI plan"],
  ["Control", "You interpret replies", "Explicit approval"],
  ["Failures", "Try again yourself", "Recovery tracking"],
  ["Evidence", "Conversation history", "PDF + JSON proof"],
];

export default function LandingPage({ authenticated, ssoEnabled, demoEnabled, startDemo, accessToken, setAccessToken, busy, error, login }: LandingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const accessRef = useRef<HTMLElement>(null);
  const checking = authenticated === null;
  const demoDisabled = checking || !demoEnabled || busy !== null;

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); navRef.current?.querySelector<HTMLButtonElement>(".menu")?.focus(); } };
    const closeOutside = (event: PointerEvent) => { if (!navRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => { document.removeEventListener("keydown", closeOnEscape); document.removeEventListener("pointerdown", closeOutside); };
  }, [menuOpen]);

  useEffect(() => {
    if (authOpen) {
      accessRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      accessRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    }
  }, [authOpen]);

  return (
    <div className="referenceLanding">
      <header className="nav" ref={navRef}>
        <a className="brand" href="#top" aria-label="SMAJ AI home">SMAJ<span> AI</span></a>
        <div className="navright">
          <button className="pill" type="button" disabled={demoDisabled} onClick={startDemo}>{busy === "demo" ? "Preparing demo…" : "Try Live Demo"}</button>
          <button className="menu" type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="landing-menu" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        </div>
        <nav id="landing-menu" className="menuPanel" aria-label="Main navigation" hidden={!menuOpen} onClick={() => setMenuOpen(false)}>
          <a href="#how">How it works</a>
          <a href="#features">Capabilities</a>
          <a href="#compare">Why SMAJ AI</a>
          <a href="#demo">Live demo</a>
          <button type="button" onClick={() => setAuthOpen(true)}>Workspace sign-in</button>
        </nav>
      </header>
      <main id="top">
        <section className="hero">
          <div className="heroServices" aria-label="Store, Jobs, Stream, 13+">
            <ServiceIcon serviceId="store" />
            <ServiceIcon serviceId="jobs" />
            <ServiceIcon serviceId="stream" />
            <span aria-hidden="true">13+</span>
          </div>
          <div className="eyebrow">SMAJ PI HUB · PI NETWORK ECOSYSTEM</div>
          <h1>Not just AI answers.<br />AI actions you can verify.</h1>
          <p>Describe your goal. Let Meta AI plan the work. Approve each action and receive a clear record of what happened.</p>
          <button className="pill" type="button" disabled={demoDisabled} onClick={startDemo}>{busy === "demo" ? "Preparing demo…" : "Explore Live Demo →"}</button>
          <small>Meta AI-powered planning · Human approval · Simulated execution</small>
          {busy === "demo" && <small role="status">Creating your private demo workspace…</small>}
          {error && !authOpen && <small role="alert">{error}</small>}
        </section>
        <section className="wrap" id="how">
          <span className="sectionlabel">Built for trusted delegation</span>
          <h2 className="sectiontitle">From your goal to proof. Every step visible.</h2>
          <ConversationShowcase />
        </section>
        <HubServicesSection />
        <section className="wrap" id="compare">
          <span className="sectionlabel">Why it matters</span>
          <h2 className="sectiontitle">A chatbot replies.<br />SMAJ AI tracks the work.</h2>
          <div className="comparison" role="table" aria-label="Basic chatbot and SMAJ AI comparison">
            {comparison.map((row, index) => <div className="row" role="row" key={row[0]}>{row.map((cell, column) => <div role={index === 0 ? "columnheader" : column === 0 ? "rowheader" : "cell"} key={cell}>{cell}</div>)}</div>)}
          </div>
        </section>
        <section className="wrap" id="demo">
          <div className="cta" aria-busy={busy === "demo"}>
            <span className="eyebrow">META AI HACKATHON DEMO</span>
            <h2>Stop guessing what AI did.<br />See the proof.</h2>
            <p>Try a real AI planning flow with human approval and simulated SMAJ PI HUB Jobs actions.</p>
            <button className="pill" type="button" disabled={demoDisabled} onClick={startDemo}>{busy === "demo" ? "Preparing demo…" : "Launch Demo →"}</button>
            {checking && <p className="demoStatus" role="status">Checking secure session…</p>}
            {!checking && !demoEnabled && <p className="demoStatus" role="status">Demo access is currently unavailable. <button className="textButton" onClick={() => setAuthOpen(true)}>Sign in to your workspace</button>.</p>}
            {busy === "demo" && <p className="demoStatus" role="status">Creating your private demo workspace…</p>}
            {error && <p className="demoError" role="alert">{error}</p>}
            <p className="demoDisclaimer">Demo only: no real job applications or Pi payments. Not affiliated with or endorsed by Pi Network or Meta.</p>
          </div>
        </section>
        {authOpen && <section className="wrap accessSection" id="access" ref={accessRef} aria-labelledby="access-heading">
          <div className="accessCard">
            <button className="accessClose" type="button" aria-label="Close workspace sign-in" onClick={() => { setAuthOpen(false); navRef.current?.querySelector<HTMLButtonElement>(".menu")?.focus(); }}>×</button>
            <span className="sectionlabel">Existing workspace</span>
            <h2 id="access-heading">Welcome back.</h2>
            {ssoEnabled && <a className="pill ssoButton" href="/api/auth/sso">Continue with SMAJ PI HUB →</a>}
            <form onSubmit={login}>
              <label htmlFor="landing-access-token">Access token</label>
              <input id="landing-access-token" type="password" autoComplete="off" value={accessToken} onChange={event => setAccessToken(event.target.value)} placeholder="Enter your access token" required />
              <button className="pill" disabled={!accessToken || busy !== null || checking}>{busy === "login" ? "Signing in…" : "Open workspace →"}</button>
            </form>
            {error && <p className="authError" role="alert">{error}</p>}
            <small>Protected by a secure HttpOnly session.</small>
          </div>
        </section>}
      </main>
      <footer className="footer">SMAJ AI · Verified Delegation<br />Part of SMAJ PI HUB · Built for the Pi Network ecosystem</footer>
    </div>
  );
}
