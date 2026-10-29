import { NextResponse } from "next/server";

export const apiError = (error: unknown, fallbackStatus = 400) => {
  const message = error instanceof Error ? error.message : "Unexpected request failure";
  const status = message === "Delegation not found" ? 404 : message.includes("required before execution") ? 409 : fallbackStatus;
  return NextResponse.json({ error: "request_failed", message }, { status });
};
