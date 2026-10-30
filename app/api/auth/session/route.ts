import { NextRequest, NextResponse } from "next/server";
import { createSession, demoAuthEnabled, requireActorSession, SESSION_COOKIE, ssoConfigured } from "@/src/server/auth";
import { apiError, AppError } from "@/src/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let authenticated = false;
  let authType: string | null = null;
  try {
    const session = requireActorSession(request);
    authenticated = true;
    authType = session.authType;
  } catch { /* unauthenticated */ }
  return NextResponse.json({ authenticated, authType, ssoEnabled: ssoConfigured(), demoEnabled: demoAuthEnabled() });
}

export async function POST(request: NextRequest) {
  try {
    if (!demoAuthEnabled()) throw new AppError("demo_auth_disabled", "Demo access is disabled; continue with SMAJ PI HUB", 403);
    const body = await request.json() as { accessToken?: string };
    const session = createSession(String(body.accessToken || ""));
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(SESSION_COOKIE, session.value, {
      httpOnly: true, sameSite: "strict",
      secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
      path: "/", maxAge: session.maxAge,
    });
    return response;
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}