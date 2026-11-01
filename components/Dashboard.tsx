"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ServiceIcon from "@/components/ServiceIcon";
import BrandLogo from "@/components/BrandLogo";
import LandingPage from "@/components/LandingPage";
import DemoLoading from "@/components/DemoLoading";
import LiveTaskResult from "@/components/LiveTaskResult";
import { Analyzing, TypedResponse } from "@/components/TaskResponse";
import "@/components/task-results.css";
import HomeWorkspace from "@/components/HomeWorkspace";
import Services from "@/components/Services";
import servicesStyles from "@/components/Services.module.css";
import TaskHistory from "@/components/TaskHistory";
import { downloadReceiptFile } from "@/components/receipt-export";
import type { AiTask } from "@/src/server/ai-tasks";
import { SMAJ_SERVICES, type ServiceId, type ServiceRoutePlan } from "@/src/domain/services";
import type { DelegationView, JobsApiJob } from "@/src/domain/types";
import type { ServiceConnection } from "@/src/server/service-connections";

type View = "home" | "tasks" | "task-detail" | "services" | "approvals" | "receipts" | "profile";
type ApiResponse = { tasks?: AiTask[]; task?: AiTask; delegation?: DelegationView; delegations?: DelegationView[]; plan?: ServiceRoutePlan; connections?: ServiceConnection[]; message?: string };
const statusLabels: Record<string, string> = { awaiting_approval: "Awaiting approval", approved: "Approved", executing: "Executing", retrying: "Recovering", verifying: "Verifying", verified: "Verified", failed: "Needs attention" };
const time = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

