import assert from "node:assert/strict";
import test from "node:test";
import { createDatabase } from "@/src/server/database";
import { AppError } from "@/src/server/http";
import { ServiceConnectionStore } from "@/src/server/service-connections";

test("initializes Jobs as the only connected authorized service", () => {
  const database = createDatabase(":memory:");
  try {
    const connections = new ServiceConnectionStore(database).list("actor-one");
    assert.equal(connections.length, 15);
    assert.deepEqual(connections.filter(item => item.connected).map(item => item.serviceId), ["jobs"]);
  } finally { database.close(); }
});

test("persists disconnects independently for each actor", () => {
  const database = createDatabase(":memory:");
  try {
    const store = new ServiceConnectionStore(database);
    store.set("actor-one", "jobs", false);
    assert.equal(store.list("actor-one").find(item => item.serviceId === "jobs")?.connected, false);
    assert.equal(store.list("actor-two").find(item => item.serviceId === "jobs")?.connected, true);
  } finally { database.close(); }
});

test("rejects unavailable integrations instead of simulating a connection", () => {
  const database = createDatabase(":memory:");
  try {
    const store = new ServiceConnectionStore(database);
    assert.throws(() => store.set("actor-one", "health", true), (error: unknown) => error instanceof AppError && error.code === "integration_unavailable");
  } finally { database.close(); }
});

test("SSO actors start with no services connected until they opt in", () => {
  const database = createDatabase(":memory:");
  try {
    const store = new ServiceConnectionStore(database);
    const connections = store.list("sso-user-1", "sso");
    assert.deepEqual(connections.filter(item => item.connected).map(item => item.serviceId), []);
    store.set("sso-user-1", "jobs", true);
    assert.equal(store.list("sso-user-1", "sso").find(item => item.serviceId === "jobs")?.connected, true);
  } finally { database.close(); }
});
