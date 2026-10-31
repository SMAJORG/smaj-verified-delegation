"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ServiceIcon from "@/components/ServiceIcon";
import BrandLogo from "@/components/BrandLogo";
import HomeWorkspace from "@/components/HomeWorkspace";
import SavedTasks from "@/components/SavedTasks";
import type { AiTask } from "@/src/server/ai-tasks";
import { SMAJ_SERVICES, type ServiceId, type ServiceRoutePlan } from "@/src/domain/services";
import type { DelegationView, JobsApiJob } from "@/src/domain/types";
import type { ServiceConnection } from "@/src/server/service-connections";
import { downloadReceiptFile } from "@/components/receipt-export";

type View = "home" | "tasks" | "services" | "approvals" | "receipts" | "profile";
type ApiResponse = { tasks?: AiTask[]; task?: AiTask; delegation?: DelegationView; delegations?: DelegationView[]; plan?: ServiceRoutePlan; connections?: ServiceConnection[]; message?: string };
const statusLabels: Record<string, string> = { awaiting_approval: "Awaiting approval", approved: "Approved", executing: "Executing", retrying: "Recovering", verifying: "Verifying", verified: "Verified", failed: "Failed" };
const platformLabels = { live: "Live", coming_soon: "Coming soon", in_progress: "In progress" };
const time = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

const Icon = ({ name }: { name: string }) => {
  const paths: Record<string, React.ReactNode> = {
    menu:<path d="M4 7h16M4 12h16M4 17h16"/>,
    close:<path d="m6 6 12 12M18 6 6 18"/>,
    home:<><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    tasks:<><path d="M9 6h11M9 12h11M9 18h11"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></>,
    spark:<path d="M12 3 9 11h5l-3 10 8-12h-5l2-6Z"/>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.spark}</svg>;
};