const Icon = ({ name }: { name: string }) => {
  const paths: Record<string, React.ReactNode> = {
    menu:<path d="M4 7h16M4 12h16M4 17h16"/>, close:<path d="m6 6 12 12M18 6 6 18"/>, home:<><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>, tasks:<><path d="M9 6h11M9 12h11M9 18h11"/><path d="m4 6 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2"/></>, apps:<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>, approve:<path d="m5 12 4 4L19 6"/>, receipt:<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6"/>, profile:<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>, plus:<path d="M12 5v14M5 12h14"/>, arrow:<path d="M5 12h14m-5-5 5 5-5 5"/>, shield:<path d="M12 3 5 6v5c0 4.7 2.8 8.3 7 10 4.2-1.7 7-5.3 7-10V6l-7-3Zm-3 9 2 2 4-4"/>, spark:<path d="m12 2 1.5 5L18 9l-4.5 2L12 16l-1.5-5L6 9l4.5-2L12 2Z"/>, lock:<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.spark}</svg>;
};

export default function Dashboard() {
  const [view,setView]=useState<View>("home"); const [menuOpen,setMenuOpen]=useState(false); const [authenticated,setAuthenticated]=useState<boolean|null>(null); const [ssoEnabled,setSsoEnabled]=useState(false); const [demoEnabled,setDemoEnabled]=useState(false); const [sandbox,setSandbox]=useState(false); const [expiresAt,setExpiresAt]=useState<number|null>(null); const [accessToken,setAccessToken]=useState("");
  const [aiTasks,setAiTasks]=useState<AiTask[]>([]); const [selectedService,setSelectedService]=useState<ServiceId|null>(null); const [task,setTask]=useState(""); const [routePlan,setRoutePlan]=useState<ServiceRoutePlan|null>(null); const [connections,setConnections]=useState<ServiceConnection[]>([]); const [history,setHistory]=useState<DelegationView[]>([]); const [delegation,setDelegation]=useState<DelegationView|null>(null);
  const [candidateName,setCandidateName]=useState(""); const [skills,setSkills]=useState(""); const [selectedJobs,setSelectedJobs]=useState<string[]>([]); const [injectFailure,setInjectFailure]=useState(true); const [busy,setBusy]=useState<string|null>(null); const [error,setError]=useState("");
  const demoEntryPending=useRef(false);
  const resumedSearch=useRef(false);
  const [sampleTasksEnabled,setSampleTasksEnabled]=useState(false);
  const [publicAccess,setPublicAccess]=useState(false);
  useLayoutEffect(()=>{
    if(!demoEntryPending.current)return;
    const previousRestoration=window.history.scrollRestoration;
    window.history.scrollRestoration="manual";
    // Instant scrolling overrides the homepage smooth-scroll rule and cancels old scrolls.
    const reset=()=>window.scrollTo({top:0,left:0,behavior:"instant"});
    if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
    reset();
    const frame=requestAnimationFrame(reset);
    if(busy!=="demo")demoEntryPending.current=false;
    return()=>{cancelAnimationFrame(frame);window.history.scrollRestoration=previousRestoration;};
  },[busy,authenticated]);
  const streamRef=useRef<EventSource|null>(null); const jobsById=useMemo(()=>new Map((delegation?.jobs||[]).map(job=>[job.id,job])),[delegation]);
  const updateDelegation=(next:DelegationView)=>{setDelegation(next);setHistory(current=>[next,...current.filter(item=>item.id!==next.id)]);};
  const loadWorkspace=async(signal?:AbortSignal)=>{const [tasksResponse,connectionsResponse,aiTasksResponse]=await Promise.all([fetch("/api/delegations",{cache:"no-store",signal}),fetch("/api/connections",{cache:"no-store",signal}),fetch("/api/tasks",{cache:"no-store",signal})]);if(tasksResponse.status===401||tasksResponse.status===503){setAuthenticated(false);return false;}if(!tasksResponse.ok||!connectionsResponse.ok||!aiTasksResponse.ok)throw new Error("Workspace could not be loaded");const tasksPayload=await tasksResponse.json() as ApiResponse;const connectionsPayload=await connectionsResponse.json() as ApiResponse;setAiTasks((await aiTasksResponse.json()).tasks||[]);setHistory(tasksPayload.delegations||[]);setConnections(connectionsPayload.connections||[]);setAuthenticated(true);return true;};
  useEffect(()=>{
    const controller=new AbortController();
    const load=async()=>{
      const response=await fetch("/api/auth/session",{cache:"no-store",signal:controller.signal});
      if(!response.ok)throw new Error("Your sign-in status could not be checked. Please try again.");
      let payload=await response.json();
      if ((!payload.authenticated && !payload.publicAccess) || payload.sandbox) {
        const opened=await fetch("/api/public/session",{method:"POST",signal:controller.signal});
        payload=await opened.json();
        if(!opened.ok)throw new Error(payload.message || "Public AI could not be opened. Please try again.");
      }
      setPublicAccess(Boolean(payload.publicAccess));
      setSampleTasksEnabled(Boolean(payload.sampleTasksEnabled));setSsoEnabled(Boolean(payload.ssoEnabled));setDemoEnabled(Boolean(payload.demoEnabled));setSandbox(Boolean(payload.sandbox));setExpiresAt(payload.expiresAt||null);
      await loadWorkspace(controller.signal);
    };
    void load().catch(error=>{if(!controller.signal.aborted){setAuthenticated(false);setError(error instanceof Error?error.message:"Sign-in could not be checked");}});
    return()=>{controller.abort();streamRef.current?.close();};
  },[]);
  useEffect(()=>{if(!sandbox||!expiresAt)return;const expire=()=>{streamRef.current?.close();setAuthenticated(false);setHistory([]);setAiTasks([]);setTask("");setSelectedService(null);setConnections([]);setDelegation(null);setRoutePlan(null);setSandbox(false);setExpiresAt(null);setError("Your demo session expired. Try Live Demo to start a fresh workspace.");};const timer=setTimeout(expire,Math.max(0,expiresAt-Date.now()));return()=>clearTimeout(timer);},[sandbox,expiresAt]);
  const login=async(event:React.FormEvent)=>{event.preventDefault();setBusy("login");setError("");try{const response=await fetch("/api/auth/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accessToken})});const payload=await response.json() as ApiResponse;if(!response.ok)throw new Error(payload.message||"Authentication failed");setAccessToken("");await loadWorkspace();}catch(loginError){setError(loginError instanceof Error?loginError.message:"Authentication failed");}finally{setBusy(null);}};
  const startDemo=async()=>{demoEntryPending.current=true;setView("home");setMenuOpen(false);setBusy("demo");setError("");const signal=AbortSignal.timeout(30000);try{const response=await fetch("/api/public/session",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}",signal});const payload=await response.json();if(!response.ok)throw new Error(payload.message||"The demo could not be started. Please try again.");setPublicAccess(Boolean(payload.publicAccess));setSandbox(false);setExpiresAt(payload.expiresAt);if(!await loadWorkspace(signal))throw new Error("The demo workspace could not be loaded. Please try again.");}catch(error){setError(error instanceof Error?error.message:"The demo could not be started. Please try again.");}finally{setBusy(null);}};
  const logout=async()=>{setError("");try{const response=await fetch("/api/auth/session",{method:"DELETE",signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error("Sign-out failed. Please try again.");streamRef.current?.close();setAuthenticated(false);setHistory([]);setAiTasks([]);setTask("");setSelectedService(null);setConnections([]);setDelegation(null);setRoutePlan(null);setSandbox(false);setExpiresAt(null);setView("home");setMenuOpen(false);}catch(error){setError(error instanceof Error?error.message:"Sign-out failed. Please try again.");}};
  const navigate=(next:View)=>{setView(next);setMenuOpen(false);window.scrollTo({top:0,behavior:"smooth"});};
  const routeTask=async(event:React.FormEvent)=>{event.preventDefault();if(!task.trim()){setError("Enter a message or task.");return;}const service=SMAJ_SERVICES.find(item=>item.id===selectedService);setBusy("routing");setError("");try{const response=await fetch("/api/tasks",{signal:AbortSignal.timeout(135000),method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({task:service?`${service.name}: ${task}`:task})});const payload=await response.json() as ApiResponse;if(!response.ok||!payload.plan)throw new Error((payload.message||"Meta could not route this task")+(response.status===429&&response.headers.get("Retry-After")?` Try again in ${response.headers.get("Retry-After")} seconds.`:""));if(payload.task)setAiTasks(items=>[payload.task!,...items.filter(item=>item.id!==payload.task!.id)]);setDelegation(null);setRoutePlan(payload.plan);navigate("task-detail");}catch(routeError){setError(routeError instanceof Error?routeError.message:"Task routing stopped safely");}finally{setBusy(null);}};
  const runDiscovery = async (saved: AiTask, resume = false) => {
    setBusy("discovery"); setError("");
    try {
      if (sandbox) {
        const response = await fetch("/api/auth/search", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({taskId:saved.id, approved:true})});
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Sign-in could not be started. Please try again.");
        window.sessionStorage.setItem("smaj_pending_search", saved.id);
        window.location.assign(payload.signInUrl);
        return;
      }
      const response = await fetch(`/api/tasks/${saved.id}/discover`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(resume ? {resume:true} : {approved:true}), signal:AbortSignal.timeout(180000)});
      const payload = await response.json();
      if (!response.ok) throw new Error((payload.message || "Search failed. Please try again.") + (response.status===429&&response.headers.get("Retry-After")?` Try again in ${response.headers.get("Retry-After")} seconds.`:""));
      setRoutePlan(payload.plan); setAiTasks(items => items.map(item => item.id === saved.id ? payload.task : item));
      fetch("/api/connections", {cache:"no-store"}).then(r=>r.ok?r.json():null).then(p=>{if(p?.connections)setConnections(p.connections);}).catch(()=>undefined);
    } catch (error) { setError(error instanceof Error ? error.message : "Search failed. Please try again."); }
    finally { setBusy(null); }
  };
  const discover = async () => {
    const saved = aiTasks.find(item => JSON.stringify(item.plan) === JSON.stringify(routePlan));
    if (!saved) { setError("Open your saved request and approve the search again."); return; }
    await runDiscovery(saved);
  };
  useEffect(() => {
    if (authenticated !== true || resumedSearch.current) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("task") || (params.has("sso") ? window.sessionStorage.getItem("smaj_pending_search") : null);
    if (!id) return;
    const saved = aiTasks.find(item=>item.id===id);
    if (!saved) return;
    resumedSearch.current = true;
    setTask(saved.task); setRoutePlan(saved.plan); setDelegation(null); setView("task-detail");
    if(params.has("sso")) setError("SMAJ PI HUB sign-in did not complete. Your request is saved; approve the search to try again.");
    window.sessionStorage.removeItem("smaj_pending_search");
    const resume = params.get("resumeSearch") === "1";
    window.history.replaceState(null,"",window.location.pathname);
    if (resume && !sandbox) void runDiscovery(saved, true);
  }, [authenticated, sandbox, aiTasks]);
  const activeTask = aiTasks.find(item => item.plan === routePlan || JSON.stringify(item.plan) === JSON.stringify(routePlan));
  const approveLive = async (actionIds: string[]) => {
    if (!activeTask) return;
    if (publicAccess) {
      setBusy("live-approval");setError("");
      try {
        const response=await fetch("/api/auth/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({taskId:activeTask.id,approved:true})});
        const payload=await response.json();
        if(!response.ok)throw new Error(payload.message || "Sign in to SMAJ PI HUB to perform protected actions.");
        window.sessionStorage.setItem("smaj_pending_search",activeTask.id);
        window.location.assign(payload.signInUrl);
      } catch(error) {setError(error instanceof Error?error.message:"Sign-in is required for protected actions.");}
      finally {setBusy(null);}
      return;
    }
    setBusy("live-approval"); setError("");
    try {
      const response = await fetch(`/api/tasks/${activeTask.id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approved: true, actionIds, reviewHash: activeTask.plan.actionReviewHash }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.message || "Live approval failed");
      setRoutePlan(payload.plan); setAiTasks(items => items.map(item => item.id === activeTask.id ? payload.task : item));
    } catch (error) { setError(error instanceof Error ? error.message : "Live approval failed"); } finally { setBusy(null); }
  };
  const retryLive = async () => {
    if (!activeTask) return;
    setBusy("live-retry"); setError("");
    try {
      const response = await fetch(`/api/tasks/${activeTask.id}/retry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Safe retry failed");
      setRoutePlan(payload.plan); setAiTasks(items => items.map(item => item.id === activeTask.id ? payload.task : item));
    } catch (error) { setError(error instanceof Error ? error.message : "Safe retry failed"); }
    finally { setBusy(null); }
  };
  useEffect(() => {
    if (!activeTask?.plan.execution || !["queued", "running", "retrying"].includes(activeTask.plan.execution.status)) return;
    const controller = new AbortController();
    const timer = setInterval(async () => {
      try { const response = await fetch(`/api/tasks/${activeTask.id}`, { cache: "no-store", signal: controller.signal }); if (!response.ok) return; const payload = await response.json(); setAiTasks(items => items.map(item => item.id === activeTask.id ? payload.task : item)); setRoutePlan(payload.task.plan); } catch { /* Saved state is available on reopen. */ }
    }, 2500);
    return () => { clearInterval(timer); controller.abort(); };
  }, [activeTask?.id, activeTask?.plan.execution?.status]);
  const deleteAiTask=async(id:string)=>{if(!window.confirm("Delete this task and its AI response?"))return;setBusy(`delete-${id}`);try{const response=await fetch(`/api/tasks/${id}`,{method:"DELETE",signal:AbortSignal.timeout(15000)});if(!response.ok){const payload=await response.json();throw new Error(payload.message||"Task deletion failed");}setAiTasks(items=>items.filter(item=>item.id!==id));if(activeTask?.id===id){setRoutePlan(null);setTask("");setView("tasks");}}catch(error){setError(error instanceof Error?error.message:"Task deletion failed");}finally{setBusy(null);}};
  const deleteDelegation=async(id:string)=>{if(!window.confirm("Delete this task, its drafts, and local proof receipt?"))return;setBusy(`delete-${id}`);try{const response=await fetch(`/api/delegations/${id}`,{method:"DELETE",signal:AbortSignal.timeout(15000)});if(!response.ok){const payload=await response.json();throw new Error(payload.message||"Task deletion failed");}streamRef.current?.close();setHistory(items=>items.filter(item=>item.id!==id));if(delegation?.id===id){setDelegation(null);setView("tasks");}}catch(error){setError(error instanceof Error?error.message:"Task deletion failed");}finally{setBusy(null);}};
  const setConnection=async(serviceId:ServiceId,connected:boolean)=>{setBusy(`connection-${serviceId}`);setError("");try{const response=await fetch("/api/connections",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({serviceId,connected})});const payload=await response.json() as ApiResponse;if(!response.ok||!payload.connections)throw new Error(payload.message||"Connection could not be updated");setConnections(payload.connections);}catch(connectionError){setError(connectionError instanceof Error?connectionError.message:"Connection failed safely");}finally{setBusy(null);}};
  const watch=(id:string)=>{streamRef.current?.close();const source=new EventSource(`/api/delegations/${id}/events`);source.addEventListener("delegation",event=>{const next=JSON.parse((event as MessageEvent).data) as DelegationView;updateDelegation(next);if(["verified","failed"].includes(next.status))source.close();});source.onerror=()=>source.close();streamRef.current=source;};
  const request=async(url:string,body:Record<string,unknown>,action:string)=>{setBusy(action);setError("");try{const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":`ui_${crypto.randomUUID()}`},body:JSON.stringify(body)});const payload=await response.json() as ApiResponse;if(!response.ok||!payload.delegation)throw new Error(payload.message||"Workflow request failed");updateDelegation(payload.delegation);return payload.delegation;}catch(requestError){setError(requestError instanceof Error?requestError.message:"Workflow stopped safely");return null;}finally{setBusy(null);}};
  const createJobsPlan=async()=>{const created=await request("/api/delegations",{goal:task,candidateName,skills:skills.split(",").map(value=>value.trim()).filter(Boolean),maxApplications:3},"planning");if(created){setSelectedJobs(created.selectedJobIds);setDelegation(created);}};
  const approve=()=>delegation&&request(`/api/delegations/${delegation.id}/approve`,{selectedJobIds:selectedJobs},"approving"); const execute=()=>{if(!delegation)return;watch(delegation.id);return request(`/api/delegations/${delegation.id}/execute`,{injectTransientFailure:injectFailure},"executing");};
  const openTask=(item:DelegationView)=>{setRoutePlan(null);setTask(item.goal);setDelegation(item);setSelectedJobs(item.selectedJobIds);navigate("task-detail");if(["executing","retrying","verifying"].includes(item.status))watch(item.id);};
  const downloadReceipt=(format: "json" | "pdf" = "json")=>{if(!delegation?.receipt)return;downloadReceiptFile(delegation.receipt,format,`smaj-proof-${delegation.id}.${format}`);};
  if(busy==="demo")return <DemoLoading/>;
  if(authenticated!==true)return <LandingPage demoEnabled={demoEnabled} startDemo={startDemo} authenticated={authenticated} ssoEnabled={ssoEnabled} accessToken={accessToken} setAccessToken={setAccessToken} busy={busy} error={error} login={login}/>;
  const connectedIds=new Set(connections.filter(item=>item.connected).map(item=>item.serviceId)); const pending=history.filter(item=>item.status==="awaiting_approval"); const receipts=history.filter(item=>item.receipt);
  return <main className="workspace">
    <header className="workspaceHeader">
      <div className="headerSide"><button className="iconButton" onClick={()=>setMenuOpen(true)} aria-label="Open menu"><Icon name="menu"/></button><button className="headerBrand" onClick={()=>navigate("home")}><BrandLogo/><div><strong>SMAJ AI</strong><small>VERIFIED DELEGATION</small></div></button></div>
      <div className="headerSide"><button className="headerNav" onClick={()=>navigate("tasks")} aria-label="Tasks"><Icon name="tasks"/><span>Tasks</span></button><button className="headerNav" onClick={()=>navigate("services")} aria-label="Apps"><Icon name="apps"/><span>Apps</span></button></div>
    </header>
    <div className={`menuOverlay ${menuOpen?"show":""}`} onClick={()=>setMenuOpen(false)}/>
    <aside className={`drawer ${menuOpen?"show":""}`}>
      <div className="drawerHead"><button className="headerBrand" onClick={()=>navigate("home")}><BrandLogo/><div><strong>SMAJ AI</strong><small>CONNECTED WORKSPACE</small></div></button><button className="iconButton" onClick={()=>setMenuOpen(false)}><Icon name="close"/></button></div>
      <nav><DrawerItem icon="home" label="Ask AI" active={view==="home"} onClick={()=>navigate("home")}/><DrawerItem icon="tasks" label="All Tasks" active={view==="tasks"} onClick={()=>navigate("tasks")}/><div className="drawerDivider"/><DrawerItem icon="profile" label="Profile & Settings" active={view==="profile"} onClick={()=>navigate("profile")}/></nav>
    </aside>
    <section className={`workspaceBody ${view==="services"?servicesStyles.body:""} ${view==="home"?"homeBody":""}`}>
      {sampleTasksEnabled&&sandbox&&<div className="demoNotice" role="status"><strong>Hackathon Demo</strong><span>Sample data. Simulated actions. Expires {expiresAt?time(new Date(expiresAt).toISOString()):"in one hour"}.</span><button className="secondaryButton" onClick={()=>navigate("tasks")}>Sample tasks</button><button className="secondaryButton" onClick={logout}>Exit demo</button></div>}
      {error&&<div className="errorBanner" role="alert"><strong>Request failed.</strong> {error}<button onClick={()=>setError("")}>×</button></div>}
      {view==="home"&&<HomeWorkspace task={task} setTask={setTask} selectedService={selectedService} selectService={setSelectedService} routeTask={routeTask} busy={busy} connectedIds={connectedIds}/>}
      {view==="services"&&<Services connections={connections} setConnection={setConnection} busy={busy}/>}
      {view==="tasks"&&<TaskHistory tasks={aiTasks} delegations={sampleTasksEnabled?history:[]} busy={busy} openAiTask={saved=>{setDelegation(null);setTask(saved.task);setRoutePlan(saved.plan);navigate("task-detail");}} deleteAiTask={deleteAiTask} openDelegation={openTask} deleteDelegation={deleteDelegation}/>}
      {view==="task-detail"&&<Tasks openHistory={()=>navigate("tasks")} liveTaskResult={activeTask?<LiveTaskResult key={activeTask.id} task={activeTask} busy={Boolean(busy)} sandbox={sandbox} discover={discover} approve={approveLive} retry={retryLive}/>:null} routePlan={routePlan} task={task} busy={busy} delegation={sampleTasksEnabled?delegation:null} jobsById={jobsById} selectedJobs={selectedJobs} setSelectedJobs={setSelectedJobs} approve={approve} execute={execute} injectFailure={injectFailure} setInjectFailure={setInjectFailure} downloadReceipt={downloadReceipt} deleteDelegation={deleteDelegation}/>}
      {view==="approvals"&&aiTasks.filter(t=>t.plan.proposedActions?.length&&!t.plan.execution).map(t=><button className="secondaryButton" key={t.id} onClick={()=>{setTask(t.task);setRoutePlan(t.plan);navigate("task-detail");}}>Review live actions: {t.task}</button>)}
      {view==="approvals"&&<Approvals items={pending} openTask={openTask}/>}
      {view==="receipts"&&aiTasks.filter(t=>t.plan.execution?.receipt).map(t=><button className="secondaryButton" key={t.id} onClick={()=>{setTask(t.task);setRoutePlan(t.plan);navigate("task-detail");}}>Live verified receipt: {t.task}</button>)}
      {view==="receipts"&&<Receipts items={receipts} openTask={openTask}/>}
      {view==="profile"&&<Profile connectedCount={connectedIds.size} taskCount={history.length} navigate={navigate} logout={logout}/>}
    </section>
  </main>;
}

function DrawerItem({icon,label,badge,active,onClick}:{icon:string;label:string;badge?:number;active:boolean;onClick:()=>void}){return <button className={active?"active":""} onClick={onClick}><Icon name={icon}/><span>{label}</span>{badge!==undefined&&badge>0&&<b>{badge}</b>}</button>}


export function Tasks(props:any){
  return <section className="tasksView compactResults" data-results-design="approved-compact-v2">
    <button className="taskHistoryBack" onClick={props.openHistory}>All Tasks</button>
    <p className="resultsEyebrow">AI TASK RESULTS</p>
    {props.task&&props.routePlan&&<div className="taskRequest">{props.task}</div>}
    {(props.routePlan||props.busy)&&<section className="resultsResponse"><BrandLogo className="resultsAvatar resultsAvatarLogo"/><div className="resultsContent"><p className="resultsWho">SMAJ AI</p>
      {props.busy?<Analyzing/>:props.routePlan&&<TypedResponse text={props.routePlan.summary}/>}
      {props.liveTaskResult}
    </div></section>}
    {props.delegation&&<DelegationDetail {...props}/>}
  </section>;
}

function Approvals({items,openTask}:{items:DelegationView[];openTask:(item:DelegationView)=>void}){return <Page title="Approvals" subtitle="Nothing sensitive happens without your permission."><div className="approvalList">{items.map(item=><article key={item.id}><span><Icon name="shield"/></span><div><strong>{item.goal}</strong><p>{item.plan.recommendations.length} mock Jobs actions are waiting for review.</p><small>No production submission or Pi payment will occur.</small></div><button className="primaryButton" onClick={()=>openTask(item)}>Review request</button></article>)}{items.length===0&&<Empty text="No pending approvals."/>}</div></Page>}
function Receipts({items,openTask}:{items:DelegationView[];openTask:(item:DelegationView)=>void}){return <Page title="Proof receipts" subtitle="Verified outcomes appear only after approved tasks complete."><div className="receiptList">{items.map(item=><button key={item.id} onClick={()=>openTask(item)}><span><Icon name="approve"/></span><div><small>VERIFIED RESULT</small><strong>{item.goal}</strong><code>{item.receipt?.proofHash.slice(0,32)}…</code></div><Icon name="arrow"/></button>)}{items.length===0&&<Empty text="No verified receipts yet."/>}</div></Page>}
function Profile({connectedCount,taskCount,navigate,logout}:{connectedCount:number;taskCount:number;navigate:(view:View)=>void;logout:()=>void}){return <Page title="Your workspace" subtitle="Manage your connections and protected demo session."><section className="profileCard"><div className="profileAvatar">S</div><div><h2>Demo profile</h2><p>{connectedCount} connected app · {taskCount} persistent tasks</p></div><button className="primaryButton" onClick={()=>navigate("services")}>Manage connections</button><button className="secondaryButton" onClick={logout}>Sign out</button></section></Page>}
function Page({title,subtitle,children,className=""}:{title:string;subtitle:string;children:React.ReactNode;className?:string}){return <section className={`pageView ${className}`}><h1>{title}</h1><p className="pageSub">{subtitle}</p>{children}</section>}
function Empty({text}:{text:string}){return <div className="emptyState"><Icon name="spark"/><p>{text}</p></div>}

function DelegationDetail({deleteDelegation,delegation,jobsById,selectedJobs,setSelectedJobs,busy,approve,execute,injectFailure,setInjectFailure,downloadReceipt}:any){
  const toggle=(id:string)=>setSelectedJobs((current:string[])=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);
  const running=["executing","retrying","verifying"].includes(delegation.status);
  return <><div className="taskRequest">{delegation.goal}</div><section className="resultsResponse"><BrandLogo className="resultsAvatar resultsAvatarLogo"/><div className="resultsContent">
    <p className="resultsWho">SMAJ AI <span className="taskResultMeta">· Demo</span></p>
    {running?<Analyzing/>:<TypedResponse text={delegation.plan.summary}/>}
    <div className="taskResultCards">{delegation.plan.recommendations.map((recommendation:any)=>{const job=jobsById.get(recommendation.jobId) as JobsApiJob|undefined;if(!job)return null;return <article className="taskResultCard" key={job.id}>
      <input type="checkbox" aria-label={`Select ${job.title}`} checked={selectedJobs.includes(job.id)} disabled={delegation.status!=="awaiting_approval"||Boolean(busy)} onChange={()=>toggle(job.id)}/>
      <div className="taskResultInfo"><h3>{job.title}</h3><p className="taskResultMeta">{job.company} · {job.location}</p><details className="taskEvidence"><summary>Review draft</summary><p>{recommendation.coverNote}</p></details></div>
    </article>})}</div>
    {delegation.status==="awaiting_approval"&&<div className="resultsApproval"><strong>Ready to continue?</strong><p>Approve {selectedJobs.length} simulated applications. No real application will be submitted.</p><button className="primaryButton" disabled={Boolean(busy)||!selectedJobs.length} onClick={approve}>Approve {selectedJobs.length} demo actions</button></div>}
    {delegation.status==="approved"&&<div className="resultsApproval"><strong>Approved</strong><p>Run the selected demo applications.</p><label className="taskResultMeta"><input type="checkbox" checked={injectFailure} onChange={event=>setInjectFailure(event.target.checked)}/> Demonstrate a retry</label><div className="resultsActions"><button className="primaryButton" disabled={Boolean(busy)} onClick={execute}>Run approved actions</button></div></div>}
    <p className="taskResultMeta" role="status">{statusLabels[delegation.status]}</p>
    {delegation.receipt&&<div className="resultsApproval"><strong>Demo result verified</strong><p>{delegation.receipt.proof.actions.length} simulated actions confirmed.</p><div className="resultsActions"><button className="secondaryButton" onClick={()=>downloadReceipt("pdf")}>Download receipt</button><button className="secondaryButton" onClick={()=>downloadReceipt("json")}>Download JSON</button></div></div>}
    <details className="taskEvidence"><summary>Task activity</summary>{delegation.events.map((event:any)=><p key={event.id}>{event.message}</p>)}</details>
    <button className="taskViewLink" disabled={Boolean(busy)||running} onClick={()=>deleteDelegation(delegation.id)}>Delete task</button>
  </div></section></>;
}
