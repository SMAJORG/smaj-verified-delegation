import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export class AppError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number, public readonly retryAfterSeconds?: number) {
    super(message);
  }
}

export const requireIdempotencyKey = (request: Request) => {
  const value = request.headers.get("idempotency-key")?.trim();
  if (!value || !/^[a-zA-Z0-9:_-]{8,128}$/.test(value)) {
    throw new AppError("invalid_idempotency_key", "A valid Idempotency-Key header is required", 400);
  }
  return value;
};

export const apiError = (error: unknown) => {
  const requestId = randomUUID();
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.code, message: error.message, requestId }, { status: error.status, headers: {"Cache-Control":"no-store", ...(error.retryAfterSeconds ? {"Retry-After":String(error.retryAfterSeconds)} : {})} });
  }
  console.error(`[${requestId}] Unhandled API failure`, error);
  return NextResponse.json({ error: "internal_error", message: "The request could not be completed", requestId }, { status: 500 });
};

// Use deployment configuration, never client-supplied forwarded Host, as the
// production trust boundary. Render supplies its own exact external HTTPS URL.
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const configured = [process.env.SMAJ_AI_PUBLIC_URL, process.env.RENDER_EXTERNAL_URL]
    .map(value => value?.trim()).filter((value): value is string => Boolean(value));
  let allowed: string[];
  try {
    allowed = configured.map(value => {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid public URL");
      return url.origin;
    });
    if (!allowed.length) {
      const url = new URL(request.url);
      const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || url.protocol.slice(0, -1);
      const host = request.headers.get("host") || url.host;
      allowed = [new URL(`${protocol}://${host}`).origin];
    }
  } catch {
    throw new AppError("invalid_origin_configuration", "Website origin configuration is invalid", 503);
  }
  if (!origin || !allowed.includes(origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new AppError("invalid_origin", "Same-origin request required", 403);
  }
}
