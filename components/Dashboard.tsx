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
import { readConversationCache, writeConversationCache } from "@/components/conversation-storage";
import { dashboardRouteUrl, parseDashboardRoute, type DashboardRoute } from "@/src/domain/dashboard-route";
import type { AiTask } from "@/src/server/ai-tasks";
import { SMAJ_SERVICES, type ServiceId, type ServiceRoutePlan } from "@/src/domain/services";
import type { DelegationView, JobsApiJob } from "@/src/domain/types";
import type { ServiceConnection } from "@/src/server/service-connections";

type View = "home" | "tasks" | "task-detail" | "services" | "approvals" | "receipts" | "profile";
type ApiResponse = { tasks?: AiTask[]; task?: AiTask; delegation?: DelegationView; delegations?: DelegationView[]; plan?: ServiceRoutePlan; connections?: ServiceConnection[]; message?: string; storageScope?: string };
type PendingMessage = { id: string; text: string; conversationId: string; persistedConversation: boolean; requestKey: string; status: "sending" | "failed"; error?: string; image?: { mimeType: string; data: string } };
const statusLabels: Record<string, string> = { awaiting_approval: "Awaiting approval", approved: "Approved", executing: "Executing", retrying: "Recovering", verifying: "Verifying", verified: "Verified", failed: "Needs attention" };
const time = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

