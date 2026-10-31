import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { POST, GET } from "@/app/api/connections/route";
import { createUserSession, SESSION_COOKIE } from "@/src/server/auth";
import { requireSameOrigin } from "@/src/server/http";

test("Render connection mutations accept exact deployment origins and preserve authentication and CSRF", async () => {
  const previous = { ...process.env };
  Object.assign(process.env, {
    NODE_ENV: "production",
    SMAJ_AI_PUBLIC_URL: "https://ai.smajpihub.com/",
    RENDER_EXTERNAL_URL: "https://smaj-ai.onrender.com",
    SMAJ_AI_SESSION_SECRET: "origin-test-session-secret-at-least-32-characters",
    SMAJ_DELEGATION_DB_PATH: join(mkdtempSync(join(tmpdir(), "smaj-origins-")), "workspace.sqlite"),
  });
  const cookie = `${SESSION_COOKIE}=${createUserSession({ sub: "origin-test-user" }).value}`;
  const request = (origin: string | null, serviceId = "store", connected = true, authenticated = true, extra: Record<string, string> = {}) => new NextRequest("http://localhost:10000/api/connections", {
    method: "POST", headers: { host: "smaj-ai.onrender.com", "x-forwarded-proto": "https, http", "content-type": "application/json", ...(origin === null ? {} : { origin }), ...(authenticated ? { cookie } : {}), ...extra },
    body: JSON.stringify({ serviceId, connected }),
  });
  try {
    for (const origin of ["https://smaj-ai.onrender.com", "https://ai.smajpihub.com"]) {
      for (const service of ["store", "stream", "jobs"]) {
        for (const connected of [true, false]) {
          const response = await POST(request(origin, service, connected));
          assert.equal(response.status, 200);
          assert.equal((await response.json()).connections.find((item: { serviceId: string }) => item.serviceId === service).connected, connected);
        }
      }
    }
    for (const origin of [null, "null", "https://evil.example", "http://smaj-ai.onrender.com", "https://smaj-ai.onrender.com.evil.example"]) {
      assert.equal((await POST(request(origin))).status, 403);
    }
    assert.equal((await POST(request("https://evil.example", "store", true, true, { "x-forwarded-host": "evil.example", host: "evil.example" }))).status, 403);
    assert.equal((await POST(request("https://smaj-ai.onrender.com", "store", true, true, { "sec-fetch-site": "cross-site" }))).status, 403);
    assert.equal((await POST(request("https://smaj-ai.onrender.com", "store", true, false))).status, 401);
    assert.equal((await GET(new NextRequest("https://smaj-ai.onrender.com/api/connections", { headers: { cookie } }))).status, 200);
    process.env.SMAJ_AI_PUBLIC_URL = "invalid";
    assert.throws(() => requireSameOrigin(request("https://smaj-ai.onrender.com")), /configuration/);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});
