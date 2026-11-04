import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/src/server/auth";
import { workspaceDatabase } from "@/src/server/demo-workspace";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { apiError, AppError, readJsonBody, requireSameOrigin } from "@/src/server/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    requireSameOrigin(request);
    const session = requireAuthenticatedSession(request);
    if (session.authType !== "sso" || session.sandbox) throw new AppError("live_identity_required", "Sign in to SMAJ PI HUB to manage a live seller action", 403);
    const body = await readJsonBody(request, 8_000);
    if (typeof body.actionId !== "string" || typeof body.reviewHash !== "string") throw new AppError("invalid_cancel_request", "A seller action and its current review hash are required", 400);

    const database = workspaceDatabase(request);
    const store = new AiTaskStore(database);
    const id = (await context.params).id;
    const task = database.transaction(() => {
      const current = store.get(session.actorId, id);
      if (current.plan.execution) throw new AppError("execution_exists", "This seller action can no longer be cancelled", 409);
      if (!current.plan.discovery || current.plan.actionReviewHash !== body.reviewHash) throw new AppError("stale_approval", "The seller draft changed. Reload and review it again.", 409);
      const actions = current.plan.proposedActions || [];
      const target = actions.find(action => action.id === body.actionId);
      if (!target || target.kind !== "contact_seller") throw new AppError("seller_action_not_found", "The pending seller message was not found", 404);
      const remaining = actions.filter(action => action.id !== body.actionId);
      const actionReviewHash = remaining.length
        ? createHash("sha256").update(JSON.stringify({ proofHash: current.plan.discovery.proofHash, actions: remaining })).digest("hex")
        : undefined;
      const cancelledActions = [...(current.plan.cancelledActions || []), { action: target, cancelledAt: new Date().toISOString() }];
      return store.savePlan(session.actorId, id, { ...current.plan, proposedActions: remaining, cancelledActions, actionReviewHash });
    })();
    return NextResponse.json({ task, plan: task.plan }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
