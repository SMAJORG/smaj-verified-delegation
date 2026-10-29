import { NextRequest, NextResponse } from "next/server";
import { createSession, SESSION_COOKIE } from "@/src/server/auth";
import { apiError } from "@/src/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
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
