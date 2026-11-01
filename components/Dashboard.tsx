"use client";
import { useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import LandingPage from "@/components/LandingPage";
import HomeWorkspace from "@/components/HomeWorkspace";
import Services from "@/components/Services";
import servicesStyles from "@/components/Services.module.css";
import SavedTasks from "@/components/SavedTasks";
import LiveTaskResult from "@/components/LiveTaskResult";
import type { AiTask } from "@/src/server/ai-tasks";
import type { ServiceConnection } from "@/src/server/service-connections";
import { SMAJ_SERVICES, type ServiceId } from "@/src/domain/services";
import { TASK_PHASES, taskState } from "@/src/domain/task-state";

type View = "home" | "tasks" | "services" | "approvals" | "receipts" | "profile";
async function api(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || `Request failed (HTTP ${response.status})`);
  return payload;
}
export default function Dashboard() {
  const [authenticated,setAuthenticated]=useState<boolean|null>(null);
  const [ssoEnabled,setSsoEnabled]=useState(false);
  const [view,setView]=useState<View>("home"); const [menuOpen,setMenuOpen]=useState(false);
  const [tasks,setTasks]=useState<AiTask[]>([]); const [connections,setConnections]=useState<ServiceConnection[]>([]);
  const [request,setRequest]=useState(""); const [selectedService,setSelectedService]=useState<ServiceId|null>(null);
  const [activeId,setActiveId]=useState<string|null>(null); const [busy,setBusy]=useState<string|null>(null); const [error,setError]=useState("");
  const active=tasks.find(t=>t.id===activeId); const connectedIds=new Set(connections.filter(c=>c.connected).map(c=>c.serviceId));
  const publish=(task:AiTask)=>{setTasks(items=>[task,...items.filter(item=>item.id!==task.id)]);setActiveId(task.id);};
  const navigate=(next:View)=>{setView(next);setMenuOpen(false);};
  useEffect(()=>{
    const controller=new AbortController();
    void (async()=>{try{
      const session=await api("/api/auth/session",{signal:controller.signal});setSsoEnabled(session.ssoEnabled);
      if(!session.authenticated){setAuthenticated(false);return;}
      const [history,apps]=await Promise.all([api("/api/tasks",{signal:controller.signal}),api("/api/connections",{signal:controller.signal})]);
      setTasks(history.tasks);setConnections(apps.connections);setAuthenticated(true);
    }catch(e){if(!controller.signal.aborted){setError(e instanceof Error?e.message:"Workspace unavailable");setAuthenticated(false);}}})();
    return()=>controller.abort();
  },[]);
  const pending=tasks.filter(t=>t.plan.execution&&["queued","running","verifying","retrying"].includes(t.plan.execution.status)).map(t=>t.id).join(",");
  useEffect(()=>{
    if(!pending)return;
    const controller=new AbortController();
    const timer=setInterval(()=>{void api("/api/tasks",{signal:controller.signal}).then(data=>setTasks(data.tasks)).catch(()=>{if(!controller.signal.aborted)setError("Could not refresh execution progress. Reopen the saved task to check its actual outcome.");});},2000);
    return()=>{clearInterval(timer);controller.abort();};
  },[pending]);
  async function run(label:string,action:()=>Promise<void>){setBusy(label);setError("");try{await action();}catch(e){setError(e instanceof Error?e.message:"Request failed");}finally{setBusy(null);}}
  const post=(url:string,body:unknown)=>api(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(170000)});
  const routeTask=(event:React.FormEvent)=>{event.preventDefault();if(!request.trim()||busy)return;void run("Analyzing",async()=>{
    const service=SMAJ_SERVICES.find(s=>s.id===selectedService);
    const data=await post("/api/tasks",{task:service?`${service.name}: ${request.trim()}`:request.trim()});publish(data.task);navigate("tasks");
  });};
  const discover=()=>active&&run("Analyzing",async()=>{
    for(const serviceId of active.plan.services.filter(id=>["jobs","store","stream"].includes(id))){if(!connectedIds.has(serviceId)){const data=await post("/api/connections",{serviceId,connected:true});setConnections(data.connections);}}
    const data=await post(`/api/tasks/${active.id}/discover`,{approved:true});publish(data.task);
  });
  const approve=(actionIds:string[])=>active&&run("Approving",async()=>{const data=await post(`/api/tasks/${active.id}/approve`,{approved:true,actionIds,reviewHash:active.plan.actionReviewHash});publish(data.task);});
  const setConnection=(serviceId:ServiceId,connected:boolean)=>void run(`connection-${serviceId}`,async()=>{const data=await post("/api/connections",{serviceId,connected});setConnections(data.connections);});
  const remove=(id:string)=>{if(!window.confirm("Delete this saved task and its evidence?"))return;void run(`delete-${id}`,async()=>{const response=await fetch(`/api/tasks/${id}`,{method:"DELETE"});if(!response.ok){const data=await response.json();throw new Error(data.message);}setTasks(items=>items.filter(t=>t.id!==id));if(activeId===id)setActiveId(null);});};
  const open=(task:AiTask)=>{setActiveId(task.id);setRequest(task.task);navigate("tasks");};
  const logout=()=>void run("Signing out",async()=>{await api("/api/auth/session",{method:"DELETE"});setAuthenticated(false);setTasks([]);setConnections([]);setActiveId(null);});
  if(authenticated!==true)return <LandingPage checking={authenticated===null} ssoEnabled={ssoEnabled} error={error}/>;
  const awaiting=tasks.filter(t=>taskState(t.plan)==="Awaiting Approval"); const receipts=tasks.filter(t=>t.plan.execution?.status==="verified"&&t.plan.execution.receipt);
  return <main className="workspace">
    <header className="workspaceHeader"><div className="headerSide"><button className="iconButton" onClick={()=>setMenuOpen(true)} aria-label="Open menu">☰</button><button className="headerBrand" onClick={()=>navigate("home")}><BrandLogo/><div><strong>SMAJ AI</strong><small>VERIFIED DELEGATION</small></div></button></div><div className="headerSide"><button className="headerNav" onClick={()=>navigate("tasks")}>Tasks</button><button className="headerNav" onClick={()=>navigate("services")}>Apps</button><button className="avatar" onClick={()=>navigate("profile")} aria-label="Profile">S</button></div></header>
    <div className={`menuOverlay ${menuOpen?"show":""}`} onClick={()=>setMenuOpen(false)}/><aside className={`drawer ${menuOpen?"show":""}`}><div className="drawerHead"><strong>SMAJ AI</strong><button onClick={()=>setMenuOpen(false)} aria-label="Close menu">×</button></div><nav>{([['home','Home'],['tasks','All tasks'],['services','Connected apps'],['approvals','Approvals'],['receipts','Proof receipts'],['profile','Profile & settings']] as [View,string][]).map(([id,label])=><button className={view===id?"active":""} key={id} onClick={()=>navigate(id)}>{label}</button>)}</nav></aside>
    <section className={`workspaceBody ${view==="services"?servicesStyles.body:""} ${view==="home"?"homeBody":""}`}>
      {error&&<div className="errorBanner" role="alert">{error}<button onClick={()=>setError("")} aria-label="Dismiss error">×</button></div>}
      {busy==="Analyzing"&&<p role="status">Analyzing · Waiting for the actual Meta response and requested service analysis…</p>}
      {view==="home"&&<HomeWorkspace task={request} setTask={setRequest} selectedService={selectedService} selectService={setSelectedService} routeTask={routeTask} busy={busy==="Analyzing"?"routing":busy} connectedIds={connectedIds} manageApps={()=>navigate("services")}/>}
      {view==="services"&&<Services connections={connections} setConnection={setConnection} busy={busy}/>}
      {view==="tasks"&&<section className="pageView"><h1>AI Tasks &amp; Results.</h1><p className="pageSub">Every action planned. Every decision yours. Every result verifiable.</p>
        <form className="centralComposer" onSubmit={routeTask}><label htmlFor="unified-ai-request">Ask SMAJ AI across connected services</label><textarea id="unified-ai-request" value={request} onChange={e=>setRequest(e.target.value)} maxLength={1900} placeholder="Find software engineering jobs, Store products, or Stream content…"/><button className="primaryButton" disabled={Boolean(busy)||!request.trim()}>Ask SMAJ AI</button></form>
        {active&&<><section className="routePlan"><div className="routePlanHead"><div><small>{active.plan.summaryError?"Meta analysis unavailable":active.plan.summaryAi?`Meta response · ${active.plan.summaryAi.model}`:active.plan.ai?`Meta plan · ${active.plan.ai.model}`:"Model provenance unavailable"}</small><h2>{active.task}</h2></div><span className="taskTag">{taskState(active.plan)}</span></div><div className="progressFlow" aria-label="Workflow phases">{TASK_PHASES.map(phase=><span aria-current={taskState(active.plan)===phase?"step":undefined} key={phase}>{phase}</span>)}</div><p style={{whiteSpace:"pre-wrap"}}>{active.plan.summary}</p><p>Selected services: {active.plan.services.map(id=>SMAJ_SERVICES.find(s=>s.id===id)?.name||id).join(", ")||"No service action required"}</p><div className="routeFlow">{active.plan.steps.map(step=><article key={step.id}><div><strong>{step.title}</strong><small>{step.serviceId} · {step.status}</small><p>{step.description}</p><p>{step.reason}</p></div></article>)}</div>{active.plan.activity?.map((event,index)=><p key={index}><small>{event.at}</small> · {event.phase}: {event.message}</p>)}{active.plan.sources?.length&&<details className="knowledgeSources"><summary>Repository sources</summary><ul>{active.plan.sources.map(source=><li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul></details>}{active.plan.warnings.map((warning,index)=><p key={index}>{warning}</p>)}</section><LiveTaskResult key={active.id} task={active} busy={Boolean(busy)} discover={()=>void discover()} approve={ids=>void approve(ids)}/></>}
        <SavedTasks tasks={tasks} open={open} remove={remove} busy={busy}/>{!tasks.length&&<p>No requests yet. Submit a request to start real AI analysis.</p>}
      </section>}
      {view==="approvals"&&<section className="pageView"><h1>Approvals</h1>{awaiting.map(task=><button className="secondaryButton" key={task.id} onClick={()=>open(task)}>Review: {task.task}</button>)}{!awaiting.length&&<p>No requests awaiting approval.</p>}</section>}
      {view==="receipts"&&<section className="pageView"><h1>Proof receipts</h1><p>Available only for approved actions independently verified against Hub records.</p>{receipts.map(task=><button className="secondaryButton" key={task.id} onClick={()=>open(task)}>Verified execution: {task.task}</button>)}{!receipts.length&&<p>No verified execution receipts yet.</p>}</section>}
      {view==="profile"&&<section className="pageView"><h1>Your workspace</h1><p>Signed in through SMAJ PI HUB. {connectedIds.size} services connected.</p><button className="primaryButton" onClick={()=>navigate("services")}>Manage connections</button><button className="secondaryButton" onClick={logout}>Sign out</button></section>}
    </section>
  </main>;
}
