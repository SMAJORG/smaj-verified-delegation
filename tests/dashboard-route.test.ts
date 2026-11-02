import assert from "node:assert/strict";
import test from "node:test";
import { dashboardRouteUrl, parseDashboardRoute } from "@/src/domain/dashboard-route";

test("dashboard URLs restore supported pages and saved conversation IDs", () => {
  for (const view of ["tasks", "services", "profile", "approvals", "receipts"] as const) {
    assert.deepEqual(parseDashboardRoute(`?view=${view}`), { view });
    assert.equal(dashboardRouteUrl("https://smaj.example/", { view }), `/?view=${view}`);
  }
  assert.deepEqual(parseDashboardRoute("?view=task-detail&task=task-42"), { view: "task-detail", taskId: "task-42" });
  assert.deepEqual(parseDashboardRoute("?delegation=job-42"), { view: "task-detail", delegationId: "job-42" });
  assert.equal(dashboardRouteUrl("https://smaj.example/?sso=failed&resumeSearch=1", { view: "task-detail", taskId: "task-42" }), "/?view=task-detail&task=task-42");
  assert.deepEqual(parseDashboardRoute("?view=unknown"), { view: "home" });
});
