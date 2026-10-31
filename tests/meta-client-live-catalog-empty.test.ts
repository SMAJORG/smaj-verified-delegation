import assert from "node:assert/strict";
import test from "node:test";
import { metaResponse } from "@/src/server/meta-client";

test("AI attempts a live response even when the catalog is empty", async () => {
  const previous = { ...process.env };
  try {
    process.env.META_API_KEY = "test-only-secret";
    process.env.META_MODEL = "muse-wonder-1.0";
    const calls: string[] = [];
    const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);
      calls.push(target);
      if (target.endsWith("/models")) {
        return Response.json({ data: [] });
      }
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "muse-wonder-1.0");
      assert.equal("model_id" in body, false);
      return Response.json({
        status: "completed",
        output: [{ content: [{ type: "output_text", text: "real answer" }] }],
      });
    };
    const result = await metaResponse("Say hello.", 1500, fetcher as typeof fetch);
    assert.equal(result.model, "muse-wonder-1.0");
    assert.equal(calls.length, 2);
    assert.equal(result.payload.output[0].content[0].text, "real answer");
  } finally {
    for (const name of Object.keys(process.env)) if (!(name in previous)) delete process.env[name];
    Object.assign(process.env, previous);
  }
});
