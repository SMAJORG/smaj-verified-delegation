import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "@/src/server/http";

export const SESSION_COOKIE = "smaj_delegation_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

const accessToken = () => {
  const value = process.env.SMAJ_DEMO_ACCESS_TOKEN?.trim();
  if (!value || value.length < 16) throw new AppError("auth_not_configured", "Demo access is not configured", 503);
  return value;
};

const equal = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const sign = (payload: string) => createHmac("sha256", accessToken()).update(payload).digest("base64url");

export const createSession = (candidate: string) => {
  const expected = accessToken();
  if (!equal(candidate, expected)) throw new AppError("invalid_credentials", "Invalid access token", 401);
  const actorId = createHash("sha256").update(expected).digest("hex").slice(0, 24);
  const payload = Buffer.from(JSON.stringify({ actorId, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 })).toString("base64url");
  return { actorId, value: `${payload}.${sign(payload)}`, maxAge: SESSION_TTL_SECONDS };
};

const cookieValue = (request: Request) => {
  const cookies = request.headers.get("cookie") || "";
  const match = cookies.split(";").map(item => item.trim()).find(item => item.startsWith(`${SESSION_COOKIE}=`));
  return match?.slice(SESSION_COOKIE.length + 1) || "";
};

export const requireActor = (request: Request) => {
  const [payload, signature] = cookieValue(request).split(".");
  if (!payload || !signature || !equal(signature, sign(payload))) throw new AppError("unauthorized", "Authentication is required", 401);
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { actorId?: string; expiresAt?: number };
    if (!session.actorId || !session.expiresAt || session.expiresAt <= Date.now()) throw new Error("expired");
    return session.actorId;
  } catch {
    throw new AppError("unauthorized", "Authentication is required", 401);
  }
};
