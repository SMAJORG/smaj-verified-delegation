import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { POST as createTask } from "@/app/api/tasks/route";
import { POST as discover } from "@/app/api/tasks/[id]/discover/route";
import { POST as approve } from "@/app/api/tasks/[id]/approve/route";
import { GET as getTask } from "@/app/api/tasks/[id]/route";
import { GET as getPdf } from "@/app/api/tasks/[id]/receipt/pdf/route";
import { createUserSession, SESSION_COOKIE } from "@/src/server/auth";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { workspaceDatabase } from "@/src/server/demo-workspace";
import { LiveWorkflow } from "@/src/server/live-workflow";
import type { JobApplicationPreview, LiveAction, ServiceRoutePlan } from "@/src/domain/services";

const preview = (recordId: string): JobApplicationPreview => ({
  detailsHash: "application-details-hash",
  job: { recordId, title: "Senior Engineer", company: "Verified Employer", location: "Lagos", type: "Full time", mode: "Hybrid", salary: "2,000 Pi / mo", category: "Engineering" },
  profile: { title: "Backend Engineer", skills: ["TypeScript", "Node.js"], location: "Lagos", portfolio: "https://portfolio.example", summary: "Build reliable services.", profilePhoto: "https://cdn.example/avatar.png" },
  cv: { attached: true, name: "Engineer CV.pdf", size: 2048, visibility: "applications" },
});

