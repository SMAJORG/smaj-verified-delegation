import assert from "node:assert/strict";
import test from "node:test";
import { createSession, requireActor, SESSION_COOKIE } from "@/src/server/auth";
import { AppError } from "@/src/server/http";

test("creates a signed session and rejects tampering", () => {
  const previous = process.env.SMAJ_DEMO_ACCESS_TOKEN;
  process.env.SMAJ_DEMO_ACCESS_TOKEN = "test-access-token-at-least-16";
  try {
    const session = createSession("test-access-token-at-least-16");
    const request = new Request("http://localhost/api/delegations", { headers: { cookie: `${SESSION_COOKIE}=${session.value}` } });
    assert.match(requireActor(request), /^[a-f0-9]{24}$/);
    const tampered = new Request("http://localhost/api/delegations", { headers: { cookie: `${SESSION_COOKIE}=${session.value}x` } });
    assert.throws(() => requireActor(tampered), (error: unknown) => error instanceof AppError && error.status === 401);
  } finally {
    if (previous === undefined) delete process.env.SMAJ_DEMO_ACCESS_TOKEN;
    else process.env.SMAJ_DEMO_ACCESS_TOKEN = previous;
  }
});

test("rejects unauthorized requests without a session", () => {
  const previous = process.env.SMAJ_DEMO_ACCESS_TOKEN;
  process.env.SMAJ_DEMO_ACCESS_TOKEN = "test-access-token-at-least-16";
  try {
    assert.throws(() => requireActor(new Request("http://localhost/api/delegations")), /Authentication is required/);
  } finally {
    if (previous === undefined) delete process.env.SMAJ_DEMO_ACCESS_TOKEN;
    else process.env.SMAJ_DEMO_ACCESS_TOKEN = previous;
  }
});