const Icon = ({ name }: { name: string }) => {
  const paths: Record<string, React.ReactNode> = {
    menu:<path d="M4 7h16M4 12h16M4 17h16"/>, close:<path d="m6 6 12 12M18 6 6 18"/>, back:<path d="m15 18-6-6 6-6M9 12h11"/>, home:<><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>, tasks:<><path d="M9 6h11M9 12h11M9 18h11"/><path d="m4 6 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2"/></>, apps:<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>, approve:<path d="m5 12 4 4L19 6"/>, receipt:<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6"/>, profile:<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>, plus:<path d="M12 5v14M5 12h14"/>, arrow:<path d="M5 12h14m-5-5 5 5-5 5"/>, shield:<path d="M12 3 5 6v5c0 4.7 2.8 8.3 7 10 4.2-1.7 7-5.3 7-10V6l-7-3Zm-3 9 2 2 4-4"/>, spark:<path d="m12 2 1.5 5L18 9l-4.5 2L12 16l-1.5-5L6 9l4.5-2L12 2Z"/>, lock:<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.spark}</svg>;
};

export default function Dashboard() {
  const [view,setViewState]=useState<View>("home"); const viewRef=useRef<View>("home"); const setView=(next:View)=>{viewRef.current=next;setViewState(next);}; const [menuOpen,setMenuOpen]=useState(false); const [authenticated,setAuthenticated]=useState<boolean|null>(null); const [ssoEnabled,setSsoEnabled]=useState(false); const [demoEnabled,setDemoEnabled]=useState(false); const [sandbox,setSandbox]=useState(false); const [expiresAt,setExpiresAt]=useState<number|null>(null); const [accessToken,setAccessToken]=useState("");
  const [route,setRoute]=useState<DashboardRoute>({view:"home"});
  const [aiTasks,setAiTasks]=useState<AiTask[]>([]); const [selectedService,setSelectedService]=useState<ServiceId|null>(null); const [task,setTask]=useState(""); const [routePlan,setRoutePlan]=useState<ServiceRoutePlan|null>(null); const [connections,setConnections]=useState<ServiceConnection[]>([]); const [history,setHistory]=useState<DelegationView[]>([]); const [delegation,setDelegation]=useState<DelegationView|null>(null);
  const [homeImage,setHomeImage]=useState<{mimeType:"image/jpeg"|"image/png"|"image/webp";data:string;name:string}|null>(null);
  const [threadTaskIds,setThreadTaskIds]=useState<string[]>([]); const [threadConversationId,setThreadConversationId]=useState<string|null>(null); const loadedConversations=useRef(new Set<string>());
  const discoveryInFlight=useRef(new Set<string>()); const automaticDiscoveryStarted=useRef(new Set<string>());
  const [pendingMessage,setPendingMessage]=useState<PendingMessage|null>(null);
  const [messageImages,setMessageImages]=useState<Record<string,{mimeType:string;data:string}>>({});
  const [candidateName,setCandidateName]=useState(""); const [skills,setSkills]=useState(""); const [selectedJobs,setSelectedJobs]=useState<string[]>([]); const [injectFailure,setInjectFailure]=useState(true); const [busy,setBusy]=useState<string|null>(null); const [error,setError]=useState(""); const [storageScope,setStorageScope]=useState<string|null>(null);
  const notifyError=(failure:unknown,fallback:string)=>{console.error("[SMAJ AI] Request failed:",failure);const detail=failure instanceof Error?failure.message:typeof failure==="string"?failure:"";setError(detail&&detail!=="Failed to fetch"?detail:detail==="Failed to fetch"?`${fallback} Check your connection and try again.`:fallback);};
  useEffect(()=>{if(!error)return;const timer=setTimeout(()=>setError(""),5000);return()=>clearTimeout(timer);},[error]);
  useEffect(()=>{if(authenticated!==true||!storageScope)return;try{writeConversationCache(window.localStorage,storageScope,{tasks:aiTasks,delegations:history});}catch(failure){notifyError(failure,"Conversation history could not be saved in this browser.");}},[aiTasks,history,authenticated,storageScope]);
  const demoEntryPending=useRef(false);
  const viewHistory=useRef<View[]>([]);
  const routeRestored=useRef(false);
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
  const updateRoute=(next:DashboardRoute,replace=false)=>{routeRestored.current=true;setRoute(next);setView(next.view);const url=dashboardRouteUrl(window.location.href,next);if(replace)window.history.replaceState({smajDashboard:true},"",url);else window.history.pushState({smajDashboard:true},"",url);};
  const updateDelegation=(next:DelegationView)=>{setDelegation(next);setHistory(current=>[next,...current.filter(item=>item.id!==next.id)]);};
  const loadWorkspace=async(signal?:AbortSignal)=>{const [tasksResponse,connectionsResponse,aiTasksResponse]=await Promise.all([fetch("/api/delegations",{cache:"no-store",signal}),fetch("/api/connections",{cache:"no-store",signal}),fetch("/api/tasks",{cache:"no-store",signal})]);const unauthorized=[tasksResponse,connectionsResponse,aiTasksResponse].find(response=>response.status===401);if(unauthorized){setAuthenticated(false);return false;}if(!tasksResponse.ok||!connectionsResponse.ok||!aiTasksResponse.ok)throw new Error(`Workspace could not be loaded (HTTP ${[tasksResponse,connectionsResponse,aiTasksResponse].find(response=>!response.ok)?.status}).`);const tasksPayload=await tasksResponse.json() as ApiResponse;const connectionsPayload=await connectionsResponse.json() as ApiResponse;const savedTasks=((await aiTasksResponse.json()) as ApiResponse).tasks||[];setAiTasks(savedTasks);const latest=savedTasks[0];if(latest?.requestKey&&(latest.plan.generationStatus==="pending"||latest.plan.generationStatus==="failed"))setPendingMessage({id:latest.id,text:latest.task,conversationId:latest.conversationId||latest.id,persistedConversation:true,requestKey:latest.requestKey,status:"failed",error:latest.plan.generationError||"Your message is saved. Retry to get the AI response."});setHistory(tasksPayload.delegations||[]);setConnections(connectionsPayload.connections||[]);setAuthenticated(true);return true;};
  useEffect(()=>{
    const restoreFromUrl=()=>{const next=parseDashboardRoute(window.location.search);setRoute(next);setView(next.view);};
    restoreFromUrl();
    const onPopState=()=>{routeRestored.current=false;restoreFromUrl();setMenuOpen(false);};
    window.addEventListener("popstate",onPopState);
    return()=>window.removeEventListener("popstate",onPopState);
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    const load=async()=>{
      const response=await fetch("/api/auth/session",{cache:"no-store",signal:controller.signal});
      if(!response.ok)throw new Error("Your sign-in status could not be checked. Please try again.");
      const payload=await response.json();
      const scope=payload.storageScope;
      if(typeof scope==="string")setStorageScope(scope);
      setPublicAccess(Boolean(payload.publicAccess));
      setSampleTasksEnabled(Boolean(payload.sampleTasksEnabled));setSsoEnabled(Boolean(payload.ssoEnabled));setDemoEnabled(Boolean(payload.demoEnabled));setSandbox(Boolean(payload.sandbox));setExpiresAt(payload.expiresAt||null);
      if(!payload.authenticated&&!payload.publicAccess){setAuthenticated(false);return;}
      try{const loaded=await loadWorkspace(controller.signal);if(!loaded)setAuthenticated(false);}catch(failure){if(controller.signal.aborted)return;let check:Response;try{check=await fetch("/api/auth/session",{cache:"no-store",signal:controller.signal});}catch{if(!controller.signal.aborted){setAuthenticated(false);notifyError(failure,"Saved conversations could not be refreshed.");}return;}if(!check.ok){setAuthenticated(false);notifyError(failure,"Saved conversations could not be refreshed.");return;}const current=await check.json();if(!current.authenticated&&!current.publicAccess){setAuthenticated(false);return;}const cached=typeof scope==="string"?readConversationCache(window.localStorage,scope):null;if(cached){setAiTasks(cached.tasks);setHistory(cached.delegations);}setAuthenticated(true);notifyError(failure,"Saved conversations could not be refreshed.");}
    };
    void load().catch(error=>{if(!controller.signal.aborted){setAuthenticated(false);notifyError(error,"Sign-in could not be checked");}});
    return()=>{controller.abort();streamRef.current?.close();};
  },[]);
  useEffect(()=>{if(!sandbox||!expiresAt)return;  const expire=()=>{streamRef.current?.close();setAuthenticated(false);setHistory([]);setAiTasks([]);setMessageImages({});setTask("");setSelectedService(null);setConnections([]);setDelegation(null);setRoutePlan(null);setSandbox(false);setExpiresAt(null);setError("Your demo session expired. Try Live Demo to start a fresh workspace.");};const timer=setTimeout(expire,Math.max(0,expiresAt-Date.now()));return()=>clearTimeout(timer);},[sandbox,expiresAt]);
  const login=async(event:React.FormEvent)=>{event.preventDefault();setBusy("login");setError("");try{const response=await fetch("/api/auth/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accessToken})});const payload=await response.json() as ApiResponse;if(!response.ok)throw new Error(payload.message||"Authentication failed");if(payload.storageScope)setStorageScope(payload.storageScope);setAccessToken("");await loadWorkspace();}catch(loginError){notifyError(loginError,"Authentication failed");}finally{setBusy(null);}};
  const startDemo=async()=>{demoEntryPending.current=true;viewHistory.current=[];updateRoute({view:"home"},true);setMenuOpen(false);setBusy("demo");setError("");const signal=AbortSignal.timeout(30000);try{const response=await fetch("/api/public/session",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}",signal});const payload=await response.json();if(!response.ok)throw new Error(payload.message||"The demo could not be started. Please try again.");if(typeof payload.storageScope==="string")setStorageScope(payload.storageScope);setPublicAccess(Boolean(payload.publicAccess));setSandbox(false);setExpiresAt(payload.expiresAt);if(!await loadWorkspace(signal))throw new Error("The demo workspace could not be loaded. Please try again.");}catch(failure){notifyError(failure,"The demo could not be started. Please try again.");}finally{setBusy(null);}};
  const logout=async()=>{setError("");try{const response=await fetch("/api/auth/session",{method:"DELETE",signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error("Sign-out failed. Please try again.");streamRef.current?.close();setAuthenticated(false);setStorageScope(null);setHistory([]);setAiTasks([]);setMessageImages({});setTask("");setSelectedService(null);setConnections([]);setDelegation(null);setRoutePlan(null);setSandbox(false);setExpiresAt(null);viewHistory.current=[];updateRoute({view:"home"},true);setMenuOpen(false);}catch(failure){notifyError(failure,"Sign-out failed. Please try again.");}};
  const navigate=(next:View,selection?:Pick<DashboardRoute,"taskId"|"delegationId">)=>{if(viewRef.current!==next)viewHistory.current.push(viewRef.current);updateRoute({view:next,...selection});setMenuOpen(false);window.scrollTo({top:0,behavior:"smooth"});};
  const goBack=()=>{if(window.history.state?.smajDashboard){window.history.back();return;}const previous=viewHistory.current.pop()||"home";updateRoute({view:previous},true);setMenuOpen(false);window.scrollTo({top:0,behavior:"smooth"});};
  const submitTask=async(message:string,conversationId?:string,retryPending?:PendingMessage,image?:{mimeType:string;data:string}):Promise<boolean>=>{
    const attachedImage=retryPending?.image||image;
    if(!message.trim()&&!attachedImage){setError("Enter a message or attach an image.");return false;}
    if(busy==="routing")return false;
    const service=conversationId||retryPending?undefined:SMAJ_SERVICES.find(item=>item.id===selectedService);
    const prompt=message.trim()||"Describe this image and suggest relevant SMAJ Store search terms.";
    const requestTask=retryPending?retryPending.text:service?`${service.name}: ${prompt}`:prompt;
    const optimistic=retryPending||{id:`pending-${crypto.randomUUID()}`,text:requestTask,conversationId:conversationId||crypto.randomUUID(),persistedConversation:Boolean(conversationId),requestKey:crypto.randomUUID(),status:"sending" as const,...(attachedImage?{image:attachedImage}:{})};
    setPendingMessage({...optimistic,status:"sending",error:undefined});
    setTask(requestTask);setBusy("routing");setError("");
    if(!conversationId){setDelegation(null);setRoutePlan(null);if(viewRef.current!=="task-detail")navigate("task-detail");}
    try{
      const response=await fetch("/api/tasks",{signal:AbortSignal.timeout(135000),method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":optimistic.requestKey},body:JSON.stringify({task:requestTask,...(conversationId?{conversationId}:{}),...(attachedImage?{image:{mimeType:attachedImage.mimeType,data:attachedImage.data}}:{})})});
      const payload=await response.json().catch(()=>({})) as ApiResponse;
      if(!response.ok||!payload.plan||!payload.task)throw new Error((payload.message||"SMAJ AI could not answer. Please try again.")+(response.status===429&&response.headers.get("Retry-After")?` Try again in ${response.headers.get("Retry-After")} seconds.`:""));
      setAiTasks(items=>[payload.task!,...items.filter(item=>item.id!==payload.task!.id)]);
      if(attachedImage)setMessageImages(images=>({...images,[payload.task!.id]:attachedImage}));
      const id=payload.task.conversationId||payload.task.id;
      setThreadTaskIds(current=>conversationId&&threadConversationId===conversationId?[...current,payload.task!.id]:[payload.task!.id]);
      setThreadConversationId(id);loadedConversations.current.add(id);
      setPendingMessage({...optimistic,id:payload.task.id,conversationId:id,persistedConversation:true,status:"sending",error:undefined});
      setDelegation(null);setRoutePlan(payload.plan);updateRoute({view:"task-detail",taskId:payload.task.id},true);
      if(!sandbox&&payload.task.plan.services.some(serviceId=>["store","jobs","stream"].includes(serviceId)))await runDiscovery(payload.task);
      setPendingMessage(null);
      return true;
    }catch(routeError){
      const message=routeError instanceof Error?routeError.message:"SMAJ AI could not answer. Please try again.";
      setPendingMessage(current=>current?.id===optimistic.id?{...current,status:"failed",error:message}:current);
      notifyError(routeError,"SMAJ AI could not answer. Please retry.");
    }
    finally{setBusy(null);}
    return false;
  };
  const retryPendingMessage=()=>{if(!pendingMessage)return;void submitTask(pendingMessage.text,pendingMessage.persistedConversation?pendingMessage.conversationId:undefined,pendingMessage,pendingMessage.image);};
  const routeTask=async(event:React.FormEvent)=>{event.preventDefault();if(await submitTask(task,undefined,undefined,homeImage||undefined))setHomeImage(null);};
  const runDiscovery = async (saved: AiTask, resume = false) => {
    if(discoveryInFlight.current.has(saved.id))return;
    automaticDiscoveryStarted.current.add(saved.id);
    discoveryInFlight.current.add(saved.id);
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
      const response = await fetch(`/api/tasks/${saved.id}/discover`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(resume ? {resume:true} : {}), signal:AbortSignal.timeout(180000)});
      const payload = await response.json();
      if (!response.ok) throw new Error((payload.message || "Search failed. Please try again.") + (response.status===429&&response.headers.get("Retry-After")?` Try again in ${response.headers.get("Retry-After")} seconds.`:""));
      if(route.taskId===saved.id)setRoutePlan(payload.plan); setAiTasks(items => items.map(item => item.id === saved.id ? payload.task : item));
      fetch("/api/connections", {cache:"no-store"}).then(async response=>{if(!response.ok)throw new Error(`Connections could not be refreshed (HTTP ${response.status}).`);return response.json();}).then(payload=>{if(payload?.connections)setConnections(payload.connections);}).catch(failure=>notifyError(failure,"Connections could not be refreshed."));
    } catch (failure) { notifyError(failure,"Search failed. Please try again."); }
    finally { discoveryInFlight.current.delete(saved.id); setBusy(null); }
  };
  useEffect(() => {
    if (authenticated !== true || routeRestored.current) return;
    const params = new URLSearchParams(window.location.search);
    const pendingSearchId = params.has("sso") ? window.sessionStorage.getItem("smaj_pending_search") : null;
    if(route.legacyConversationList){
      routeRestored.current=true;
      updateRoute({view:"tasks"},true);
      return;
    }
    if(route.conversationId){
      routeRestored.current=true;
      const controller=new AbortController();
      void fetch(`/api/conversations/${encodeURIComponent(route.conversationId)}`,{cache:"no-store",signal:controller.signal}).then(async response=>{
        const payload=await response.json() as ApiResponse;
        if(!response.ok||!Array.isArray(payload.tasks))throw new Error(payload.message||"Saved task could not be restored.");
        const turns=payload.tasks as AiTask[];
        const latest=turns.at(-1);
        if(!latest){updateRoute({view:"tasks"},true);return;}
        setAiTasks(current=>{const byId=new Map(current.map(item=>[item.id,item]));for(const item of turns)byId.set(item.id,item);return [...byId.values()];});
        setTask(latest.task);setRoutePlan(latest.plan);setDelegation(null);
        const conversationId=latest.conversationId||latest.id;
        const unfinished=turns.at(-1);const requestKey=unfinished?.requestKey;
        if(unfinished&&requestKey&&(unfinished.plan.generationStatus==="pending"||unfinished.plan.generationStatus==="failed"))setPendingMessage({id:unfinished.id,text:unfinished.task,conversationId:unfinished.conversationId||unfinished.id,persistedConversation:true,requestKey,status:"failed",error:unfinished.plan.generationError||"Your message is saved. Retry to get the AI response."});
        setThreadTaskIds(turns.filter(item=>item.plan.generationStatus!=="pending"&&item.plan.generationStatus!=="failed").map(item=>item.id));setThreadConversationId(conversationId);loadedConversations.current.add(conversationId);
        updateRoute({view:"task-detail",taskId:latest.id},true);
      }).catch(failure=>{
        if(!controller.signal.aborted){notifyError(failure,"Saved task could not be restored.");updateRoute({view:"tasks"},true);}
      });
      return()=>controller.abort();
    }
    if (route.view !== "task-detail" && pendingSearchId) {
      const saved = aiTasks.find(item => item.id === pendingSearchId);
      if (saved) {
        setTask(saved.task);setRoutePlan(saved.plan);setDelegation(null);setView("task-detail");
        window.sessionStorage.removeItem("smaj_pending_search");
        routeRestored.current = true;
        updateRoute({view:"task-detail",taskId:saved.id},true);
        setError("SMAJ PI HUB sign-in did not complete. Your request is saved; approve the search to try again.");
        return;
      }
    }
    if (route.view !== "task-detail") {
      setView(route.view);
      routeRestored.current = true;
      return;
    }
    if (route.delegationId) {
      const saved = history.find(item => item.id === route.delegationId);
      if (!saved) { updateRoute({view:"tasks"},true);return; }
      setRoutePlan(null);setTask(saved.goal);setDelegation(saved);setSelectedJobs(saved.selectedJobIds);setView("task-detail");
      routeRestored.current = true;
      if(["executing","retrying","verifying"].includes(saved.status))watch(saved.id);
      return;
    }
    const taskId = route.taskId || (params.has("sso") ? window.sessionStorage.getItem("smaj_pending_search") : null);
    const saved = aiTasks.find(item => item.id === taskId);
    if (!saved) { updateRoute({view:"tasks"},true);return; }
    setTask(saved.task);setRoutePlan(saved.plan);setDelegation(null);setView("task-detail");
    const resume = params.get("resumeSearch") === "1";
    if (params.has("sso")) setError("SMAJ PI HUB sign-in did not complete. Your request is saved; approve the search to try again.");
    window.sessionStorage.removeItem("smaj_pending_search");
    routeRestored.current = true;
    if (route.taskId || resume || params.has("sso")) updateRoute({view:"task-detail",taskId:saved.id},true);
    if (resume && !sandbox) void runDiscovery(saved, true);
  }, [authenticated, sandbox, aiTasks, history, route]);
  useEffect(()=>{
    if(authenticated!==true||route.view!=="task-detail"||!route.taskId)return;
    const saved=aiTasks.find(item=>item.id===route.taskId);
    const conversationId=saved?.conversationId||saved?.id;
    if(!conversationId||(threadConversationId===conversationId&&loadedConversations.current.has(conversationId)))return;
    loadedConversations.current.add(conversationId);
    const controller=new AbortController();
    void fetch(`/api/conversations/${conversationId}`,{cache:"no-store",signal:controller.signal}).then(async response=>{
      const payload=await response.json();
      if(!response.ok||!Array.isArray(payload.tasks))throw new Error(payload.message||"Conversation could not be restored.");
      const turns=payload.tasks as AiTask[];
      setAiTasks(current=>{const byId=new Map(current.map(item=>[item.id,item]));for(const item of turns)byId.set(item.id,item);return [...byId.values()];});
      const unfinished=turns.at(-1);const requestKey=unfinished?.requestKey;if(unfinished&&requestKey&&(unfinished.plan.generationStatus==="pending"||unfinished.plan.generationStatus==="failed"))setPendingMessage(current=>current||{id:unfinished.id,text:unfinished.task,conversationId:unfinished.conversationId||unfinished.id,persistedConversation:true,requestKey,status:"failed",error:unfinished.plan.generationError||"Your message is saved. Retry to get the AI response."});
      setThreadTaskIds(turns.filter(item=>item.plan.generationStatus!=="pending"&&item.plan.generationStatus!=="failed").map(item=>item.id));setThreadConversationId(conversationId);
    }).catch(failure=>{loadedConversations.current.delete(conversationId);if(!controller.signal.aborted)notifyError(failure,"Conversation could not be restored.");});
    return()=>controller.abort();
  },[authenticated,route.view,route.taskId,aiTasks,threadConversationId]);
  const activeTask = aiTasks.find(item => route.taskId ? item.id === route.taskId : item.plan === routePlan || JSON.stringify(item.plan) === JSON.stringify(routePlan));
  const currentRoutePlan = activeTask?.plan || routePlan;
  const conversationTasks = threadConversationId===activeTask?.conversationId ? threadTaskIds.map(id=>aiTasks.find(item=>item.id===id)).filter((item):item is AiTask=>item!==undefined&&item.plan.generationStatus!=="pending"&&item.plan.generationStatus!=="failed") : activeTask&&activeTask.plan.generationStatus!=="pending"&&activeTask.plan.generationStatus!=="failed"?[activeTask]:[];
  useEffect(()=>{
    if(authenticated!==true||sandbox||route.view!=="task-detail"||!activeTask||activeTask.plan.generationStatus==="pending"||activeTask.plan.generationStatus==="failed"||activeTask.plan.discovery||activeTask.plan.execution||!activeTask.plan.services.some(id=>["store","jobs","stream"].includes(id))||automaticDiscoveryStarted.current.has(activeTask.id))return;
    automaticDiscoveryStarted.current.add(activeTask.id);
    void runDiscovery(activeTask);
  },[authenticated,sandbox,route.view,activeTask?.id,activeTask?.plan.generationStatus,activeTask?.plan.discovery,activeTask?.plan.execution,activeTask?.plan.services]);
  const approveLive = async (taskId:string,actionIds: string[]) => {
    const target=aiTasks.find(item=>item.id===taskId);if(!target)return;
    if (publicAccess) {
      setBusy("live-approval");setError("");
      try {
        const response=await fetch("/api/auth/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({taskId:target.id,approved:true})});
        const payload=await response.json();
        if(!response.ok)throw new Error(payload.message || "Sign in to SMAJ PI HUB to perform protected actions.");
        window.sessionStorage.setItem("smaj_pending_search",target.id);
        window.location.assign(payload.signInUrl);
      } catch(failure) {notifyError(failure,"Sign-in is required for protected actions.");}
      finally {setBusy(null);}
      return;
    }
    setBusy("live-approval"); setError("");
    try {
      const response = await fetch(`/api/tasks/${target.id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approved: true, actionIds, reviewHash: target.plan.actionReviewHash }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.message || "Live approval failed");
      if(route.taskId===target.id)setRoutePlan(payload.plan); setAiTasks(items => items.map(item => item.id === target.id ? payload.task : item));
    } catch (failure) { notifyError(failure,"Live approval failed"); } finally { setBusy(null); }
  };
  const retryLive = async (taskId:string) => {
    const target=aiTasks.find(item=>item.id===taskId);if(!target)return;
    setBusy("live-retry"); setError("");
    try {
      const response = await fetch(`/api/tasks/${target.id}/retry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Safe retry failed");
      if(route.taskId===target.id)setRoutePlan(payload.plan); setAiTasks(items => items.map(item => item.id === target.id ? payload.task : item));
    } catch (failure) { notifyError(failure,"Safe retry failed"); }
    finally { setBusy(null); }
  };
  const refreshActionUpdates=async(taskId:string)=>{
    setBusy(`action-updates-${taskId}`);setError("");
    try{
      const response=await fetch(`/api/tasks/${taskId}/updates`,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
      const payload=await response.json();
      if(!response.ok||!payload.task)throw new Error(payload.message||"Live action updates could not be refreshed.");
      setAiTasks(items=>items.map(item=>item.id===taskId?payload.task:item));
      if(route.taskId===taskId)setRoutePlan(payload.task.plan);
    }catch(failure){notifyError(failure,"Live action updates could not be refreshed.");}
    finally{setBusy(null);}
  };
  const runningConversationTasks=conversationTasks.filter(item=>item.plan.execution&&["queued","running","retrying"].includes(item.plan.execution.status)).map(item=>item.id);
  const runningConversationKey=runningConversationTasks.join(",");
  useEffect(() => {
    if (!runningConversationTasks.length) return;
    const controller = new AbortController();
    let reportedFailure = false;
    const timer = setInterval(async () => {
      try { const results=await Promise.all(runningConversationTasks.map(async id=>{const response=await fetch(`/api/tasks/${id}`,{cache:"no-store",signal:controller.signal});if(!response.ok)throw new Error(`Task status could not be refreshed (${response.status}).`);return (await response.json()).task as AiTask;}));setAiTasks(items=>items.map(item=>results.find(result=>result.id===item.id)||item));const current=results.find(item=>item.id===route.taskId);if(current)setRoutePlan(current.plan); } catch (failure) { if(!controller.signal.aborted&&!reportedFailure){reportedFailure=true;notifyError(failure,"Task status could not be refreshed.");} }
    }, 2500);
    return () => { clearInterval(timer); controller.abort(); };
  }, [runningConversationKey,route.taskId]);
  const deleteAiTask=async(id:string)=>{if(!window.confirm("Delete this task and its AI response?"))return;setBusy(`delete-${id}`);try{const response=await fetch(`/api/tasks/${id}`,{method:"DELETE",signal:AbortSignal.timeout(15000)});if(!response.ok){const payload=await response.json();throw new Error(payload.message||"Task deletion failed");}setAiTasks(items=>items.filter(item=>item.id!==id));setThreadTaskIds(items=>items.filter(taskId=>taskId!==id));if(activeTask?.id===id){setRoutePlan(null);setTask("");if(viewHistory.current.at(-1)==="tasks")viewHistory.current.pop();updateRoute({view:"tasks"},true);}}catch(failure){notifyError(failure,"Task deletion failed");}finally{setBusy(null);}};
  const deleteDelegation=async(id:string)=>{if(!window.confirm("Delete this task, its drafts, and local proof receipt?"))return;setBusy(`delete-${id}`);try{const response=await fetch(`/api/delegations/${id}`,{method:"DELETE",signal:AbortSignal.timeout(15000)});if(!response.ok){const payload=await response.json();throw new Error(payload.message||"Task deletion failed");}streamRef.current?.close();setHistory(items=>items.filter(item=>item.id!==id));if(delegation?.id===id){setDelegation(null);if(viewHistory.current.at(-1)==="tasks")viewHistory.current.pop();updateRoute({view:"tasks"},true);}}catch(failure){notifyError(failure,"Task deletion failed");}finally{setBusy(null);}};
  const setConnection=async(serviceId:ServiceId,connected:boolean)=>{setBusy(`connection-${serviceId}`);setError("");try{const response=await fetch("/api/connections",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({serviceId,connected})});const payload=await response.json() as ApiResponse;if(!response.ok||!payload.connections)throw new Error(payload.message||"Connection could not be updated");setConnections(payload.connections);}catch(failure){notifyError(failure,"Connection failed safely");}finally{setBusy(null);}};
  const watch=(id:string)=>{streamRef.current?.close();const source=new EventSource(`/api/delegations/${id}/events`);source.addEventListener("delegation",event=>{try{const next=JSON.parse((event as MessageEvent).data) as DelegationView;updateDelegation(next);if(["verified","failed"].includes(next.status))source.close();}catch(failure){source.close();notifyError(failure,"Task updates could not be read.");}});source.onerror=()=>{source.close();notifyError(new Error("Task update stream disconnected."),"Task updates could not be received.");};streamRef.current=source;};
  const request=async(url:string,body:Record<string,unknown>,action:string)=>{setBusy(action);setError("");try{const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":`ui_${crypto.randomUUID()}`},body:JSON.stringify(body)});const payload=await response.json() as ApiResponse;if(!response.ok||!payload.delegation)throw new Error(payload.message||"Workflow request failed");updateDelegation(payload.delegation);return payload.delegation;}catch(failure){notifyError(failure,"Workflow stopped safely");return null;}finally{setBusy(null);}};
  const createJobsPlan=async()=>{const created=await request("/api/delegations",{goal:task,candidateName,skills:skills.split(",").map(value=>value.trim()).filter(Boolean),maxApplications:3},"planning");if(created){setSelectedJobs(created.selectedJobIds);setDelegation(created);}};
  const approve=()=>delegation&&request(`/api/delegations/${delegation.id}/approve`,{selectedJobIds:selectedJobs},"approving"); const execute=()=>{if(!delegation)return;watch(delegation.id);return request(`/api/delegations/${delegation.id}/execute`,{injectTransientFailure:injectFailure},"executing");};
  const openTask=(item:DelegationView)=>{setRoutePlan(null);setTask(item.goal);setDelegation(item);setSelectedJobs(item.selectedJobIds);navigate("task-detail",{delegationId:item.id});if(["executing","retrying","verifying"].includes(item.status))watch(item.id);};
  const downloadReceipt=(format: "json" | "pdf" = "json")=>{if(!delegation?.receipt)return;downloadReceiptFile(delegation.receipt,format,`smaj-proof-${delegation.id}.${format}`);};
  if(busy==="demo")return <DemoLoading/>;
  if(authenticated===null)return <main className="workspace" aria-busy="true"><div className="workspaceBody"><p role="status">Checking secure session…</p></div></main>;
  if(authenticated!==true)return <><LandingPage demoEnabled={demoEnabled} startDemo={startDemo} authenticated={authenticated} ssoEnabled={ssoEnabled} accessToken={accessToken} setAccessToken={setAccessToken} busy={busy} login={login}/><ErrorToast message={error} dismiss={()=>setError("")}/></>;
  const connectedIds=new Set(connections.filter(item=>item.connected).map(item=>item.serviceId)); const pending=history.filter(item=>item.status==="awaiting_approval"); const receipts=history.filter(item=>item.receipt);
  const pageTitle: Record<Exclude<View, "home">, string> = { tasks:"All Tasks", "task-detail":"Results", services:"Connect Apps", approvals:"Approvals", receipts:"Results", profile:"Settings" };
  return <><main className="workspace">
    {view==="home"&&<header className="workspaceHeader">
      <div className="headerSide"><button className="iconButton" onClick={()=>setMenuOpen(true)} aria-label="Open menu"><Icon name="menu"/></button><button className="headerBrand" onClick={()=>navigate("home")}><BrandLogo/><div><strong>SMAJ AI</strong><small>VERIFIED DELEGATION</small></div></button></div>
      <div className="headerSide"><button className="headerNav" onClick={()=>navigate("tasks")} aria-label="Tasks"><Icon name="tasks"/><span>Tasks</span></button><button className="headerNav" onClick={()=>navigate("services")} aria-label="Apps"><Icon name="apps"/><span>Apps</span></button></div>
    </header>}
    {view!=="home"&&<header className="internalNav">
      <button type="button" className="internalBack" onClick={goBack} aria-label="Go back"><Icon name="back"/></button>
      <h1>{pageTitle[view]}</h1>
      {view==="task-detail"&&<ResultsVoiceMenu text={conversationTasks.at(-1)?.plan.summary||currentRoutePlan?.summary||""}/>}
    </header>}
    <div className={`menuOverlay ${menuOpen?"show":""}`} onClick={()=>setMenuOpen(false)}/>
    <aside className={`drawer ${menuOpen?"show":""}`}>
      <div className="drawerHead"><button className="headerBrand" onClick={()=>navigate("home")}><BrandLogo/><div><strong>SMAJ AI</strong><small>CONNECTED WORKSPACE</small></div></button><button className="iconButton" onClick={()=>setMenuOpen(false)}><Icon name="close"/></button></div>
      <nav><DrawerItem icon="home" label="Ask AI" active={view==="home"} onClick={()=>navigate("home")}/><DrawerItem icon="tasks" label="All Tasks" active={view==="tasks"} onClick={()=>navigate("tasks")}/><div className="drawerDivider"/><DrawerItem icon="profile" label="Profile & Settings" active={view==="profile"} onClick={()=>navigate("profile")}/></nav>
    </aside>
    <section className={`workspaceBody ${view==="services"?servicesStyles.body:""} ${view==="home"?"homeBody":"internalBody"}`}>
      {sampleTasksEnabled&&sandbox&&<div className="demoNotice" role="status"><strong>Hackathon Demo</strong><span>Sample data. Simulated actions. Expires {expiresAt?time(new Date(expiresAt).toISOString()):"in one hour"}.</span><button className="secondaryButton" onClick={()=>navigate("tasks")}>Sample tasks</button><button className="secondaryButton" onClick={logout}>Exit demo</button></div>}
      {view==="home"&&<HomeWorkspace task={task} setTask={setTask} selectedService={selectedService} selectService={setSelectedService} routeTask={routeTask} busy={busy} connectedIds={connectedIds} image={homeImage} setImage={setHomeImage}/>}
      {view==="services"&&<Services connections={connections} setConnection={setConnection} busy={busy}/>}
      {view==="tasks"&&<TaskHistory tasks={aiTasks} delegations={sampleTasksEnabled?history:[]} busy={busy} openAiTask={saved=>{setDelegation(null);setTask(saved.task);setRoutePlan(saved.plan);navigate("task-detail",{taskId:saved.id});}} deleteAiTask={deleteAiTask} openDelegation={openTask} deleteDelegation={deleteDelegation}/>}
      {view==="task-detail"&&<Tasks messages={conversationTasks} messageImages={messageImages} pendingMessage={pendingMessage&&(!pendingMessage.persistedConversation?!route.taskId:(activeTask?.conversationId||activeTask?.id)===pendingMessage.conversationId)?pendingMessage:null} retryPendingMessage={retryPendingMessage} routePlan={currentRoutePlan} task={task} busy={busy} conversationId={activeTask?.conversationId||activeTask?.id||(!pendingMessage?.persistedConversation?pendingMessage?.conversationId:undefined)} onFollowUp={(message:string,id:string,retry?:PendingMessage,image?:{mimeType:string;data:string})=>submitTask(message,id,retry,image)} approveLive={approveLive} retryLive={retryLive} refreshActionUpdates={refreshActionUpdates} sandbox={sandbox} reportError={(message:string)=>notifyError(message,"The task reported an error.")} delegation={sampleTasksEnabled?delegation:null} jobsById={jobsById} selectedJobs={selectedJobs} setSelectedJobs={setSelectedJobs} approve={approve} execute={execute} injectFailure={injectFailure} setInjectFailure={setInjectFailure} downloadReceipt={downloadReceipt} deleteDelegation={deleteDelegation}/>}
      {view==="approvals"&&aiTasks.filter(t=>t.plan.proposedActions?.length&&!t.plan.execution).map(t=><button className="secondaryButton" key={t.id} onClick={()=>{setTask(t.task);setRoutePlan(t.plan);navigate("task-detail",{taskId:t.id});}}>Review live actions: {t.task}</button>)}
      {view==="approvals"&&<Approvals items={pending} openTask={openTask}/>}
      {view==="receipts"&&aiTasks.filter(t=>t.plan.execution?.receipt).map(t=><button className="secondaryButton" key={t.id} onClick={()=>{setTask(t.task);setRoutePlan(t.plan);navigate("task-detail",{taskId:t.id});}}>Live verified receipt: {t.task}</button>)}
      {view==="receipts"&&<Receipts items={receipts} openTask={openTask}/>}
      {view==="profile"&&<Profile connectedCount={connectedIds.size} taskCount={history.length} navigate={navigate} logout={logout}/>}
    </section>
  </main><ErrorToast message={error} dismiss={()=>setError("")}/></>;
}

function ErrorToast({message,dismiss}:{message:string;dismiss:()=>void}){return message?<div className="errorToast" role="alert" aria-live="assertive"><span>{message}</span><button type="button" aria-label="Dismiss error notification" onClick={dismiss}>×</button></div>:null;}

function DrawerItem({icon,label,badge,active,onClick}:{icon:string;label:string;badge?:number;active:boolean;onClick:()=>void}){return <button className={active?"active":""} onClick={onClick}><Icon name={icon}/><span>{label}</span>{badge!==undefined&&badge>0&&<b>{badge}</b>}</button>}


export function Tasks(props:any){
  const resultsScrollArea=useRef<HTMLDivElement|null>(null);
  const messageKey=[...(props.messages as AiTask[]).map(item=>item.id),props.pendingMessage?.id||""].join(",");
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>{const area=resultsScrollArea.current;if(area)area.scrollTo({top:area.scrollHeight,behavior:"smooth"});});
    return()=>cancelAnimationFrame(frame);
  },[messageKey]);
  return <section className={`tasksView compactResults${props.conversationId||props.pendingMessage?" hasChatComposer":""}`} data-results-design="approved-compact-v2">
    <div className="resultsConversation" ref={resultsScrollArea} aria-label="Results conversation">
    {(props.messages?.length>0||props.pendingMessage)&&<div className="chatThread" aria-label="Conversation messages">
      {(props.messages||[]).map((message:AiTask)=><article className="chatTurn" key={message.id}>
        <div className="chatUserMessage">{message.task}{props.messageImages?.[message.id]&&<span className="chatImagePreview"><img src={`data:${props.messageImages[message.id].mimeType};base64,${props.messageImages[message.id].data}`} alt="Attached image"/></span>}{message.task.includes("[Image attached for this turn; image is not saved in conversation history.]")&&<small className="chatAttachmentNote">Image used for this message only; it is not saved in history.</small>}</div>
        <section className={`chatAssistantMessage${props.pendingMessage?.id===message.id&&!message.plan.summary?" chatTyping":""}`}>{props.pendingMessage?.id===message.id&&!message.plan.summary
          ? <><BrandLogo className="resultsAvatar resultsAvatarLogo"/><span className="taskDots" role="status" aria-label="SMAJ AI is responding"><i/><i/><i/></span></>
          : <><BrandLogo className="resultsAvatar resultsAvatarLogo"/><div className="resultsContent"><TypedResponse text={message.plan.summary}/>
            <LiveTaskResult key={message.id} task={message} busy={Boolean(props.busy)} sandbox={props.sandbox} approve={props.approveLive} retry={props.retryLive} refreshActionUpdates={props.refreshActionUpdates} reportError={props.reportError}/>
          </div></>}</section>
      </article>)}
      {props.pendingMessage&&!props.messages.some((message:AiTask)=>message.id===props.pendingMessage.id)&&<article className="chatTurn" key={props.pendingMessage.id}>
        <div className="chatUserMessage">{props.pendingMessage.text}{props.pendingMessage.image&&<span className="chatImagePreview"><img src={`data:${props.pendingMessage.image.mimeType};base64,${props.pendingMessage.image.data}`} alt="Attached image"/></span>}</div>
        {props.pendingMessage.status==="sending"
          ? <section className="chatAssistantMessage chatTyping" role="status" aria-label="SMAJ AI is responding"><BrandLogo className="resultsAvatar resultsAvatarLogo"/><span className="taskDots" aria-hidden="true"><i/><i/><i/></span></section>
          : <div className="chatFailure" role="alert"><span>{props.pendingMessage.error||"SMAJ AI could not answer. Please try again."}</span><button type="button" disabled={Boolean(props.busy)} onClick={props.retryPendingMessage}>Retry</button></div>}
      </article>}
    </div>}
    {!props.messages?.length&&!props.pendingMessage&&props.task&&props.routePlan&&<div className="taskRequest">{props.task}</div>}
    {!props.messages?.length&&!props.pendingMessage&&(props.routePlan||props.busy)&&<section className="resultsResponse"><BrandLogo className="resultsAvatar resultsAvatarLogo"/><div className="resultsContent">
      {props.routePlan?.summary?<TypedResponse text={props.routePlan.summary}/>:props.busy&&<span className="taskDots taskDotsInline" role="status" aria-label="SMAJ AI is responding"><i/><i/><i/></span>}
    </div></section>}
    {props.delegation&&<DelegationDetail {...props}/>}
    </div>
    {props.conversationId&&<ChatComposer key={props.conversationId} busy={Boolean(props.busy)||Boolean(props.pendingMessage)} onSubmit={(message:string,image?:{mimeType:string;data:string})=>props.onFollowUp(message,props.conversationId,undefined,image)}/>}
  </section>;
}

type SpeechRecognitionLike = {
  lang:string; continuous:boolean; interimResults:boolean;
  start:()=>void; stop:()=>void;
  onresult:((event:Event & {results:ArrayLike<ArrayLike<{transcript:string;isFinal?:boolean}>>})=>void)|null;
  onerror:((event:Event & {error:string})=>void)|null;
  onend:(()=>void)|null;
};
type SpeechWindow = Window & {SpeechRecognition?:new()=>SpeechRecognitionLike;webkitSpeechRecognition?:new()=>SpeechRecognitionLike};

function ChatComposer({busy,onSubmit}:{busy:boolean;onSubmit:(message:string,image?:{mimeType:string;data:string})=>Promise<boolean>}){
  const [message,setMessage]=useState("");
  const [sending,setSending]=useState(false);
  const [image,setImage]=useState<{mimeType:"image/jpeg"|"image/png"|"image/webp";data:string}|null>(null);
  const [attachmentMenuOpen,setAttachmentMenuOpen]=useState(false);
  const [mediaState,setMediaState]=useState("");
  const [mediaError,setMediaError]=useState("");
  const galleryRef=useRef<HTMLInputElement>(null);
  const cameraRef=useRef<HTMLInputElement>(null);
  const attachmentMenuRef=useRef<HTMLDivElement>(null);
  const recognitionRef=useRef<SpeechRecognitionLike|null>(null);
  const submit=async(event?:React.FormEvent,spokenText?:string)=>{event?.preventDefault();const submitted=(spokenText??message).trim();if((!submitted&&!image)||busy||sending)return;const prompt=submitted||"Describe this image and suggest relevant SMAJ Store search terms.";setMessage("");setSending(true);setMediaError("");setMediaState(image?"Uploading image and processing with SMAJ AI…":"Sending to SMAJ AI…");try{await onSubmit(prompt,image?{mimeType:image.mimeType,data:image.data}:undefined);setImage(null);setMediaState("");}finally{setSending(false);if(!spokenText)setMediaState("");}};
  const selectImage=(file?:File)=>{setAttachmentMenuOpen(false);setMediaError("");if(!file)return;if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setMediaError("Choose a JPEG, PNG, or WebP image.");return;}if(file.size>4*1024*1024){setMediaError("Images must be smaller than 4 MB.");return;}setMediaState("Preparing image…");const reader=new FileReader();reader.onerror=()=>{setMediaState("");setMediaError("The image could not be read. Try another file.");};reader.onload=()=>{if(typeof reader.result!=="string"){setMediaState("");setMediaError("The image could not be read. Try another file.");return;}setImage({mimeType:file.type as "image/jpeg"|"image/png"|"image/webp",data:reader.result.split(",",2)[1]||""});setMediaState("");};reader.readAsDataURL(file);};
  const startVoice=()=>{setMediaError("");const SpeechRecognition=(window as SpeechWindow).SpeechRecognition||(window as SpeechWindow).webkitSpeechRecognition;if(!SpeechRecognition){setMediaError("Voice input is not supported in this browser. You can type your message instead.");return;}try{let transcript="";let failed=false;const recognition=new SpeechRecognition();recognition.lang=navigator.language||"en-US";recognition.continuous=false;recognition.interimResults=true;recognition.onresult=event=>{transcript=Array.from(event.results).map(result=>result[0]?.transcript||"").join("").trim();setMessage(transcript);};recognition.onerror=event=>{failed=true;setMediaState("");setMediaError(event.error==="not-allowed"||event.error==="service-not-allowed"?"Microphone permission was denied. Allow microphone access or type your message.":"Voice recognition failed. Please try again or type your message.");};recognition.onend=()=>{recognitionRef.current=null;if(failed)return;if(!transcript){setMediaState("");return;}setMediaState("Transcription ready — sending…");void submit(undefined,transcript);};recognitionRef.current=recognition;setMediaState("Listening…");recognition.start();}catch{setMediaState("");setMediaError("The microphone could not be started. Check browser permissions.");}};
  useEffect(()=>()=>{recognitionRef.current?.stop();},[]);
  useEffect(()=>{
    if(!attachmentMenuOpen)return;
    const closeOnOutsideClick=(event:PointerEvent)=>{if(!attachmentMenuRef.current?.contains(event.target as Node))setAttachmentMenuOpen(false);};
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==="Escape")setAttachmentMenuOpen(false);};
    document.addEventListener("pointerdown",closeOnOutsideClick);
    document.addEventListener("keydown",closeOnEscape);
    return()=>{document.removeEventListener("pointerdown",closeOnOutsideClick);document.removeEventListener("keydown",closeOnEscape);};
  },[attachmentMenuOpen]);
  return <form className="chatComposer" onSubmit={event=>void submit(event)}>
    <label className="taskSrOnly" htmlFor="ai-chat-message">Message SMAJ AI</label>
    {image&&<div className="chatComposerImage"><img src={`data:${image.mimeType};base64,${image.data}`} alt="Attached image preview"/><button type="button" aria-label="Remove attached image" onClick={()=>setImage(null)}>×</button></div>}
    <div className="chatComposerInputRow">
      <div className="chatAttachmentMenuWrap" ref={attachmentMenuRef}>
        <input ref={galleryRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{selectImage(event.target.files?.[0]);event.target.value="";}}/>
        <input ref={cameraRef} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event=>{selectImage(event.target.files?.[0]);event.target.value="";}}/>
        <button className="chatAttachButton" type="button" aria-label="Add an attachment" aria-expanded={attachmentMenuOpen} aria-haspopup="menu" disabled={busy||sending} onClick={()=>setAttachmentMenuOpen(open=>!open)}>+</button>
        {attachmentMenuOpen&&<div className="chatAttachmentMenu" role="menu" aria-label="Add an attachment">
          <button type="button" role="menuitem" onClick={()=>{setAttachmentMenuOpen(false);galleryRef.current?.click();}}>Upload image</button>
          <button type="button" role="menuitem" onClick={()=>{setAttachmentMenuOpen(false);cameraRef.current?.click();}}>Camera</button>
          <button type="button" role="menuitem" onClick={()=>{setAttachmentMenuOpen(false);startVoice();}}>Microphone</button>
        </div>}
      </div>
      <textarea id="ai-chat-message" value={message} onChange={event=>setMessage(event.target.value)} onInput={event=>{event.currentTarget.style.height="auto";event.currentTarget.style.height=`${Math.min(event.currentTarget.scrollHeight,120)}px`;}} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();event.currentTarget.form?.requestSubmit();}}} maxLength={2000} rows={1} placeholder="Message SMAJ AI"/>
      <div className="chatComposerActions">
        <button className="chatSendButton" type="submit" aria-label="Send message" disabled={busy||sending||(!message.trim()&&!image)}>{busy||sending?<span aria-hidden="true">…</span>:<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>}</button>
      </div>
    </div>
    {(mediaState||mediaError)&&<p className={`chatMediaStatus${mediaError?" isError":""}`} role={mediaError?"alert":"status"}>{mediaError||mediaState}</p>}
  </form>;
}

function ResultsVoiceMenu({text}:{text:string}) {
  const [mounted,setMounted]=useState(false);
  const [state,setState]=useState<"idle"|"speaking"|"paused">("idle");
  const [muted,setMuted]=useState(false);
  const [open,setOpen]=useState(false);
  const menuRef=useRef<HTMLDivElement>(null);
  const utterance=useRef<SpeechSynthesisUtterance|null>(null);
  useEffect(()=>setMounted(true),[]);
  const stop=()=>{window.speechSynthesis?.cancel();utterance.current=null;setState("idle");};
  useEffect(()=>{if(!open)return;const closeOnOutsideClick=(event:PointerEvent)=>{if(!menuRef.current?.contains(event.target as Node))setOpen(false);};const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};document.addEventListener("pointerdown",closeOnOutsideClick);document.addEventListener("keydown",closeOnEscape);return()=>{document.removeEventListener("pointerdown",closeOnOutsideClick);document.removeEventListener("keydown",closeOnEscape);};},[open]);
  useEffect(()=>()=>{window.speechSynthesis?.cancel();},[]);
  useEffect(()=>{stop();},[text]);
  const play=()=>{if(!text||!mounted||!("speechSynthesis" in window))return;if(state==="paused"){window.speechSynthesis.resume();setState("speaking");return;}stop();const next=new SpeechSynthesisUtterance(text);next.volume=muted?0:1;next.onend=()=>setState("idle");next.onerror=()=>setState("idle");utterance.current=next;window.speechSynthesis.speak(next);setState("speaking");setOpen(false);};
  const toggleMute=()=>{const nextMuted=!muted;setMuted(nextMuted);if(utterance.current)utterance.current.volume=nextMuted?0:1;setOpen(false);};
  const supported=mounted&&"speechSynthesis" in window;
  return <div className="resultsVoiceMenuWrap" ref={menuRef}>
    <button type="button" className="resultsVoiceMenuButton" aria-label="Voice options" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>⋮</button>
    {open&&<div className="resultsVoiceMenu" role="menu" aria-label="Voice controls">
      <button type="button" role="menuitem" disabled={!supported||!text} onClick={play}>Play Voice</button>
      <button type="button" role="menuitem" disabled={!supported||state!=="speaking"} onClick={()=>{window.speechSynthesis.pause();setState("paused");setOpen(false);}}>Pause</button>
      <button type="button" role="menuitem" disabled={!supported||state==="idle"} onClick={()=>{stop();setOpen(false);}}>Stop</button>
      <button type="button" role="menuitem" disabled={!supported} onClick={toggleMute}>{muted?"Unmute":"Mute"}</button>
    </div>}
  </div>;
}

function Approvals({items,openTask}:{items:DelegationView[];openTask:(item:DelegationView)=>void}){return <Page subtitle="Nothing sensitive happens without your permission."><div className="approvalList">{items.map(item=><article key={item.id}><span><Icon name="shield"/></span><div><strong>{item.goal}</strong><p>{item.plan.recommendations.length} mock Jobs actions are waiting for review.</p><small>No production submission or Pi payment will occur.</small></div><button className="primaryButton" onClick={()=>openTask(item)}>Review request</button></article>)}{items.length===0&&<Empty text="No pending approvals."/>}</div></Page>}
function Receipts({items,openTask}:{items:DelegationView[];openTask:(item:DelegationView)=>void}){return <Page subtitle="Verified outcomes appear only after approved tasks complete."><div className="receiptList">{items.map(item=><button key={item.id} onClick={()=>openTask(item)}><span><Icon name="approve"/></span><div><small>VERIFIED RESULT</small><strong>{item.goal}</strong><code>{item.receipt?.proofHash.slice(0,32)}…</code></div><Icon name="arrow"/></button>)}{items.length===0&&<Empty text="No verified receipts yet."/>}</div></Page>}
function Profile({connectedCount,taskCount,navigate,logout}:{connectedCount:number;taskCount:number;navigate:(view:View)=>void;logout:()=>void}){return <Page subtitle="Manage your connections and protected demo session."><section className="profileCard"><div className="profileAvatar">S</div><div><h2>Demo profile</h2><p>{connectedCount} connected app · {taskCount} persistent tasks</p></div><button className="primaryButton" onClick={()=>navigate("services")}>Manage connections</button><button className="secondaryButton" onClick={logout}>Sign out</button></section><UserPreferences/></Page>}

function UserPreferences(){
  const [values,setValues]=useState<string[]>([]);const [draft,setDraft]=useState("");const [status,setStatus]=useState("");const [busy,setBusy]=useState(false);
  useEffect(()=>{const controller=new AbortController();void fetch("/api/preferences",{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.message||"Preferences could not be loaded.");const next=Array.isArray(data.preferences)?data.preferences.filter((item:unknown):item is string=>typeof item==="string"):[];setValues(next);setDraft(next.join("\n"));}).catch(failure=>{if(!controller.signal.aborted)setStatus(failure instanceof Error?failure.message:"Preferences could not be loaded.");});return()=>controller.abort();},[]);
  const save=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setStatus("");try{const preferences=draft.split("\n").map(item=>item.trim()).filter(Boolean);const response=await fetch("/api/preferences",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({preferences})});const data=await response.json();if(!response.ok)throw new Error(data.message||"Preferences could not be saved.");setValues(data.preferences);setDraft(data.preferences.join("\n"));setStatus("Preferences saved.");}catch(failure){setStatus(failure instanceof Error?failure.message:"Preferences could not be saved.");}finally{setBusy(false);}};
  return <form className="aiPreferences" onSubmit={save}><h2>AI preferences</h2><p>Save up to 10 preferences to personalize recommendations. Do not include passwords, payment details, or sensitive personal information.</p><label htmlFor="ai-preferences">One preference per line</label><textarea id="ai-preferences" value={draft} maxLength={1210} rows={5} onChange={event=>setDraft(event.target.value)} placeholder="Remote work&#10;Prefer Pi-denominated prices"/><small>{values.length}/10 saved</small><button className="primaryButton" type="submit" disabled={busy}>{busy?"Saving…":"Save preferences"}</button>{status&&<p role="status">{status}</p>}</form>;
}
function Page({subtitle,children,className=""}:{subtitle:string;children:React.ReactNode;className?:string}){return <section className={`pageView ${className}`}><p className="pageSub">{subtitle}</p>{children}</section>}
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
