import assert from "node:assert/strict";
import test from "node:test";
import { readConversationCache, writeConversationCache } from "@/components/conversation-storage";
import type { AiTask } from "@/src/server/ai-tasks";

test("conversation cache is persistent per workspace scope", () => {
  const entries = new Map<string, string>();
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
  };
  const alice: AiTask = { id: "alice-task", task: "Alice's message", createdAt: "2026-11-02T00:00:00.000Z", plan: { summary: "Alice's response", model: "fixture", services: [], steps: [], warnings: [] } };
  const bob: AiTask = { id: "bob-task", task: "Bob's message", createdAt: "2026-11-02T00:00:00.000Z", plan: { summary: "Bob's response", model: "fixture", services: [], steps: [], warnings: [] } };

  writeConversationCache(storage, "alice-scope", { tasks: [alice], delegations: [] });
  writeConversationCache(storage, "bob-scope", { tasks: [bob], delegations: [] });

  assert.deepEqual(readConversationCache(storage, "alice-scope"), { tasks: [alice], delegations: [] });
  assert.deepEqual(readConversationCache(storage, "bob-scope"), { tasks: [bob], delegations: [] });
  assert.equal(readConversationCache(storage, "unknown-scope"), null);
});
