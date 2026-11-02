import { requireSameOrigin } from "@/src/server/http";
import { NextRequest, NextResponse } from "next/server";
import { requireActorSession } from "@/src/server/auth";
import { workspaceDatabase } from "@/src/server/demo-workspace";
import { apiError, AppError } from "@/src/server/http";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { MetaServiceRouter } from "@/src/server/service-router";
import { ServiceConnectionStore } from "@/src/server/service-connections";
import { UserPreferencesStore } from "@/src/server/user-preferences";

import { beginPublicWork, publicJson } from "@/src/server/public-access";
export const runtime = "nodejs";
export const maxDuration = 180;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = requireActorSession(request);
    return NextResponse.json({ tasks: new AiTaskStore(workspaceDatabase(request)).list(session.actorId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  let release = () => {};
  try {
    requireSameOrigin(request);
    const session = requireActorSession(request);
    const actorId = session.actorId;
    const body = await (session.authType === "public" ? publicJson(request) : request.json()) as { task?: unknown; conversationId?: unknown };
    if (typeof body.task !== "string" || !body.task.trim() || body.task.length > 2000) throw new AppError("invalid_task", "Enter a message of 1 to 2,000 characters", 400);
    const tasks = new AiTaskStore(workspaceDatabase(request));
    if ((session.sandbox || session.authType === "public") && tasks.list(actorId).length >= 50) throw new AppError("demo_limit", "This workspace has reached its AI task limit. Start a new public workspace.", 429);
    if (body.conversationId !== undefined && (typeof body.conversationId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.conversationId))) throw new AppError("invalid_conversation", "That conversation could not be continued.", 400);
    const conversationId = body.conversationId as string | undefined;
    const previousTurns = conversationId ? tasks.conversationHistory(actorId, conversationId) : [];
    if (conversationId && !previousTurns.length) throw new AppError("conversation_not_found", "That conversation could not be found.", 404);
    const connectedServiceIds = new ServiceConnectionStore(workspaceDatabase(request)).list(actorId, session.authType).filter(connection => connection.connected).map(connection => connection.serviceId);
    release = beginPublicWork(request, session);
    const context = previousTurns.map(turn => ({
      task: turn.task.slice(0, 2000),
      summary: turn.plan.summary.slice(0, 1200),
      services: turn.plan.services,
      sellerMessages: (turn.plan.execution?.evidence || []).flatMap(item => {
        if (!item || typeof item !== "object") return [];
        const evidence = item as Record<string, unknown>;
        if (evidence.kind !== "contact_seller" || !Array.isArray(evidence.messages)) return [];
        return evidence.messages.flatMap(message => {
          if (!message || typeof message !== "object") return [];
          const saved = message as Record<string, unknown>;
          return saved.senderId === evidence.sellerId && typeof saved.message === "string"
            ? [{ productId: String(evidence.recordId), message: saved.message.slice(0, 1000), createdAt: String(saved.createdAt || "") }]
            : [];
        }).slice(-50);
      }).slice(-50),
    }));
    const preferences = new UserPreferencesStore(workspaceDatabase(request)).get(actorId);
    const plan = await new MetaServiceRouter().plan(body.task.trim(), connectedServiceIds, context, preferences);
    const task = tasks.create(actorId, body.task.trim(), plan, conversationId);
    return NextResponse.json({ plan, task }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { const response=apiError(error);if(response.status===429&&!response.headers.has("Retry-After"))response.headers.set("Retry-After","60");return response; }
  finally { release(); }
}
