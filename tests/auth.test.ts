import assert from "node:assert/strict";
import test from "node:test";
import { createUserSession, requireActor, requireActorSession, SESSION_COOKIE, verifySmajSsoToken } from "@/src/server/auth";
import { createHmac } from "node:crypto";
import { AppError } from "@/src/server/http";

test("creates a signed session and rejects tampering", () => {
  const previous = process.env.SMAJ_AI_SESSION_SECRET;
  process.env.SMAJ_AI_SESSION_SECRET = "test-access-token-at-least-16";
  try {
    const session = createUserSession({sub:"real-hub-user"});
    const request = new Request("http://localhost/api/delegations", { headers: { cookie: `${SESSION_COOKIE}=${session.value}` } });
    assert.equal(requireActor(request), "real-hub-user");
    const tampered = new Request("http://localhost/api/delegations", { headers: { cookie: `${SESSION_COOKIE}=${session.value}x` } });
    assert.throws(() => requireActor(tampered), (error: unknown) => error instanceof AppError && error.status === 401);
  } finally {
    if (previous === undefined) delete process.env.SMAJ_AI_SESSION_SECRET;
    else process.env.SMAJ_AI_SESSION_SECRET = previous;
  }
});

test("rejects unauthorized requests without a session", () => {
  const previous = process.env.SMAJ_AI_SESSION_SECRET;
  process.env.SMAJ_AI_SESSION_SECRET = "test-access-token-at-least-16";
  try {
    assert.throws(() => requireActor(new Request("http://localhost/api/delegations")), /Authentication is required/);
  } finally {
    if (previous === undefined) delete process.env.SMAJ_AI_SESSION_SECRET;
    else process.env.SMAJ_AI_SESSION_SECRET = previous;
  }
});

test("creates an SSO user session bound to the PiHub subject", () => {
  const previous = process.env.SMAJ_AI_SESSION_SECRET;
  process.env.SMAJ_AI_SESSION_SECRET = "test-session-secret-at-least-16-chars";
  try {
    const session = createUserSession({ sub: "pihub-user-123", uid: "pi-uid-1", piUsername: "amina" });
    const request = new Request("http://localhost/api/connections", { headers: { cookie: `${SESSION_COOKIE}=${session.value}` } });
    const actor = requireActorSession(request);
    assert.equal(actor.actorId, "pihub-user-123");
    assert.equal(actor.authType, "sso");
    assert.equal(actor.piUsername, "amina");
    assert.equal(requireActor(request), "pihub-user-123");
  } finally {
    if (previous === undefined) delete process.env.SMAJ_AI_SESSION_SECRET;
    else process.env.SMAJ_AI_SESSION_SECRET = previous;
  }
});

test("verifies PiHub SSO tokens and rejects invalid ones", () => {
  const secret = "test-sso-secret-at-least-16-chars";
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const sign = (claims: Record<string, unknown>, key = secret) => {
    const header = encode({ alg: "HS256", typ: "JWT" });
    const payload = encode(claims);
    const signature = createHmac("sha256", key).update(`${header}.${payload}`).digest("base64url");
    return `${header}.${payload}.${signature}`;
  };
  const base = { iss: "smajpihub", aud: "smaj-ai", sub: "pihub-user-123", piUsername: "amina", scope: "profile:read jobs:read store:read", exp: Math.floor(Date.now() / 1000) + 300 };
  assert.equal(verifySmajSsoToken(sign(base), secret).sub, "pihub-user-123");
  assert.throws(() => verifySmajSsoToken(sign(base, "wrong-secret-wrong-secret-00"), secret));
  assert.throws(() => verifySmajSsoToken(sign({ ...base, aud: "other-app" }), secret));
  assert.throws(() => verifySmajSsoToken(sign({ ...base, scope: "profile:read" }), secret));
  assert.throws(() => verifySmajSsoToken(sign({ ...base, exp: Math.floor(Date.now() / 1000) - 10 }), secret));
});

test("Hub bridge uses verified identity and rejects tampered, expired or long-lived tokens", () => {
  const previous = process.env.SMAJ_AI_SSO_SECRET;
  const secret = "hub-bridge-test-secret-at-least-32-characters";
  process.env.SMAJ_AI_SSO_SECRET = secret;
  const token = (exp: number, sub = "hub-user-123") => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub, uid: "pi-uid", iss: "smajpihub", aud: process.env.SMAJ_AI_CLIENT_ID || "smaj-ai", scope: "profile:read jobs:read store:read", exp })).toString("base64url");
    return `${header}.${payload}.${createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")}`;
  };
  const request = (value: string) => new Request("https://ai.example/api/tasks", { headers: { "x-smaj-hub-token": value } });
  try {
    const now = Math.floor(Date.now() / 1000);
    const valid = token(now + 60);
    assert.equal(requireActorSession(request(valid)).actorId, "hub-user-123");
    assert.equal(requireActorSession(request(valid)).authType, "sso");
    assert.throws(() => requireActorSession(request(valid + "x")));
    assert.throws(() => requireActorSession(request(token(now - 1))));
    assert.throws(() => requireActorSession(request(token(now + 3600))));
    assert.throws(() => requireActorSession(request(token(now + 60, ""))));
    delete process.env.SMAJ_AI_SSO_SECRET;
    assert.throws(() => requireActorSession(request(valid)));
  } finally {
    if (previous === undefined) delete process.env.SMAJ_AI_SSO_SECRET;
    else process.env.SMAJ_AI_SSO_SECRET = previous;
  }
});
