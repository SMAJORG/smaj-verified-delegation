import { NextRequest, NextResponse } from "next/server";
import { requireActorSession } from "@/src/server/auth";
import { apiError, requireSameOrigin, AppError } from "@/src/server/http";
import { UserPreferencesStore } from "@/src/server/user-preferences";
import { workspaceDatabase } from "@/src/server/demo-workspace";
import { publicJson } from "@/src/server/public-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = requireActorSession(request);
    return NextResponse.json({ preferences: new UserPreferencesStore(workspaceDatabase(request)).get(session.actorId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const session = requireActorSession(request);
    const body = await (session.authType === "public" ? publicJson(request) : request.json()) as { preferences?: unknown };
    if (!body || !Array.isArray(body.preferences)) throw new AppError("invalid_preferences", "Send a preferences list.", 400);
    const preferences = new UserPreferencesStore(workspaceDatabase(request)).save(session.actorId, body.preferences);
    return NextResponse.json({ preferences }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
