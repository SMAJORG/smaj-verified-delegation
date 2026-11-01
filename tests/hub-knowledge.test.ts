import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import snapshot from "@/src/knowledge/hub.json";
import { retrieveHubKnowledge, hubKnowledgeContext } from "@/src/server/hub-knowledge";
import { MetaServiceRouter } from "@/src/server/service-router";

test("knowledge retrieves mission, deferred token, privacy and seller policy evidence", () => {
  assert.ok(retrieveHubKnowledge("What is the mission?").some(d => /## 5. Mission/.test(d.text)));
  assert.ok(retrieveHubKnowledge("Is SMAJ Token deferred?").some(d => /not part of the current.*launch plan/i.test(d.text)));
  assert.ok(retrieveHubKnowledge("privacy data collection").some(d => d.url.endsWith('/privacy')));
  assert.ok(retrieveHubKnowledge("seller refunds disputes").some(d => d.url.endsWith('/seller-agreement')));
  assert.equal(retrieveHubKnowledge("zzzzunavailablefact").length, 0);
  assert.match(hubKnowledgeContext("services").prompt, /planning_only/);
});

test("snapshot is traceable to unchanged HUB sources when the companion repo is available", () => {
  for (const source of snapshot.sources) {
    const path = `${process.env.SMAJ_HUB_SOURCE_PATH || "../smajpihub"}/${source.file}`;
    if (!existsSync(path)) continue;
    assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), source.sha256);
  }
});

test("informational Meta answers include evidence and produce no approval or execution steps", async () => {
  const previous = { ...process.env };
  process.env.META_API_KEY = 'fixture'; process.env.META_MODEL = 'fixture-model';
  const requests: string[] = [];
  try {
    const fetcher: typeof fetch = async (input, init) => {
      requests.push(String(input));
      if (String(input).endsWith('/models')) return Response.json({ data: [{ id: 'fixture-model' }] });
      const prompt = JSON.parse(String(init?.body)).input;
      assert.match(prompt, /HUB KNOWLEDGE RULES/);
      assert.match(prompt, /not part of the current.*launch plan/i);
      assert.match(prompt, /Ordinary informational questions need no task approval/);
      return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ summary: 'SMAJ Token is deferred, outside the current launch plan.', services: [], steps: [], warnings: [] }) }] }] });
    };
    const plan = await new MetaServiceRouter(fetcher).plan('Is SMAJ Token deferred?', []);
    assert.deepEqual(plan.steps, []); assert.deepEqual(plan.services, []);
    assert.ok(plan.sources?.some(source => source.url.endsWith('/white-paper')));
    assert.equal(requests.length, 2);
    assert.ok(requests.every(url => url.startsWith('https://api.meta.ai/')));
  } finally { process.env = previous; }
});
