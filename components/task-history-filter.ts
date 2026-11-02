import type { AiTask } from "@/src/server/ai-tasks";
import type { DelegationView } from "@/src/domain/types";
import type { ServiceId } from "@/src/domain/services";

export function matchesTaskHistoryFilter(task: AiTask | DelegationView, query: string, service: ServiceId | "all"): boolean {
  const taskServices: ServiceId[] = "goal" in task
    ? ["jobs"]
    : [...new Set([...task.plan.services, ...task.plan.steps.map(step => step.serviceId)])];
  if (service !== "all" && !taskServices.includes(service)) return false;

  const keywords = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!keywords.length) return true;
  const searchableText = JSON.stringify(task).toLocaleLowerCase();
  return keywords.every(keyword => searchableText.includes(keyword));
}
