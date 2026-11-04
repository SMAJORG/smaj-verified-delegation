import { readJsonBody, requireSameOrigin } from "@/src/server/http";
import { NextRequest, NextResponse } from "next/server";
import { requireActorSession } from "@/src/server/auth";
import { workspaceDatabase } from "@/src/server/demo-workspace";
import { apiError, AppError } from "@/src/server/http";
import { AiTaskStore, type AiTask } from "@/src/server/ai-tasks";
import { MetaServiceRouter } from "@/src/server/service-router";
import { ServiceConnectionStore } from "@/src/server/service-connections";
import { UserPreferencesStore } from "@/src/server/user-preferences";

import { beginPublicWork, publicJson } from "@/src/server/public-access";
export const runtime = "nodejs";
export const maxDuration = 240;
export const dynamic = "force-dynamic";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_REQUEST_BYTES = 5_700_000;
const IMAGE_TASK_SUFFIX = "\n[Image attached for this turn; image is not saved in conversation history.]";

export async function GET(request: NextRequest) {
  try {
    const session = requireActorSession(request);
    return NextResponse.json({ tasks: new AiTaskStore(workspaceDatabase(request)).list(session.actorId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  let release = () => {};
  let savedTask: AiTask | undefined;
  let actorId: string | undefined;
  try {
    requireSameOrigin(request);
    const session = requireActorSession(request);
    actorId = session.actorId;
    const body = await (session.authType === "public" ? publicJson(request, MAX_REQUEST_BYTES, 16_000) : readJsonBody(request, MAX_REQUEST_BYTES, 16_000));
    if (typeof body.task !== "string" || !body.task.trim() || body.task.length > 2000) throw new AppError("invalid_task", "Enter a message of 1 to 2,000 characters", 400);
    let image: { mimeType: "image/jpeg" | "image/png" | "image/webp"; data: string } | undefined;
    if (body.image !== undefined) {
      if (!body.image || typeof body.image !== "object" || Array.isArray(body.image)) throw new AppError("invalid_image", "Attach a JPEG, PNG, or WebP image to continue.", 400);
      const { mimeType, data } = body.image as { mimeType?: unknown; data?: unknown };
      if (!["image/jpeg", "image/png", "image/webp"].includes(String(mimeType)) || typeof data !== "string" || !data.length || data.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 || data.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) {
        throw new AppError("invalid_image", "Attach a valid JPEG, PNG, or WebP image smaller than 4 MB.", 400);
      }
      const bytes = Buffer.from(data, "base64");
      const signatureMatches = mimeType === "image/jpeg"
        ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : mimeType === "image/png"
          ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
      if (bytes.length > MAX_IMAGE_BYTES || bytes.toString("base64") !== data || !signatureMatches) throw new AppError("invalid_image", "Attach a valid JPEG, PNG, or WebP image smaller than 4 MB.", 400);
      image = { mimeType: mimeType as "image/jpeg" | "image/png" | "image/webp", data };
    }
    if (image && body.task.trim().length > 1900) throw new AppError("invalid_task", "Keep your question under 1,900 characters when attaching an image.", 400);
    const tasks = new AiTaskStore(workspaceDatabase(request));
    if (body.conversationId !== undefined && (typeof body.conversationId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.conversationId))) throw new AppError("invalid_conversation", "That conversation could not be continued.", 400);
    const requestKey = request.headers.get("idempotency-key") || undefined;
    if (requestKey && !/^[a-zA-Z0-9._:-]{8,128}$/.test(requestKey)) throw new AppError("invalid_request_key", "The message request could not be safely retried.", 400);
    savedTask = requestKey ? tasks.byRequestKey(actorId, requestKey) : undefined;
    if (!savedTask && (session.sandbox || session.authType === "public") && tasks.list(actorId).length >= 50) throw new AppError("demo_limit", "This workspace has reached its AI task limit. Start a new public workspace.", 429);
    const taskText = `${body.task.trim()}${image ? IMAGE_TASK_SUFFIX : ""}`;
    if (savedTask && savedTask.task !== taskText) throw new AppError("invalid_request_key", "This retry does not match the saved message and attachment.", 409);
    if (savedTask?.plan.generationStatus === "complete") return NextResponse.json({ plan: savedTask.plan, task: savedTask }, { status: 200, headers: { "Cache-Control": "no-store" } });
    if (savedTask?.plan.generationStatus === "pending" && Date.now() - Date.parse(savedTask.createdAt) < 120_000) {
      return NextResponse.json({ message: "This message is still being processed. Retry shortly using the same message.", code: "generation_in_progress" }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    if (savedTask && body.conversationId && savedTask.conversationId !== body.conversationId) throw new AppError("invalid_request_key", "This retry does not match the saved conversation.", 409);
    const conversationId = (body.conversationId as string | undefined) || savedTask?.conversationId;
    const previousTurns = conversationId
      ? tasks.conversationHistory(actorId, conversationId).filter(turn => turn.id !== savedTask?.id && turn.plan.generationStatus !== "pending" && turn.plan.generationStatus !== "failed")
      : [];
    const connectedServiceIds = new ServiceConnectionStore(workspaceDatabase(request)).list(actorId, session.authType).filter(connection => connection.connected).map(connection => connection.serviceId);
    release = beginPublicWork(request, session);
    const context = previousTurns.map(turn => ({
      task: turn.task.slice(0, 2000),
      summary: turn.plan.summary.slice(0, 1200),
      services: turn.plan.services,
      ...(session.authType === "sso" ? {
        storeListings: (() => {
          const result = turn.plan.discovery?.results.find(item => item.serviceId === "store" && item.status === "read");
          const products = (result?.records || []).filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
          const discussedIds = products
            .filter(product => typeof product.title === "string" && product.title && turn.plan.summary.toLowerCase().includes(product.title.toLowerCase()))
            .map(product => String(product.id || ""));
          const matchedIds = new Set([
            ...(turn.plan.matches || []).filter(match => match.serviceId === "store").map(match => match.id),
            ...discussedIds,
          ]);
          const prioritized = matchedIds.size ? products.filter(product => matchedIds.has(String(product.id || ""))) : products;
          return prioritized.slice(0, 12).map(product => ({
            id: String(product.id || ""),
            ...(typeof product.sellerId === "string" ? { sellerId: product.sellerId } : {}),
            title: String(product.title || "").slice(0, 180),
            ...(typeof product.sellerName === "string" ? { sellerName: product.sellerName.slice(0, 120) } : {}),
            ...(typeof product.pricePi === "number" ? { pricePi: product.pricePi } : {}),
            ...(typeof product.priceUsdt === "number" ? { priceUsdt: product.priceUsdt } : {}),
            ...(typeof product.quantity === "number" ? { quantity: product.quantity } : {}),
            ...(typeof product.summary === "string" ? { summary: product.summary.slice(0, 300) } : {}),
            matched: matchedIds.has(String(product.id || "")),
          })).filter(product => product.id && product.title);
        })(),
      } : {}),
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
    if (!savedTask) {
      const pendingPlan = { summary: "", model: "Meta AI", services: [], steps: [], warnings: [], generationStatus: "pending" as const };
      savedTask = tasks.create(actorId, taskText, pendingPlan, conversationId, requestKey);
    } else {
      tasks.savePlan(actorId, savedTask.id, { ...savedTask.plan, generationStatus: "pending", generationError: undefined });
    }
    const plan = await new MetaServiceRouter().plan(body.task.trim(), connectedServiceIds, context, preferences, image);
    const task = tasks.savePlan(actorId, savedTask.id, { ...plan, generationStatus: "complete" });
    savedTask = task;
    return NextResponse.json({ plan, task }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (savedTask) {
      const message = error instanceof Error ? error.message : "The AI response did not complete. Please retry.";
      if (actorId) try { new AiTaskStore(workspaceDatabase(request)).savePlan(actorId, savedTask.id, { ...savedTask.plan, generationStatus: "failed", generationError: message }); } catch (saveError) { console.error("[SMAJ AI] Failed to record message generation failure:", saveError); }
    }
    const response=apiError(error);if(response.status===429&&!response.headers.has("Retry-After"))response.headers.set("Retry-After","60");return response;
  }
  finally { release(); }
}
