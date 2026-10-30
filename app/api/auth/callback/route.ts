import { NextRequest, NextResponse } from "next/server";
import { createUserSession, SESSION_COOKIE } from "@/src/server/auth";
import { exchangeSsoCode } from "@/src/server/sso";
import { SSO_NONCE_COOKIE, SSO_STATE_COOKIE } from "@/src/server/sso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cookieValue = (request: NextRequest, name: string) => request.cookies.get(name)?.value || "";

export async function GET(request: NextRequest) {
  const home = new URL("/", request.nextUrl.origin);
  try {
    const code = request.nextUrl.searchParams.get("code") || "";
    const state = request.nextUrl.searchParams.get("state") || "";
    const expectedState = cookieValue(request, SSO_STATE_COOKIE);
    if (!code || !state || !expectedState || state !== expectedState) {
      return NextResponse.redirect(new URL("/?sso=invalid_state", home));
    }
    const claims = await exchangeSsoCode(code);
    const session = createUserSession({ sub: claims.sub, uid: claims.uid, piUsername: claims.piUsername });
    const response = NextResponse.redirect(new URL("/", home));
    response.cookies.set(SESSION_COOKIE, session.value, {
      httpOnly: true,
      sameSite: "strict",
      secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
      path: "/",
      maxAge: session.maxAge,
    });
    response.cookies.set(SSO_STATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    response.cookies.set(SSO_NONCE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/?sso=failed", home));
  }
}