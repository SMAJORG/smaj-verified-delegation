import { randomBytes } from "node:crypto";
import { AppError } from "@/src/server/http";
import { ssoConfigured, verifySmajSsoToken, type SmajSsoClaims } from "@/src/server/auth";

// Server-side SMAJ PI HUB single sign-on client. The browser only ever
// carries a one-time code; the client secret and token exchange stay here.

export const SSO_STATE_COOKIE = "smaj_sso_state";
export const SSO_NONCE_COOKIE = "smaj_sso_nonce";
const STATE_TTL_SECONDS = 10 * 60;

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new AppError("sso_not_configured", "SMAJ PI HUB single sign-on is not configured", 503);
  return value.replace(/\/+$/, "");
};

export const ssoPublicBaseUrl = () => (process.env.SMAJ_AI_PUBLIC_URL?.trim() || "https://ai.smajpihub.com").replace(/\/+$/, "");
export const ssoRedirectUri = () => `${ssoPublicBaseUrl()}/api/auth/callback`;
export const createSsoState = () => randomBytes(32).toString("base64url");

export const buildAuthorizeUrl = (state: string) => {
  if (!ssoConfigured()) throw new AppError("sso_not_configured", "SMAJ PI HUB single sign-on is not configured", 503);
  const url = new URL(`${required("PIHUB_API_BASE_URL")}/sso/authorize`);
  url.searchParams.set("client_id", process.env.SMAJ_AI_CLIENT_ID?.trim() || "smaj-ai");
  url.searchParams.set("redirect_uri", ssoRedirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "profile:read jobs:read store:read");
  return { url: url.toString(), maxAge: STATE_TTL_SECONDS };
};

export const exchangeSsoCode = async (code: string, fetcher: typeof fetch = fetch): Promise<SmajSsoClaims> => {
  if (!ssoConfigured()) throw new AppError("sso_not_configured", "SMAJ PI HUB single sign-on is not configured", 503);
  const response = await fetcher(`${required("PIHUB_API_BASE_URL")}/sso/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: ssoRedirectUri(),
      client_id: process.env.SMAJ_AI_CLIENT_ID?.trim() || "smaj-ai",
      client_secret: process.env.SMAJ_AI_CLIENT_SECRET?.trim(),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new AppError("sso_exchange_failed", "SMAJ PI HUB sign-in could not be completed", 401);
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new AppError("sso_exchange_failed", "SMAJ PI HUB sign-in could not be completed", 401);
  return verifySmajSsoToken(payload.access_token);
};