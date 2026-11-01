import { NextRequest, NextResponse } from "next/server";
import { requireActorSession, SESSION_COOKIE, ssoConfigured } from "@/src/server/auth";
import { requireSameOrigin, apiError } from "@/src/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  let authenticated = false;
  try { requireActorSession(request); authenticated = true; } catch { /* Sign-in is required. */ }
  return NextResponse.json({ authenticated, authType: authenticated ? "sso" : null, ssoEnabled: ssoConfigured() }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST() {
  return NextResponse.json({ error: "sso_required", message: "Continue with SMAJ PI HUB to sign in." }, { status: 410 });
}
export async function DELETE(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const response = NextResponse.json({ authenticated: false });
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
    return response;
  } catch (error) { return apiError(error); }
}
