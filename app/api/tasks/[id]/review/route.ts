import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/src/server/auth";
import { workspaceDatabase } from "@/src/server/demo-workspace";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { apiError, AppError, readJsonBody, requireSameOrigin } from "@/src/server/http";
import type { LiveAction } from "@/src/domain/services";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    requireSameOrigin(request);
    const session = requireAuthenticatedSession(request);
    if (session.authType !== "sso" || session.sandbox) throw new AppError("live_identity_required", "Sign in to SMAJ PI HUB to edit a live seller message", 403);
    const body = await readJsonBody(request, 8_000);
    if (typeof body.actionId !== "string" || typeof body.reviewHash !== "string" || typeof body.message !== "string" || !body.message.trim() || body.message.trim().length > 1000) {
      throw new AppError("invalid_seller_message", "Enter a seller message of 1 to 1,000 characters", 400);
    }
    const draftMessage = body.message.trim();

    const database = workspaceDatabase(request);
    const store = new AiTaskStore(database);
    const id = (await context.params).id;
    const task = database.transaction(() => {
      const current = store.get(session.actorId, id);
      if (current.plan.execution) throw new AppError("execution_exists", "This seller action can no longer be edited", 409);
      if (!current.plan.discovery || !Number.isFinite(Date.parse(current.plan.discovery.completedAt))
        || Date.parse(current.plan.discovery.completedAt) < Date.now() - 30 * 60_000
        || current.plan.actionReviewHash !== body.reviewHash) {
        throw new AppError("stale_approval", "The seller draft changed or its catalog evidence expired. Refresh and review it again.", 409);
      }
      const actions = current.plan.proposedActions || [];
      const index = actions.findIndex(action => action.id === body.actionId);
      const action = actions[index];
      if (!action || action.kind !== "contact_seller" || !action.storePreview || action.storePreview.product.recordId !== action.recordId) {
        throw new AppError("seller_message_review_required", "A prepared seller message is required before editing", 409);
      }
      const updated = [...actions];
      updated[index] = { ...action, message: draftMessage } satisfies LiveAction;
      const actionReviewHash = createHash("sha256").update(JSON.stringify({ proofHash: current.plan.discovery.proofHash, actions: updated })).digest("hex");
      return store.savePlan(session.actorId, id, { ...current.plan, proposedActions: updated, actionReviewHash });
    })();
    return NextResponse.json({ task, plan: task.plan }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
