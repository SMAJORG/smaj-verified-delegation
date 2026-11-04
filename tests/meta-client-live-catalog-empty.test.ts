import assert from "node:assert/strict";
import test from "node:test";
import { metaResponse } from "@/src/server/meta-client";

test("empty catalogs fail closed without sending an unsupported response request", async () => {
  const previous = process.env.META_API_KEY;
  process.env.META_API_KEY = "test-only-secret";
  try {
    const calls: string[] = [];
    await assert.rejects(() => metaResponse("Say hello.", 1500, (async url => {
      calls.push(String(url)); return Response.json({ data: [] });
    }) as typeof fetch), (error: any) => error.code === "meta_no_conversational_models");
    assert.deepEqual(calls, ["https://api.meta.ai/v1/models"]);
  } finally {
    if (previous === undefined) delete process.env.META_API_KEY; else process.env.META_API_KEY = previous;
  }
});
