import { NextRequest, NextResponse } from "next/server";
import { demoAuthEnabled, requireActorSession, SESSION_COOKIE } from "@/src/server/auth";
import { issueDemoSession, revokeDemoSession } from "@/src/server/demo-sessions";
import { seedDemoWorkspace } from "@/src/server/demo-workspace";
import { apiError, AppError } from "@/src/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let issued: ReturnType<typeof issueDemoSession> | undefined;
  try {
    // NextURL normalizes loopback hosts. Use the HTTP authority seen by the
    // browser, with the protocol forwarded by the hosting proxy on HTTPS.
    const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || request.nextUrl.protocol.slice(0, -1);
    const host = request.headers.get("host") || request.nextUrl.host;
    const expectedOrigin = new URL(`${protocol}://${host}`).origin;
    if (request.headers.get("origin") !== expectedOrigin || request.headers.get("sec-fetch-site") === "cross-site") {
      throw new AppError("invalid_origin", "Start the demo from this website.", 403);
    }
    if (!demoAuthEnabled()) throw new AppError("demo_disabled", "The demo is unavailable. Please use SMAJ PI HUB sign-in.", 403);
    let existing;
    try { existing = requireActorSession(request); } catch { /* no valid session */ }
    if (existing && !existing.sandbox) throw new AppError("already_authenticated", "Sign out before starting a demo workspace.", 409);
    if (existing?.sandbox) return NextResponse.json({ authenticated: true, authType: "demo", sandbox: true, expiresAt: existing.expiresAt }, { headers: { "Cache-Control": "no-store" } });
    issued = issueDemoSession();
    await seedDemoWorkspace(issued.actorId);
    const response = NextResponse.json({ authenticated: true, authType: "demo", sandbox: true, expiresAt: issued.expiresAt }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SESSION_COOKIE, issued.value, {
      httpOnly: true, sameSite: "strict", secure: protocol === "https",
      path: "/", maxAge: issued.maxAge,
    });
    return response;
  } catch (error) {
    if (issued) {
      try { revokeDemoSession(issued.value); } catch { /* No cookie was issued; the unreachable session still expires. */ }
    }
    return apiError(error);
  }
}