export default function Dashboard() {
  const [view, setView] = useState<View>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sandbox, setSandbox] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [task, setTask] = useState("");
  const [candidateName, setCandidateName] = useState("Amina Okafor");
  const [skills, setSkills] = useState("TypeScript, React, Node.js, REST APIs");
  const [selectedService, setSelectedService] = useState<ServiceId | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [routePlan, setRoutePlan] = useState<ServiceRoutePlan | null>(null);
  const [delegation, setDelegation] = useState<DelegationView | null>(null);
  const [history, setHistory] = useState<DelegationView[]>([]);
  const [connections, setConnections] = useState<ServiceConnection[]>([]);
  const [aiTasks, setAiTasks] = useState<AiTask[]>([]);
  const [injectFailure, setInjectFailure] = useState(false);
  const streamRef = useRef<EventSource | null>(null);

  const loadWorkspace = async () => {
    const [delegationsResponse, connectionsResponse, tasksResponse] = await Promise.all([
      fetch("/api/delegations", { cache: "no-store" }),
      fetch("/api/connections", { cache: "no-store" }),
      fetch("/api/tasks", { cache: "no-store" }),
    ]);
    const delegationsPayload = await delegationsResponse.json().catch(() => ({ delegations: [] }));
    const connectionsPayload = await connectionsResponse.json().catch(() => ({ connections: [] }));
    const tasksPayload = await tasksResponse.json().catch(() => ({ tasks: [] }));
    setHistory(Array.isArray(delegationsPayload.delegations) ? delegationsPayload.delegations : []);
    setConnections(Array.isArray(connectionsPayload.connections) ? connectionsPayload.connections : []);
    setAiTasks(Array.isArray(tasksPayload.tasks) ? tasksPayload.tasks : []);
  };

  const updateDelegation = (next: DelegationView) => {
    setDelegation(next);
    setHistory(current => [next, ...current.filter(item => item.id !== next.id)]);
  };

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then(response => response.json())
      .then(payload => {
        setSsoEnabled(Boolean(payload?.ssoEnabled));
        setDemoEnabled(Boolean(payload?.demoEnabled));
        setSandbox(Boolean(payload?.sandbox));
        setExpiresAt(payload?.expiresAt || null);
        setAuthenticated(Boolean(payload?.authenticated));
        if (payload?.authenticated) void loadWorkspace();
      })
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    if (!sandbox || !expiresAt) return;
    const expire = () => {
      streamRef.current?.close();
      setAuthenticated(false);
      setHistory([]);
      setAiTasks([]);
      setTask("");
      setSelectedService(null);
      setConnections([]);
    };
    const timer = setTimeout(expire, new Date(expiresAt).getTime() - Date.now());
    return () => clearTimeout(timer);
  }, [sandbox, expiresAt]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy("login");
    setError("");
    try {
      const response = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken }) });
      const payload = await response.json();
      if (!response.ok || !payload?.authenticated) throw new Error(payload?.message || "Sign-in failed");
      setAuthenticated(true);
      setSandbox(Boolean(payload.sandbox));
      setExpiresAt(payload.expiresAt || null);
      await loadWorkspace();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign-in failed");
    } finally {
      setBusy(null);
    }
  };

  const startDemo = async () => {
    setBusy("demo");
    setError("");
    try {
      const response = await fetch("/api/auth/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(15000) });
      const payload = await response.json();
      if (!response.ok || !payload?.authenticated) throw new Error(payload?.message || "Demo session failed");
      setAuthenticated(true);
      setSandbox(Boolean(payload.sandbox));
      setExpiresAt(payload.expiresAt || null);
      await loadWorkspace();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to start demo");
    } finally {
      setBusy(null);
    }
  };

  const logout = async () => {
    setError("");
    try {
      const response = await fetch("/api/auth/session", { method: "DELETE", signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("Sign-out failed");
      setAuthenticated(false);
      setHistory([]);
      setAiTasks([]);
      setDelegation(null);
      setConnections([]);
      setTask("");
      setRoutePlan(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign-out failed");
    }
  };

  const navigate = (next: View) => { setView(next); setMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const request = async (url: string, body: Record<string, unknown>, action: string) => {
    setBusy(action);
    setError("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": `ui_${crypto.randomUUID()}` }, body: JSON.stringify(body) });
      const payload = await response.json() as ApiResponse;
      if (!response.ok || !payload.delegation) throw new Error(payload.message || "Workflow request failed");
      updateDelegation(payload.delegation);
      return payload.delegation;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Workflow stopped safely");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const createJobsPlan = async () => {
    const created = await request("/api/delegations", {
      goal: task,
      candidateName,
      skills: skills.split(",").map(value => value.trim()).filter(Boolean),
      maxApplications: 3,
    }, "planning");
    if (created) {
      setSelectedJobs(created.selectedJobIds);
      setDelegation(created);
      setRoutePlan(created.plan);
    }
  };

  const approve = () => delegation && request(`/api/delegations/${delegation.id}/approve`, { selectedJobIds: selectedJobs }, "approving");
  const execute = () => { if (!delegation) return; watch(delegation.id); return request(`/api/delegations/${delegation.id}/execute`, { injectTransientFailure: injectFailure }, "executing"); };
  const watch = (id: string) => {
    streamRef.current?.close();
    const source = new EventSource(`/api/delegations/${id}/events`);
    streamRef.current = source;
    source.addEventListener("delegation", (event) => {
      const next = JSON.parse((event as MessageEvent).data) as DelegationView;
      updateDelegation(next);
    });
  };

  const openTask = (item: DelegationView) => {
    setDelegation(item);
    setSelectedJobs(item.selectedJobIds);
    navigate("tasks");
    if (["executing", "retrying", "verifying"].includes(item.status)) watch(item.id);
  };

  const deleteDelegation = async (id: string) => {
    if (!window.confirm("Delete this task, its drafts, and local proof receipt?")) return;
    setBusy(`delete-${id}`);
    try {
      const response = await fetch(`/api/delegations/${id}`, { method: "DELETE", signal: AbortSignal.timeout(15000) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Task deletion failed");
      }
      streamRef.current?.close();
      setHistory(items => items.filter(item => item.id !== id));
      setDelegation(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Task deletion failed");
    } finally {
      setBusy(null);
    }
  };

  const downloadReceipt = (format: "json" | "pdf" = "json") => {
    if (!delegation?.receipt) return;
    const fileName = `smaj-proof-${delegation.id}.${format}`;
    downloadReceiptFile(delegation.receipt, format, fileName);
  };

  const connectedIds = new Set(connections.filter(item => item.connected).map(item => item.serviceId));
  const pending = history.filter(item => item.status === "awaiting_approval");
  const receipts = history.filter(item => item.receipt);

  if (authenticated !== true) return <Login demoEnabled={demoEnabled} startDemo={startDemo} authenticated={authenticated} ssoEnabled={ssoEnabled} accessToken={accessToken} setAccessToken={setAccessToken} busy={busy} error={error} login={login} />;

  return <main className="workspace"><header className="workspaceHeader"><div className="headerSide"><button className="iconButton" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Icon name="menu" /></button><BrandLogo className="headerLogo" /></div><div className="headerActions"><button className="textButton" onClick={() => navigate("profile")}>Profile</button><button className="secondaryButton" onClick={logout}>Sign out</button></div></header>{menuOpen && <div className="menuOverlay" onClick={() => setMenuOpen(false)} />}<aside className={`drawer ${menuOpen ? "show" : ""}`}><button className="drawerClose" onClick={() => setMenuOpen(false)}><Icon name="close" /></button><div className="drawerContent"><button className={view === "home" ? "drawerItem active" : "drawerItem"} onClick={() => navigate("home")}>Home</button><button className={view === "tasks" ? "drawerItem active" : "drawerItem"} onClick={() => navigate("tasks")}>Tasks</button><button className={view === "approvals" ? "drawerItem active" : "drawerItem"} onClick={() => navigate("approvals")}>Approvals</button><button className={view === "receipts" ? "drawerItem active" : "drawerItem"} onClick={() => navigate("receipts")}>Receipts</button></div></aside><section className="workspaceBody">{view === "home" && <HomeWorkspace ... />} {view === "tasks" && <Tasks history={history} filter="all" />} {view === "approvals" && <Approvals items={pending} openTask={openTask} />} {view === "receipts" && <Receipts items={receipts} openTask={openTask} />} {view === "services" && <Services connections={connections} setConnection={() => {}} busy={busy} />} {view === "profile" && <Profile connectedCount={connectedIds.size} taskCount={aiTasks.length} navigate={navigate} logout={logout} />}</section>{delegation && <DelegationDetail deleteDelegation={deleteDelegation} delegation={delegation} jobsById={new Map((delegation.jobs || []).map(job => [job.id, job]))} selectedJobs={selectedJobs} setSelectedJobs={setSelectedJobs} busy={busy} approve={approve} execute={execute} injectFailure={injectFailure} setInjectFailure={setInjectFailure} downloadReceipt={downloadReceipt} />}</main>;
}

function Login({ authenticated, ssoEnabled, demoEnabled, startDemo, accessToken, setAccessToken, busy, error, login }: { authenticated: boolean | null; ssoEnabled: boolean; demoEnabled: boolean; startDemo: () => void; accessToken: string; setAccessToken: (value: string) => void; busy: string | null; error: string; login: (event: React.FormEvent) => Promise<void> }) {
  return <main className="loginScreen"><BrandLogo className="loginLogo" /><section className="loginCard" aria-busy={busy !== null}><p className="eyebrow">SMAJ AI · VERIFIED DELEGATION</p><h1>Your workspace</h1><p className="loginText">Secure, simulated job applications with human approval, recovery, and receipt verification.</p>{error && <div className="errorBanner">{error}</div>}<form onSubmit={login}><label className="field"><span>Demo access token</span><input type="password" value={accessToken} onChange={event => setAccessToken(event.target.value)} placeholder="Enter access token" /></label><div className="buttonRow"><button type="submit" className="primaryButton" disabled={busy !== null}>{busy === "login" ? "Opening workspace" : "Open workspace"}</button>{demoEnabled && <button type="button" className="secondaryButton" onClick={startDemo} disabled={busy !== null}>Try demo</button>}</div></form>{ssoEnabled && <button type="button" className="tertiaryButton">Continue with SMAJ PI HUB</button>}</section></main>;
}

function DrawerItem({ icon, label, badge, active, onClick }: { icon: string; label: string; badge?: number; active: boolean; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}><Icon name={icon} /><span>{label}</span>{badge ? <span className="badge">{badge}</span> : null}</button>;
}

function Services({ connections, setConnection, busy }: { connections: ServiceConnection[]; setConnection: (id: ServiceId, value: boolean) => void; busy: string | null }) {
  return <Page title="Connected services" subtitle="Read-only integrations remain under user control."><div className="serviceGrid">{connections.map(connection => <div key={connection.serviceId} className="serviceCard"><div><ServiceIcon serviceId={connection.serviceId} /><strong>{SMAJ_SERVICES.find(item => item.id === connection.serviceId)?.name}</strong></div><button disabled={busy !== null} onClick={() => setConnection(connection.serviceId, !connection.connected)}>{connection.connected ? "Disconnect" : "Connect"}</button></div>)}</div></Page>;
}

function Tasks(props: any) { const filtered = props.history.filter((item: DelegationView) => props.filter === "all" || item.status === props.filter); return <Page title="All tasks" subtitle="Plans, live progress, and reviewed outcomes."><div className="listGrid">{filtered.map((item: DelegationView) => <button key={item.id} className="listCard" onClick={() => props.openTask ? props.openTask(item) : undefined}><strong>{item.goal}</strong><span>{statusLabels[item.status]}</span></button>)}</div></Page>; }

function RoutePlan({ plan, task, candidateName, setCandidateName, skills, setSkills, createJobsPlan, busy }: { plan: ServiceRoutePlan; task: string; candidateName: string; setCandidateName: (value: string) => void; skills: string; setSkills: (value: string) => void; createJobsPlan: () => void; busy: string | null }) {
  return <section className="panel"><h3>Route plan</h3><p>{plan.summary}</p><div className="routeList">{plan.steps.map((step, index) => <div key={`${step.serviceId}-${index}`} className="routeItem"><strong>{step.title}</strong><small>{step.serviceId}</small><span>{step.capability}</span></div>)}</div></section>;
}

function Approvals({ items, openTask }: { items: DelegationView[]; openTask: (item: DelegationView) => void }) { return <Page title="Approvals" subtitle="Nothing sensitive happens without your permission."><div className="listGrid">{items.map(item => <button key={item.id} className="listCard" onClick={() => openTask(item)}><strong>{item.goal}</strong><span>{time(item.createdAt)}</span></button>)}</div></Page>; }

function Receipts({ items, openTask }: { items: DelegationView[]; openTask: (item: DelegationView) => void }) { return <Page title="Proof receipts" subtitle="Verified outcomes appear only after approved tasks complete."><div className="receiptList">{items.map(item => <button key={item.id} className="receiptItem" onClick={() => openTask(item)}><span><Icon name="approve" /></span><div><small>VERIFIED RESULT</small><strong>{item.goal}</strong><code>{item.receipt?.proofHash.slice(0, 32)}…</code></div><Icon name="arrow" /></button>)}{items.length === 0 && <Empty text="No verified receipts yet." />}</div></Page>; }

function Profile({ connectedCount, taskCount, navigate, logout }: { connectedCount: number; taskCount: number; navigate: (view: View) => void; logout: () => void }) { return <Page title="Your workspace" subtitle="Manage scope, activity, and sign-out."><div className="profileCard"><strong>{connectedCount} services connected</strong><span>{taskCount} tasks tracked</span><button onClick={() => navigate("services")}>Manage services</button><button onClick={logout}>Sign out</button></div></Page>; }

function Page({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="pageView"><h1>{title}</h1><p className="pageSub">{subtitle}</p>{children}</section>; }

function Empty({ text }: { text: string }) { return <div className="emptyState"><Icon name="spark" /><p>{text}</p></div>; }

function DelegationDetail({ deleteDelegation, delegation, jobsById, selectedJobs, setSelectedJobs, busy, approve, execute, injectFailure, setInjectFailure, downloadReceipt }: any) {
  const toggle = (id: string) => setSelectedJobs((current: string[]) => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const rank: Record<string, number> = { awaiting_approval: 1, approved: 2, executing: 3, retrying: 3, verifying: 4, verified: 5, failed: 3 };
  return <section className="taskDetail"><button className="secondaryButton" disabled={Boolean(busy) || ["executing", "retrying", "verifying"].includes(delegation.status)} onClick={() => deleteDelegation(delegation.id)}>Delete task</button><div className="detailHead"><div><span className={`taskTag ${delegation.status}`}>{statusLabels[delegation.status]}</span><h2>{delegation.goal}</h2><p>{delegation.plan.summary}</p></div><small>{delegation.plan.model}</small></div><div className="progressFlow">{["Planned", "Approved", "Executed", "Verified"].map((label, index) => <div key={label} className={`progressStep ${rank[delegation.status] >= index + 1 ? "done" : ""}`}><span>{index + 1}</span><strong>{label}</strong></div>)}</div>{delegation.jobs.length > 0 && <div className="jobList">{delegation.jobs.map((job: JobsApiJob) => <label key={job.id} className="jobChoice"><input type="checkbox" checked={selectedJobs.includes(job.id)} onChange={() => toggle(job.id)} /><div><strong>{job.title}</strong><small>{job.company} · {job.location}</small></div></label>)}</div>}<div className="actionRow"><button className="primaryButton" disabled={busy !== null || delegation.status === "verified"} onClick={approve}>Approve</button><button className="secondaryButton" disabled={busy !== null || delegation.status === "verified"} onClick={execute}>Execute selected</button></div><label className="toggleRow"><input type="checkbox" checked={injectFailure} onChange={event => setInjectFailure(event.target.checked)} /> <span>Inject a recoverable transient failure</span></label>{delegation.receipt && <div className="receiptCard"><div className="receiptMeta"><div><strong>Proof receipt</strong><small>{delegation.receipt.proof.receiptId}</small></div><div className="pill mock">MOCK ACTIONS</div></div><div className="receiptSummary"><div><span>Model</span><strong>{delegation.receipt.proof.planner.model}</strong></div><div><span>Verified</span><strong>{time(delegation.receipt.proof.verifiedAt)}</strong></div><div><span>Proof hash</span><strong>{delegation.receipt.proofHash.slice(0, 32)}…</strong></div></div><div className="buttonRow"><button className="primaryButton" type="button" onClick={() => downloadReceipt("pdf")}>Download PDF</button><button className="secondaryButton" type="button" onClick={() => downloadReceipt("json")}>Download JSON</button></div></div>}</section>;
}

export { };
































































































































































































































































"path":"components/Dashboard.tsx