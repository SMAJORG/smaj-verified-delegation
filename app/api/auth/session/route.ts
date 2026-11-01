import { NextRequest, NextResponse } from "next/server";
import { cookieValue, createSession, demoAuthEnabled, requireActorSession, SESSION_COOKIE, ssoConfigured } from "@/src/server/auth";
import { revokeDemoSession } from "@/src/server/demo-sessions";
import { apiError, AppError } from "@/src/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let authenticated = false;
  let authType: string | null = null;
  let sandbox = false;
  let expiresAt: number | undefined;
  try {
    const session = requireActorSession(request);
    authenticated = true;
    authType = session.authType;
    sandbox = Boolean(session.sandbox);
    expiresAt = session.expiresAt;
  } catch { /* unauthenticated */ }
  return NextResponse.json({ authenticated, authType, sandbox, expiresAt, ssoEnabled: ssoConfigured(), demoEnabled: demoAuthEnabled() }, { headers: { "Cache-Control": "no-store" } });
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

export async function DELETE(request: NextRequest) {
  try {
    const token = cookieValue(request);
    if (token.startsWith("hackathon_")) revokeDemoSession(token);
    const response = NextResponse.json({ authenticated: false });
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
    return response;
  } catch (error) { return apiError(error); }
}
