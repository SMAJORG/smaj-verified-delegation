import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export class AppError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
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
    return NextResponse.json({ error: error.code, message: error.message, requestId }, { status: error.status });
  }
  console.error(`[${requestId}] Unhandled API failure`, error);
  return NextResponse.json({ error: "internal_error", message: "The request could not be completed", requestId }, { status: 500 });
};
