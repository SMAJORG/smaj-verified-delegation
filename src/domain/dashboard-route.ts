export type DashboardView = "home" | "tasks" | "task-detail" | "services" | "approvals" | "receipts" | "profile";
export type DashboardRoute = { view: DashboardView; taskId?: string; delegationId?: string };

const views = new Set<DashboardView>(["home", "tasks", "task-detail", "services", "approvals", "receipts", "profile"]);

export function parseDashboardRoute(search: string): DashboardRoute {
  const params = new URLSearchParams(search);
  const taskId = params.get("task") || undefined;
  const delegationId = params.get("delegation") || undefined;
  const requested = params.get("view");
  if (taskId) return { view: "task-detail", taskId };
  if (delegationId) return { view: "task-detail", delegationId };
  return { view: requested && views.has(requested as DashboardView) ? requested as DashboardView : "home" };
}

export function dashboardRouteUrl(currentUrl: string, route: DashboardRoute): string {
  const url = new URL(currentUrl);
  for (const key of ["view", "task", "delegation", "resumeSearch", "sso"]) url.searchParams.delete(key);
  if (route.view !== "home") url.searchParams.set("view", route.view);
  if (route.view === "task-detail" && route.taskId) url.searchParams.set("task", route.taskId);
  if (route.view === "task-detail" && route.delegationId) url.searchParams.set("delegation", route.delegationId);
  return `${url.pathname}${url.search}${url.hash}`;
}