test("verified job application requires selection and approval, submits once, verifies backend evidence, and creates a PDF", async () => {
  const previous = { ...process.env }, originalFetch = globalThis.fetch;
  process.env.SMAJ_DELEGATION_DB_PATH = ":memory:";
  process.env.SMAJ_AI_SESSION_SECRET = "verified-application-session-secret";
  process.env.SMAJ_AI_DELEGATION_SECRET = "verified-application-delegation-secret-at-least-32";
  process.env.SMAJ_PRODUCTION_WRITES_ENABLED = "true";
  process.env.SMAJ_HUB_API_ORIGIN = "https://hub.example";
  process.env.META_API_KEY = "fixture-meta-key";
  process.env.META_MODEL = "fixture-model";
  delete process.env.SMAJ_AI_PUBLIC_URL;
  delete process.env.RENDER_EXTERNAL_URL;
  const identity = { sub: "aaaaaaaaaaaaaaaaaaaaaaaa", uid: "verified-candidate" };
  const session = createUserSession(identity);
  const cookie = `${SESSION_COOKIE}=${session.value}`;
  const request = (path: string, body?: unknown) => new NextRequest(`https://ai.example${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { cookie, origin: "https://ai.example", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let metaResponses = 0, prepareCalls = 0, writes = 0;
  let application: Record<string, unknown> | undefined;
  const evidenceFor = (claims: any) => ({
    serviceId: "jobs", kind: "apply", recordId: claims.action.recordId,
    ownerId: claims.sub, contractId: claims.contractId, backendId: "hub-app-application-123",
    status: "submitted", createdAt: "2026-10-28T12:30:00.000Z",
    jobTitle: "Senior Engineer", company: "Verified Employer",
    applicationDetailsHash: claims.applicationDetailsHash,
    idempotencyKey: "stable-idempotency-key", cvAttached: true,
  });
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin === "https://hub.example") {
      const token = (init?.headers as Record<string, string>)["X-SMAJ-Delegation"];
      const [encoded, signature] = token.split(".");
      assert.equal(signature, createHmac("sha256", process.env.SMAJ_AI_DELEGATION_SECRET!).update(encoded).digest("base64url"));
      const claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
      assert.equal(claims.sub, identity.sub);
      assert.equal(claims.uid, identity.uid);
      if (url.pathname === "/ai-delegation/prepare") {
        prepareCalls++;
        assert.equal(claims.operation, "prepare");
        return Response.json({ preview: preview(claims.action.recordId) });
      }
      assert.equal(claims.bindingConfirmed, true);
      assert.equal(claims.applicationDetailsHash, claims.action.applicationPreview.detailsHash);
      if (url.pathname === "/ai-delegation/verify" && application) return Response.json({ evidence: evidenceFor(claims) });
      if (url.pathname === "/ai-delegation/verify") return Response.json({ message: "No application record exists yet." }, { status: 409 });
      if (url.pathname === "/ai-delegation/execute") {
        writes++;
        application = { id: "hub-app-application-123", idempotencyKey: "stable-idempotency-key" };
        return Response.json({ evidence: evidenceFor(claims) });
      }
      throw new Error(`Unexpected Hub path: ${url.pathname}`);
    }
    if (url.pathname === "/jobs/jobs") {
      return Response.json({ jobs: [
        { slug: "verified-engineer", title: "Senior Engineer", company: "Verified Employer", companyId: "verified-company", employerId: "employer-1", employerVerified: true, location: "Lagos", type: "Full time", mode: "Hybrid", salary: "2,000 Pi / mo", category: "Engineering", summary: "Build reliable services.", skills: ["TypeScript", "Node.js"] },
        { slug: "unverified-engineer", title: "Engineer", company: "Unverified Employer", companyId: "unverified-company", employerId: "employer-2", employerVerified: false, location: "Remote", category: "Engineering" },
        { slug: "sample-engineer", title: "Engineer sample", company: "Sample Employer", employerVerified: false, location: "Remote", category: "Engineering" },
      ], pagination: { page: 1, pageSize: 50, total: 3, pages: 1 } });
    }
    if (url.pathname === "/v1/models") return Response.json({ data: [{ id: "fixture-model", capabilities: { conversation: true } }] });
    if (url.pathname === "/v1/responses") {
      metaResponses++;
      const answer = metaResponses === 1
        ? { summary: "Find verified engineering jobs", services: ["jobs"], steps: [{ id: "jobs", serviceId: "jobs", title: "Search jobs", description: "Search verified jobs", capability: "read opportunities", status: "ready", approvalRequired: true, reason: "User requested verified applications", query: { search: "Engineer" } }], warnings: [] }
        : { summary: "One verified employer role is suitable.", matches: [{ serviceId: "jobs", id: "verified-engineer", reason: "The role matches the requested skills." }], actions: [
          { serviceId: "jobs", recordId: "verified-engineer", kind: "apply", title: "Apply to Senior Engineer", coverNote: "My TypeScript and Node.js experience is relevant to this role." },
          { serviceId: "jobs", recordId: "unverified-engineer", kind: "apply", title: "Apply to unverified role", coverNote: "I am interested." },
          { serviceId: "jobs", recordId: "sample-engineer", kind: "apply", title: "Apply to sample", coverNote: "I am interested." },
        ] };
      return Response.json({ id: `meta-${metaResponses}`, model: "fixture-model", status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(answer) }] }] });
    }
    throw new Error(`Unexpected request: ${url.toString()}`);
  };
  try {
    const createdResponse = await createTask(request("/api/tasks", { task: "Find verified engineering jobs and prepare applications." }));
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    const taskId = created.task.id;
    const context = { params: Promise.resolve({ id: taskId }) };
    const discoveredResponse = await discover(request(`/api/tasks/${taskId}/discover`, { approved: true }), context);
    assert.equal(discoveredResponse.status, 200);
    const discovered = await discoveredResponse.json();
    assert.equal(prepareCalls, 1);
    assert.deepEqual(discovered.plan.proposedActions.map((action: LiveAction) => action.recordId), ["verified-engineer"]);
    assert.equal(discovered.plan.proposedActions[0].applicationPreview.cv.attached, true);
    assert.equal(writes, 0);

    const db = workspaceDatabase(request("/api/tasks", {}));
    const store = new AiTaskStore(db);
    const safePlan = discovered.plan as ServiceRoutePlan;
    const sampleAction: LiveAction = {
      id: "sample-action", serviceId: "jobs", kind: "apply", recordId: "sample-engineer",
      title: "Apply to sample", coverNote: "I am interested.", applicationPreview: preview("sample-engineer"),
    };
    store.savePlan(identity.sub, taskId, {
      ...safePlan,
      proposedActions: [sampleAction],
      actionReviewHash: "sample-review-hash",
    });
    const rejected = await approve(request(`/api/tasks/${taskId}/approve`, { approved: true, actionIds: [sampleAction.id], reviewHash: "sample-review-hash" }), context);
    assert.equal(rejected.status, 409);
    assert.equal(writes, 0);
    store.savePlan(identity.sub, taskId, safePlan);

    const selected = safePlan.proposedActions![0];
    const approvedResponse = await approve(request(`/api/tasks/${taskId}/approve`, { approved: true, actionIds: [selected.id], reviewHash: safePlan.actionReviewHash }), context);
    assert.equal(approvedResponse.status, 202);
    assert.equal(writes, 0);
    assert.equal(await new LiveWorkflow(db).tick(), true);
    assert.equal(writes, 1);

    const savedResponse = await getTask(request(`/api/tasks/${taskId}`), context);
    const saved = await savedResponse.json();
    assert.equal(saved.task.plan.execution.status, "verified");
    assert.equal(saved.task.plan.execution.receipt.evidence[0].backendId, "hub-app-application-123");
    assert.equal(saved.task.plan.execution.receipt.evidence[0].status, "submitted");
    assert.equal(saved.task.plan.execution.receipt.evidence[0].createdAt, "2026-10-28T12:30:00.000Z");
    const historyTask = store.get(identity.sub, taskId);
    assert.ok(historyTask);
    assert.equal(historyTask.plan.execution?.status, "verified");

    const pdfResponse = await getPdf(request(`/api/tasks/${taskId}/receipt/pdf`), context);
    assert.equal(pdfResponse.status, 200);
    const pdf = Buffer.from(await pdfResponse.arrayBuffer()).toString("ascii");
    assert.match(pdf, /hub-app-application-123/);
    assert.match(pdf, /Senior Engineer/);
    assert.match(pdf, /Verified Employer/);
    assert.match(pdf, /2026-10-28T12:30:00.000Z/);
    assert.match(pdf, /Backend application status: submitted/);
    assert.match(pdf, /Idempotency key: stable-idempotency-key/);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = previous;
  }
});
