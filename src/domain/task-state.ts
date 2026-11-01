import type { ServiceRoutePlan } from "./services";
export const TASK_PHASES = ["Analyzing", "Planning", "Awaiting Approval", "Executing", "Verifying", "Completed"] as const;
export function taskState(plan: ServiceRoutePlan): string {
  if (plan.execution) {
    const statuses: Record<string, string> = { queued: "Queued", running: "Executing", verifying: "Verifying", retrying: "Retrying", verified: plan.execution.receipt ? "Completed" : "Verifying", failed: "Failed" };
    return statuses[plan.execution.status] || "Unavailable";
  }
  if (plan.searchCancelledAt && !plan.execution) return "Cancelled";
  if (plan.summaryError) return "Failed";
  if (!plan.ai) return "Unavailable";
  if (plan.proposedActions?.length || (plan.steps.length && !plan.discovery)) return "Awaiting Approval";
  return "Completed";
}
