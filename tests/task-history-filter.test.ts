import assert from "node:assert/strict";
import test from "node:test";
import { matchesTaskHistoryFilter } from "@/components/task-history-filter";
import { SMAJ_SERVICES } from "@/src/domain/services";
import type { AiTask } from "@/src/server/ai-tasks";
import type { DelegationView } from "@/src/domain/types";

const task = (id: string, prompt: string, summary: string, services: AiTask["plan"]["services"]): AiTask => ({
  id,
  task: prompt,
  createdAt: "2026-11-02T00:00:00.000Z",
  plan: { summary, model: "fixture", services, steps: [], warnings: [] },
});

test("service filters distinguish saved tasks and search the prompt and AI response", () => {
  const storeTask = task("store", "Find a desk lamp", "Comparing store products", ["store"]);
  const jobsTask = task("jobs", "Find a developer role", "Searching job listings", ["jobs"]);

  assert.equal(SMAJ_SERVICES.length, 15);
  assert.equal(matchesTaskHistoryFilter(storeTask, "", "store"), true);
  assert.equal(matchesTaskHistoryFilter(jobsTask, "", "store"), false);
  assert.equal(matchesTaskHistoryFilter(storeTask, "comparing products", "store"), true);
  assert.equal(matchesTaskHistoryFilter(storeTask, "lamp role", "all"), false);
  assert.equal(matchesTaskHistoryFilter(jobsTask, "developer", "jobs"), true);
});

test("service filters include services referenced by plan steps and Jobs delegations", () => {
  const stepTask: AiTask = {
    ...task("stream", "Watch highlights", "Plan", []),
    plan: {
      ...task("stream", "Watch highlights", "Plan", []).plan,
      steps: [{ id: "watch", serviceId: "stream", title: "Stream", description: "", capability: "", status: "ready", approvalRequired: false, reason: "" }],
    },
  };
  const delegation: DelegationView = {
    id: "jobs-task",
    goal: "Prepare applications",
    candidateName: "",
    skills: [],
    status: "awaiting_approval",
    expiresAt: "",
    approvedAt: null,
    createdAt: "2026-11-02T00:00:00.000Z",
    updatedAt: "2026-11-02T00:00:00.000Z",
    plan: { summary: "Review applications", recommendations: [], model: "fixture" },
    jobs: [],
    selectedJobIds: [],
    sourceUrl: "",
    events: [],
    submissions: [],
    receipt: null,
  };

  assert.equal(matchesTaskHistoryFilter(stepTask, "", "stream"), true);
  assert.equal(matchesTaskHistoryFilter(delegation, "applications", "jobs"), true);
  assert.equal(matchesTaskHistoryFilter(delegation, "", "store"), false);
});

test("unfiltered history search covers saved conversations across every service", () => {
  for (const service of SMAJ_SERVICES) {
    const savedTask = task(service.id, "Original conversation request", "Distinctive saved response", [service.id]);
    assert.equal(matchesTaskHistoryFilter(savedTask, "distinctive response", "all"), true, service.name);
  }
});
