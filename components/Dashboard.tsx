"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DelegationView, JobsApiJob } from "@/src/domain/types";

type ApiResponse = { delegation?: DelegationView; delegations?: DelegationView[]; message?: string };

const statusLabels: Record<string, string> = {
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  executing: "Executing",
  retrying: "Recovering",
  verifying: "Verifying",
  verified: "Verified",
  failed: "Needs attention",
};

const time = (value: string) => new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));

const Icon = ({ name }: { name: "shield" | "spark" | "check" | "database" | "arrow" | "receipt" }) => {
  const paths = {
    shield: <path d="M12 3 5 6v5c0 4.7 2.8 8.3 7 10 4.2-1.7 7-5.3 7-10V6l-7-3Zm-3 9 2 2 4-4" />,
    spark: <path d="m12 2 1.4 5.1L18 9l-4.6 1.9L12 16l-1.4-5.1L6 9l4.6-1.9L12 2Zm6 12 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    database: <path d="M4 6c0-2 3.6-3 8-3s8 1 8 3-3.6 3-8 3-8-1-8-3Zm0 0v6c0 2 3.6 3 8 3s8-1 8-3V6M4 12v6c0 2 3.6 3 8 3s8-1 8-3v-6" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6" />,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
};

export default function Dashboard() {
  const [delegation, setDelegation] = useState<DelegationView | null>(null);
  const [history, setHistory] = useState<DelegationView[]>([]);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [candidateName, setCandidateName] = useState("Amina Okafor");
  const [skills, setSkills] = useState("TypeScript, React, Node.js, REST APIs");
  const [goal, setGoal] = useState("Find three matching SMAJ Jobs opportunities and prepare tailored applications for my approval.");
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [injectFailure, setInjectFailure] = useState(true);
  const streamRef = useRef<EventSource | null>(null);

  const jobsById = useMemo(() => new Map((delegation?.jobs || []).map(job => [job.id, job])), [delegation]);

  const updateDelegation = (next: DelegationView) => {
    setDelegation(next);
    setHistory(current => [next, ...current.filter(item => item.id !== next.id)]);
  };

  const loadHistory = async () => {
    const response = await fetch("/api/delegations", { cache: "no-store" });
    if (response.status === 401 || response.status === 503) {
      setAuthenticated(false);
      return;
    }
    if (!response.ok) throw new Error("Task history could not be loaded");
    const payload = await response.json() as ApiResponse;
    setAuthenticated(true);
    setHistory(payload.delegations || []);
  };

  useEffect(() => {
    loadHistory().catch(error => {
      setAuthenticated(false);
      setError(error instanceof Error ? error.message : "Authentication check failed");
    });
    return () => streamRef.current?.close();
  }, []);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy("login");
    setError("");
    try {
      const response = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken }) });
      const payload = await response.json() as ApiResponse;
      if (!response.ok) throw new Error(payload.message || "Authentication failed");
      setAccessToken("");
      await loadHistory();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Authentication failed");
    } finally { setBusy(null); }
  };

  const logout = async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    streamRef.current?.close();
    setAuthenticated(false);
    setDelegation(null);
    setHistory([]);
  };

  const watch = (id: string) => {
    streamRef.current?.close();
    const source = new EventSource(`/api/delegations/${id}/events`);
    source.addEventListener("delegation", event => {
      const next = JSON.parse((event as MessageEvent).data) as DelegationView;
      updateDelegation(next);
      if (["verified", "failed"].includes(next.status)) source.close();
    });
    source.onerror = () => source.close();
    streamRef.current = source;
  };

  const request = async (url: string, body: Record<string, unknown>, action: string) => {
    setBusy(action);
    setError("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": `ui_${crypto.randomUUID()}` }, body: JSON.stringify(body) });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.delegation) throw new Error(payload.message || `Request failed with HTTP ${response.status}`);
      updateDelegation(payload.delegation);
      return payload.delegation;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The workflow request failed.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const createDelegation = async (event: React.FormEvent) => {
    event.preventDefault();
    const created = await request("/api/delegations", { goal, candidateName, skills: skills.split(",").map(value => value.trim()).filter(Boolean), maxApplications: 3 }, "planning");
    if (created) setSelectedJobs(created.selectedJobIds);
  };

  const approve = () => delegation && request(`/api/delegations/${delegation.id}/approve`, { selectedJobIds: selectedJobs }, "approving");
  const execute = () => {
    if (!delegation) return;
    watch(delegation.id);
    return request(`/api/delegations/${delegation.id}/execute`, { injectTransientFailure: injectFailure }, "executing");
  };

  const openHistory = (item: DelegationView) => {
    setDelegation(item);
    setSelectedJobs(item.selectedJobIds);
    if (["executing", "retrying", "verifying"].includes(item.status)) watch(item.id);
  };

  const toggleJob = (jobId: string) => setSelectedJobs(current => current.includes(jobId) ? current.filter(id => id !== jobId) : [...current, jobId]);

  const downloadReceipt = () => {
    if (!delegation?.receipt) return;
    const blob = new Blob([JSON.stringify(delegation.receipt, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `smaj-proof-${delegation.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="SMAJ Verified Delegation home">
          <span className="brandMark">S</span>
          <span><strong>SMAJ AI</strong><small>Verified Delegation</small></span>
        </a>
        <div className="topbarMeta">
          <span className="liveDot" /> Meta Model API
          <span className="modelPill">muse-spark-1.3</span>
          {authenticated && <button className="logoutButton" onClick={logout}>Sign out</button>}
        </div>
      </header>

      <section className="hero" id="top">
        <div className="heroCopy">
          <div className="eyebrow"><Icon name="shield" /> Authorized actions. Verified outcomes.</div>
          <h1>Turn AI intentions into <span>trusted proof.</span></h1>
          <p>SMAJ Verified Delegation plans bounded tasks, pauses for human approval, recovers safely, and verifies the real outcome before it ever claims success.</p>
          <div className="heroBadges">
            <span><Icon name="database" /> SMAJ Jobs read-only</span>
            <span><Icon name="check" /> Mock submissions only</span>
            <span><Icon name="shield" /> No Pi payments</span>
          </div>
        </div>
        <div className="trustCard">
          <div className="trustOrb"><Icon name="spark" /></div>
          <strong>Proof-carrying AI</strong>
          <p>Every completed action carries approval evidence, deterministic checks, and a SHA-256 receipt digest.</p>
          <div className="trustMetric"><span>Production side effects</span><b>Disabled</b></div>
          <div className="trustMetric"><span>Verification mode</span><b>Independent</b></div>
        </div>
      </section>

      <section className="workflowShell">
        <div className="sectionHeading">
          <div><span className="sectionIndex">01</span><h2>Create a delegation</h2></div>
          <p>Define a bounded Jobs goal. Meta reads current opportunities and prepares a plan—not an action.</p>
        </div>

        {authenticated === null && <div className="authPanel"><span className="spinner darkSpinner" /> Checking secure session...</div>}
        {authenticated === false && <form className="authPanel" onSubmit={login}>
          <div><Icon name="shield" /><span><strong>Protected hackathon workspace</strong><small>Enter the configured demo access token. It is exchanged for an HttpOnly signed session.</small></span></div>
          <label className="field"><span>Demo access token</span><input type="password" value={accessToken} onChange={event => setAccessToken(event.target.value)} autoComplete="current-password" /></label>
          <button className="primaryButton" disabled={busy === "login" || accessToken.length < 1}>{busy === "login" ? "Authenticating..." : "Unlock dashboard"}</button>
        </form>}

        {authenticated && <form className="contractForm" onSubmit={createDelegation}>
          <label className="field fieldWide"><span>Authorized goal</span><textarea value={goal} onChange={event => setGoal(event.target.value)} rows={3} /></label>
          <label className="field"><span>Candidate</span><input value={candidateName} onChange={event => setCandidateName(event.target.value)} /></label>
          <label className="field"><span>Skills, comma separated</span><input value={skills} onChange={event => setSkills(event.target.value)} /></label>
          <div className="contractGuardrails">
            <span><b>Scope</b> 3 mock applications</span>
            <span><b>Expiry</b> 24 hours</span>
            <span><b>Approval</b> Required</span>
          </div>
          <button className="primaryButton" disabled={Boolean(busy)} type="submit">
            {busy === "planning" ? <><span className="spinner" /> Meta is planning</> : <>Generate verified plan <Icon name="arrow" /></>}
          </button>
        </form>}

        {error && <div className="errorBanner" role="alert"><strong>Workflow stopped safely.</strong> {error}</div>}

        {authenticated && history.length > 0 && <section className="historyPanel">
          <div className="historyHeading"><div><Icon name="database" /><span><strong>Persistent task history</strong><small>Recovered from stable local storage after restarts.</small></span></div><b>{history.length} tasks</b></div>
          <div className="historyList">{history.map(item => <button className={item.id === delegation?.id ? "active" : ""} key={item.id} onClick={() => openHistory(item)}><span className={`status status-${item.status}`}>{statusLabels[item.status]}</span><strong>{item.goal}</strong><small>{item.plan.recommendations.length} planned · {time(item.updatedAt)}</small></button>)}</div>
        </section>}

        {delegation && (
          <div className="workspace">
            <div className="statusStrip">
              <div><span>Delegation</span><code>{delegation.id.slice(0, 8)}</code></div>
              <div><span>Status</span><b className={`status status-${delegation.status}`}>{statusLabels[delegation.status]}</b></div>
              <div><span>Planner</span><b>{delegation.plan.model}</b></div>
              <div><span>Source</span><b>Production read-only</b></div>
            </div>

            <div className="progressRail" aria-label="Delegation progress">
              {["Plan", "Approve", "Execute", "Recover", "Verify"].map((label, index) => {
                const rank: Record<string, number> = { awaiting_approval: 1, approved: 2, executing: 3, retrying: 3, verifying: 4, verified: 5, failed: 3 };
                const active = index < (rank[delegation.status] || 0);
                return <div className={active ? "complete" : ""} key={label}><span>{active ? "✓" : index + 1}</span><b>{label}</b></div>;
              })}
            </div>

            <div className="sectionHeading compact">
              <div><span className="sectionIndex">02</span><h2>Review Meta&apos;s plan</h2></div>
              <p>{delegation.plan.summary}</p>
            </div>

            <div className="jobGrid">
              {delegation.plan.recommendations.map(recommendation => {
                const job = jobsById.get(recommendation.jobId) as JobsApiJob | undefined;
                if (!job) return null;
                const selected = selectedJobs.includes(job.id);
                return (
                  <article className={`jobCard ${selected ? "selected" : ""}`} key={job.id}>
                    <div className="jobCardTop">
                      <label className="selectControl"><input type="checkbox" checked={selected} disabled={delegation.status !== "awaiting_approval"} onChange={() => toggleJob(job.id)} /><span /></label>
                      <div className="scoreRing"><b>{recommendation.score}</b><small>match</small></div>
                    </div>
                    <span className="jobMode">{job.mode} · {job.type}</span>
                    <h3>{job.title}</h3>
                    <p className="company">{job.company} · {job.location}</p>
                    <p className="rationale">{recommendation.rationale}</p>
                    <div className="skillRow">{job.skills.slice(0, 4).map(skill => <span key={skill}>{skill}</span>)}</div>
                    <details><summary>Application draft</summary><p>{recommendation.coverNote}</p></details>
                  </article>
                );
              })}
            </div>

            {delegation.status === "awaiting_approval" && (
              <div className="approvalBar">
                <div><Icon name="shield" /><span><strong>Human approval gate</strong><small>No action can run until you approve the selected mock applications.</small></span></div>
                <button className="primaryButton" onClick={approve} disabled={Boolean(busy) || selectedJobs.length === 0}>{busy === "approving" ? "Recording approval…" : `Approve ${selectedJobs.length} mock applications`}</button>
              </div>
            )}

            {delegation.status === "approved" && (
              <div className="executionPanel">
                <div><span className="sectionIndex">03</span><h2>Execute safely</h2><p>Writes go only to this hackathon&apos;s local mock store.</p></div>
                <label className="faultToggle"><input type="checkbox" checked={injectFailure} onChange={event => setInjectFailure(event.target.checked)} /><span /><div><strong>Demonstrate recovery</strong><small>Inject one transient failure, then retry with the same idempotency key.</small></div></label>
                <button className="primaryButton" onClick={execute} disabled={Boolean(busy)}>{busy === "executing" ? <><span className="spinner" /> Executing and verifying</> : <>Execute approved plan <Icon name="arrow" /></>}</button>
              </div>
            )}

            {["executing", "retrying", "verifying"].includes(delegation.status) && <div className="liveProgress"><span className="spinner" /><div><strong>{statusLabels[delegation.status]} in real time</strong><small>Signed server events update this evidence timeline as each stage persists.</small></div></div>}

            <div className="evidenceGrid">
              <section className="timelinePanel">
                <div className="panelTitle"><span><Icon name="database" /></span><div><h2>Evidence timeline</h2><p>Append-only events from planning through verification.</p></div></div>
                <div className="timeline">
                  {delegation.events.map(event => <div className="timelineEvent" key={event.id}><span className="timelineDot" /><div><b>{event.message}</b><small>{event.type} · {time(event.createdAt)}</small></div></div>)}
                </div>
              </section>

              <section className={`receiptPanel ${delegation.receipt ? "receiptReady" : ""}`}>
                <div className="panelTitle"><span><Icon name="receipt" /></span><div><h2>Proof receipt</h2><p>Issued only after deterministic verification.</p></div></div>
                {delegation.receipt ? (
                  <>
                    <div className="verifiedSeal"><Icon name="check" /><span><b>Outcome verified</b><small>{delegation.receipt.proof.actions.length} mock actions confirmed</small></span></div>
                    <dl>
                      <div><dt>Receipt</dt><dd>{delegation.receipt.proof.receiptId.slice(0, 13)}…</dd></div>
                      <div><dt>Approval</dt><dd>{time(delegation.receipt.proof.approval.approvedAt)}</dd></div>
                      <div><dt>Recovery</dt><dd>{delegation.receipt.proof.recovery.retries} safe retry</dd></div>
                      <div><dt>Production writes</dt><dd>None</dd></div>
                    </dl>
                    <div className="hashBox"><span>SHA-256 proof digest</span><code>{delegation.receipt.proofHash}</code></div>
                    <button className="secondaryButton" onClick={downloadReceipt}>Download JSON receipt</button>
                  </>
                ) : <div className="receiptEmpty"><Icon name="shield" /><p>Receipt locked until the approved workflow executes and every outcome passes verification.</p></div>}
              </section>
            </div>
          </div>
        )}
      </section>

      <footer><div className="brand footerBrand"><span className="brandMark">S</span><span><strong>SMAJ AI</strong><small>Verified Delegation</small></span></div><p>Independent Meta Hackathon project · No real Pi payments · No production job submissions</p></footer>
    </main>
  );
}
