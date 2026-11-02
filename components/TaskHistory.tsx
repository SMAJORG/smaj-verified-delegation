"use client";

import { useMemo, useState } from "react";
import type { AiTask } from "@/src/server/ai-tasks";
import type { DelegationView } from "@/src/domain/types";
import { SMAJ_SERVICES, type ServiceId } from "@/src/domain/services";
import { matchesTaskHistoryFilter } from "@/components/task-history-filter";

type HistoryEntry =
  | { kind: "ai"; id: string; title: string; createdAt: string; status: string; open: () => void; remove: () => void; deleting: boolean }
  | { kind: "delegation"; id: string; title: string; createdAt: string; status: string; open: () => void; remove: () => void; deleting: boolean };

const statusLabels: Record<string, string> = {
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  queued: "Queued",
  running: "Working",
  executing: "Executing",
  retrying: "Recovering",
  verifying: "Verifying",
  verified: "Verified",
  failed: "Needs attention",
  new: "New",
  results: "Results ready",
};

function aiTaskStatus(task: AiTask) {
  const execution = task.plan.execution?.status;
  if (execution) return execution;
  if (task.plan.proposedActions?.length) return "awaiting_approval";
  return task.plan.discovery ? "results" : "new";
}

function dateGroup(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const daysAgo = Math.round((todayStart - day) / 86_400_000);
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo >= 2 && daysAgo < 7) return "Previous 7 days";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function taskTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function TaskHistory({
  tasks, delegations, busy, openAiTask, deleteAiTask, openDelegation, deleteDelegation,
}: {
  tasks: AiTask[];
  delegations: DelegationView[];
  busy: string | null;
  openAiTask: (task: AiTask) => void;
  deleteAiTask: (id: string) => void;
  openDelegation: (task: DelegationView) => void;
  deleteDelegation: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [service, setService] = useState<ServiceId | "all">("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const groups = useMemo(() => {
    const entries: HistoryEntry[] = [
      ...tasks.map(task => ({
        kind: "ai" as const,
        id: task.id,
        title: task.task,
        createdAt: task.createdAt,
        status: aiTaskStatus(task),
        open: () => openAiTask(task),
        remove: () => deleteAiTask(task.id),
        deleting: busy === `delete-${task.id}`,
      })),
      ...delegations.map(task => ({
        kind: "delegation" as const,
        id: task.id,
        title: task.goal,
        createdAt: task.createdAt,
        status: task.status,
        open: () => openDelegation(task),
        remove: () => deleteDelegation(task.id),
        deleting: busy === `delete-${task.id}`,
      })),
    ].filter(entry => {
      const task = entry.kind === "ai" ? tasks.find(item => item.id === entry.id) : delegations.find(item => item.id === entry.id);
      return task !== undefined && matchesTaskHistoryFilter(task, query, service);
    }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const grouped = new Map<string, HistoryEntry[]>();
    for (const entry of entries) {
      const label = dateGroup(entry.createdAt);
      grouped.set(label, [...(grouped.get(label) || []), entry]);
    }
    return [...grouped.entries()];
  }, [tasks, delegations, busy, query, service, openAiTask, deleteAiTask, openDelegation, deleteDelegation]);

  return <section className="taskHistoryPage">
    <div className="taskHistoryFilters">
      <div className="taskHistoryToolbar">
        <div className="taskHistorySearchRow">
          <label className="taskHistorySearch">
            <span className="taskHistorySrOnly">Search saved tasks</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
            <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search conversations and tasks" />
          </label>
          <button type="button" className={`taskHistoryFilterButton${service !== "all" ? " active" : ""}`} aria-label="Filter by service" aria-expanded={filterOpen} aria-controls="task-history-service-filter" onClick={() => setFilterOpen(open => !open)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16l-6.2 7.1v5.2l-3.6 1.8v-7z"/></svg>
          </button>
        </div>
        {filterOpen && <div className="taskHistoryServiceMenu" id="task-history-service-filter" role="group" aria-label="Filter saved conversations by service">
          {SMAJ_SERVICES.map(item => <button type="button" key={item.id} className={service === item.id ? "selected" : ""} aria-pressed={service === item.id} onClick={() => { setService(item.id); setFilterOpen(false); }}>{item.shortName}</button>)}
          <button type="button" className="taskHistoryClearFilter" onClick={() => { setService("all"); setFilterOpen(false); }}>Clear filter</button>
        </div>}
      </div>
    </div>
    <p className="taskHistoryIntro">Open a saved request to review its conversation, results, approvals, and status.</p>
    {!tasks.length && !delegations.length ? <p className="taskHistoryEmpty">Your saved tasks will appear here.</p> : <div className="taskHistoryGroups">
      {!groups.length ? <p className="taskHistoryEmpty">No tasks match your search{service !== "all" ? " and service filter" : ""}.</p> : groups.map(([label, entries]) => <section className="taskHistoryGroup" key={label} aria-label={label}>
        <h2>{label}</h2>
        <div className="taskHistoryRows">{entries.map(entry => {
        const menuId = `${entry.kind}:${entry.id}`;
        return <article className="taskHistoryRow" key={menuId}>
          <button type="button" className="taskHistoryOpen" onClick={entry.open}>
            <span className="taskHistoryTitle">{entry.title}</span>
            <span className="taskHistoryMeta">{taskTimestamp(entry.createdAt)} · {entry.kind === "ai" ? "SMAJ AI" : "Jobs"}</span>
          </button>
          <span className={`taskHistoryStatus status-${entry.status}`}>{statusLabels[entry.status] || entry.status}</span>
          <details className="taskHistoryMenu">
            <summary aria-label={`More actions for ${entry.title}`}><span aria-hidden="true">···</span></summary>
            <div className="taskHistoryMenuPopover">
              <button type="button" disabled={entry.deleting} onClick={entry.remove}>
                {entry.deleting ? "Deleting…" : "Delete task"}
              </button>
            </div>
          </details>
        </article>;
        })}</div>
      </section>)}
    </div>}
  </section>;
}
