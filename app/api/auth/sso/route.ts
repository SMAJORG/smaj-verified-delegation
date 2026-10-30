import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/src/server/http";
import { buildAuthorizeUrl, createSsoState, SSO_NONCE_COOKIE, SSO_STATE_COOKIE } from "@/src/server/sso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const state = createSsoState();
    const nonce = createSsoState();
    const { url, maxAge } = buildAuthorizeUrl(state);
    const response = NextResponse.redirect(url);
    const secure = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
    const options = { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge };
    response.cookies.set(SSO_STATE_COOKIE, state, options);
    response.cookies.set(SSO_NONCE_COOKIE, nonce, options);
    return response;
  } catch (error) {
    return apiError(error);
  }
}