import { NextRequest, NextResponse } from "next/server";
import { requireActorSession, ssoConfigured } from "@/src/server/auth";
import { apiError, AppError, requireSameOrigin } from "@/src/server/http";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { workspaceDatabase } from "@/src/server/demo-workspace";
import { SearchSignInStore, SEARCH_SIGNIN_COOKIE, SEARCH_SIGNIN_TTL } from "@/src/server/search-signin";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const session = requireActorSession(request);
    const body = await request.json();
    if (body.approved !== true || typeof body.taskId !== "string") throw new AppError("approval_required", "Approve this search before continuing to sign-in.", 400);
    const task = new AiTaskStore(workspaceDatabase(request)).get(session.actorId, body.taskId);
    if (task.plan.execution) throw new AppError("execution_exists", "Start a new request to search again.", 409);
    if (!ssoConfigured()) throw new AppError("sso_not_configured", "SMAJ PI HUB sign-in is temporarily unavailable. The operator must configure the SSO connection. Your request has been kept; no search was run.", 503);
    const token = new SearchSignInStore().create(task);
    const response = NextResponse.json({ signInUrl: "/api/auth/sso" }, {headers:{"Cache-Control":"no-store"}});
    response.cookies.set(SEARCH_SIGNIN_COOKIE, token, {httpOnly:true, sameSite:"lax", secure:request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https", path:"/", maxAge:SEARCH_SIGNIN_TTL});
    return response;
  } catch (error) { return apiError(error); }
}
