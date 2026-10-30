import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "@/src/server/http";

export const SESSION_COOKIE = "smaj_delegation_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

export type ActorSession = {
  actorId: string;
  authType: "sso" | "demo";
  piUsername?: string;
  uid?: string;
};

const accessToken = () => {
  const value = process.env.SMAJ_DEMO_ACCESS_TOKEN?.trim();
  if (!value || value.length < 16) throw new AppError("auth_not_configured", "Demo access is not configured", 503);
  return value;
};

// Sessions are signed with a dedicated secret when configured so the
// demo access token is never the long-term production signing key.
const sessionSecret = () => {
  const value = process.env.SMAJ_AI_SESSION_SECRET?.trim();
  if (value && value.length >= 16) return value;
  return accessToken();
};

const equal = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const sign = (payload: string) => createHmac("sha256", sessionSecret()).update(payload).digest("base64url");

const encodeSession = (session: Record<string, unknown>) => {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
};

export const createSession = (candidate: string) => {
  const expected = accessToken();
  if (!equal(candidate, expected)) throw new AppError("invalid_credentials", "Invalid access token", 401);
  const actorId = createHash("sha256").update(expected).digest("hex").slice(0, 24);
  const value = encodeSession({ actorId, authType: "demo", expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 });
  return { actorId, value, maxAge: SESSION_TTL_SECONDS };
};

export type SsoIdentity = { sub: string; uid?: string; piUsername?: string };

export const createUserSession = (identity: SsoIdentity) => {
  const actorId = String(identity.sub || "").trim();
  if (!actorId) throw new AppError("invalid_identity", "SSO identity is missing a subject", 401);
  const value = encodeSession({
    actorId,
    authType: "sso",
    uid: identity.uid || "",
    piUsername: identity.piUsername || "",
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  });
  return { actorId, value, maxAge: SESSION_TTL_SECONDS };
};

const cookieValue = (request: Request) => {
  const cookies = request.headers.get("cookie") || "";
  const match = cookies.split(";").map(item => item.trim()).find(item => item.startsWith(`${SESSION_COOKIE}=`));
  return match?.slice(SESSION_COOKIE.length + 1) || "";
};

export const requireActorSession = (request: Request): ActorSession => {
  const [payload, signature] = cookieValue(request).split(".");
  if (!payload || !signature || !equal(signature, sign(payload))) throw new AppError("unauthorized", "Authentication is required", 401);
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { actorId?: string; authType?: string; piUsername?: string; uid?: string; expiresAt?: number };
    if (!session.actorId || !session.expiresAt || session.expiresAt <= Date.now()) throw new Error("expired");
    return {
      actorId: session.actorId,
      authType: session.authType === "sso" ? "sso" : "demo",
      piUsername: session.piUsername,
      uid: session.uid,
    };
  } catch {
    throw new AppError("unauthorized", "Authentication is required", 401);
  }
};

export const requireActor = (request: Request) => requireActorSession(request).actorId;

export const demoAuthEnabled = () => process.env.SMAJ_DEMO_AUTH_ENABLED?.trim().toLowerCase() !== "false";
export const productionWritesEnabled = () => process.env.SMAJ_PRODUCTION_WRITES_ENABLED?.trim().toLowerCase() === "true";
export const realPiPaymentsEnabled = () => process.env.SMAJ_REAL_PI_PAYMENTS_ENABLED?.trim().toLowerCase() === "true";

// --- SMAJ PI HUB SSO token verification (HS256, shared signing secret) ---

export type SmajSsoClaims = {
  sub: string;
  uid?: string;
  piUsername?: string;
  role?: string;
  verificationLevel?: string;
  verificationStatus?: string;
  scope?: string;
  exp?: number;
};

const ssoSigningSecret = () => process.env.SMAJ_AI_SSO_SECRET?.trim() || process.env.SMAJ_AI_CLIENT_SECRET?.trim() || "";

export const ssoConfigured = () => Boolean(
  process.env.PIHUB_API_BASE_URL?.trim()
  && process.env.SMAJ_AI_CLIENT_ID?.trim()
  && process.env.SMAJ_AI_CLIENT_SECRET?.trim()
  && ssoSigningSecret(),
);

export const verifySmajSsoToken = (token: string, secret = ssoSigningSecret(), now = Date.now()): SmajSsoClaims => {
  const [header, payload, signature] = String(token || "").split(".");
  if (!header || !payload || !signature || !secret) throw new AppError("invalid_sso_token", "SSO token is invalid", 401);
  const expected = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  if (!equal(signature, expected)) throw new AppError("invalid_sso_token", "SSO token is invalid", 401);
  try {
    const parsedHeader = JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as { alg?: string };
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SmajSsoClaims & { iss?: string; aud?: string };
    const clientId = process.env.SMAJ_AI_CLIENT_ID?.trim() || "smaj-ai";
    if (parsedHeader.alg !== "HS256" || claims.iss !== "smajpihub" || claims.aud !== clientId) throw new Error("claims");
    if (!claims.sub || !claims.exp || claims.exp * 1000 <= now) throw new Error("expired");
    const scopes = String(claims.scope || "").split(" ").filter(Boolean);
    for (const required of ["profile:read", "jobs:read", "store:read"]) {
      if (!scopes.includes(required)) throw new Error("scope");
    }
    return claims;
  } catch {
    throw new AppError("invalid_sso_token", "SSO token is invalid", 401);
  }
};