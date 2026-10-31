"use client";

import BrandLogo from "@/components/BrandLogo";

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

const stages = ["User Goal", "Meta AI Planning", "Human Approval", "Delegated Execution", "Recovery", "Verified Proof"];
const capabilities = [
  { number: "01", title: "Plan with AI", text: "Transform user requests into structured, actionable plans using Meta AI.", symbol: "✧" },
  { number: "02", title: "Approve & Delegate", text: "Stay in control by approving actions before execution.", symbol: "✓" },
  { number: "03", title: "Verify Every Result", text: "Track execution, handle failures, and generate downloadable proof receipts.", symbol: "↗" },
];

export default function LandingPage({ authenticated, ssoEnabled, demoEnabled, startDemo, accessToken, setAccessToken, busy, error, login }: LandingPageProps) {
  const checking = authenticated === null;
  const demoDisabled = checking || !demoEnabled || busy !== null;
  const demoLabel = busy === "demo" ? "Preparing your workspace…" : "Try Live AI Demo →";

  return (
    <div className="productLanding">
      <header className="landingHeader">
        <a className="landingBrand" href="/" aria-label="SMAJ AI — Verified Delegation home">
          <BrandLogo />
          <span><strong>SMAJ AI<span className="brandSeparator">/</span><span className="brandProduct">Verified Delegation</span></strong><small>PART OF SMAJ PI HUB</small></span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#access">Workspace sign-in <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <main className="landingMain">
        {error && <div className="landingError" role="alert">{error}</div>}
        <section className="landingHero" aria-labelledby="hero-heading">
          <div className="heroContent">
            <p className="landingEyebrow"><span aria-hidden="true" /> AI PLANS. YOU APPROVE. PROOF FOLLOWS.</p>
            <h1 id="hero-heading">AI That Doesn&apos;t Just Answer. <span>It Gets Things Done.</span></h1>
            <p className="heroDescription">Turn your goals into actionable plans. Review and approve every step. Let AI execute approved tasks and receive verifiable proof of the outcome.</p>
            <button className="landingPrimary" onClick={startDemo} disabled={demoDisabled}>{busy === "demo" && <span className="spinner" />}{demoLabel}</button>
            <p className="heroPowered">Powered by Meta AI <span>·</span> Connected to SMAJ PI HUB Services</p>
            <p className="heroDemoNote" role="status">{checking ? "Checking secure session…" : busy === "demo" ? "Creating a secure session and loading sample data…" : demoEnabled ? "No account needed · Simulated actions · Private demo workspace" : "Interactive demo is currently unavailable. Use workspace sign-in below."}</p>
          </div>

          <aside className="delegationPreview" aria-label="Illustrative delegation workflow with simulated results">
            <div className="previewTop"><span><i /> DELEGATION PREVIEW</span><span className="simulationBadge">Simulated</span></div>
            <div className="previewGoal"><span className="previewAvatar" aria-hidden="true">You</span><div><small>YOUR GOAL</small><p>Find engineering roles that match my skills.</p></div></div>
            <div className="previewSteps">
              <div className="previewStep"><span className="previewStepIcon" aria-hidden="true">✧</span><div><strong>Meta AI builds a plan</strong><p>Match roles. Prepare application drafts.</p></div><span className="previewStatus">Planned</span></div>
              <div className="previewStep"><span className="previewStepIcon" aria-hidden="true">✓</span><div><strong>You review & approve</strong><p>Only your selected actions can proceed.</p></div><span className="previewStatus">Approved</span></div>
              <div className="previewStep"><span className="previewStepIcon" aria-hidden="true">↗</span><div><strong>AI executes the approved plan</strong><p>Local mock applications are submitted.</p></div><span className="previewStatus">Executed</span></div>
              <div className="previewStep recoveryStep"><span className="previewStepIcon" aria-hidden="true">↻</span><div><strong>A failure? Recover safely.</strong><p>Retry a simulated transient error.</p></div><span className="previewStatus">Recovered</span></div>
            </div>
            <div className="previewProof"><span className="proofCheck" aria-hidden="true">✓</span><div><strong>Verified proof receipt</strong><p>Outcome checked. Evidence ready to download.</p></div><span className="proofFormat">PDF / JSON</span></div>
            <p className="previewCaption">Illustrative workflow · No real applications submitted</p>
          </aside>
        </section>

        <section className="delegationPipeline" aria-label="Complete AI delegation workflow">
          <p>FROM INTENT TO EVIDENCE</p>
          <ol>{stages.map((stage, index) => <li key={stage}><span className="pipelineNumber">{String(index + 1).padStart(2, "0")}</span><span>{stage}</span>{index < stages.length - 1 && <span className="pipelineArrow" aria-hidden="true">→</span>}</li>)}</ol>
        </section>

        <section id="how-it-works" className="landingCapabilities" aria-label="Three core capabilities">
          {capabilities.map(capability => <article key={capability.number}><div className="capabilityTop"><span className="capabilityIcon" aria-hidden="true">{capability.symbol}</span><span>{capability.number}</span></div><h2>{capability.title}</h2><p>{capability.text}</p></article>)}
        </section>

        <section className="landingDemo" aria-labelledby="demo-heading">
          <div><p className="landingEyebrow">THE HACKATHON EXPERIENCE</p><h2 id="demo-heading">See AI Delegation in Action</h2><p>Experience how SMAJ AI plans, delegates, recovers from failures, and verifies outcomes using simulated SMAJ PI HUB Jobs workflows.</p></div>
          <div className="demoCallToAction"><button className="landingPrimary" onClick={startDemo} disabled={demoDisabled}>{busy === "demo" ? "Preparing your workspace…" : "Launch Interactive Demo →"}</button><small>Demo actions are simulated. No real job applications or Pi payments are processed.</small></div>
        </section>

        <section id="access" className="landingAccess" aria-label="Workspace authentication">
          <div><strong>Already have workspace access?</strong><p>Continue securely with your existing credentials.</p></div>
          <div className="landingSignIn">
            {ssoEnabled && <a className="landingSso" href="/api/auth/sso">Continue with SMAJ PI HUB ↗</a>}
            <details className="landingToken"><summary>Sign in with an access token</summary><form onSubmit={login}><label htmlFor="landing-access-token">Access token</label><div><input id="landing-access-token" type="password" autoComplete="off" value={accessToken} onChange={event => setAccessToken(event.target.value)} placeholder="Enter your access token" required /><button className="landingPrimary" disabled={!accessToken || busy !== null || checking}>{busy === "login" ? "Signing in…" : "Open workspace →"}</button></div><small>Protected by a secure HttpOnly session.</small></form></details>
          </div>
        </section>
      </main>

      <footer className="landingFooter"><p><strong>SMAJ AI</strong> — Verified Delegation<span>Built for the Pi Network Ecosystem</span></p><small>Independent project. No official Meta or Pi Network endorsement.</small></footer>
    </div>
  );
}
