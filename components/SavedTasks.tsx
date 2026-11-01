"use client";
import type { AiTask } from "@/src/server/ai-tasks";

export default function SavedTasks({ tasks, open, remove, busy }: { tasks: AiTask[]; open: (task: AiTask) => void; remove: (id: string) => void; busy: string | null }) {
  if (!tasks.length) return null;
  return <section aria-label="Your AI tasks"><h2>Your AI tasks</h2><div className="taskList">{tasks.map(task => <article key={task.id} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}><button className="secondaryButton" style={{ flex: 1, minWidth: 0, textAlign: "left", overflowWrap: "anywhere" }} onClick={() => open(task)}><strong>{task.task}</strong><br/><small>{new Date(task.createdAt).toLocaleString()}</small></button><button className="secondaryButton" disabled={busy === `delete-${task.id}`} onClick={() => remove(task.id)} aria-label={`Delete task: ${task.task}`}>{busy === `delete-${task.id}` ? "Deleting…" : "Delete"}</button></article>)}</div></section>;
}
