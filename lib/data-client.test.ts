import assert from "node:assert/strict";
import test from "node:test";
import { demoOpportunities } from "./opportunities.ts";
import { loadData } from "./data-client.ts";

test("initial download stays bounded; country retry preserves healthy shards", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  let failSecondShard = true;
  const make = (id: string, code: string) => ({ ...demoOpportunities[0], id, jurisdictionCode: code, jurisdictionName: code });
  const responses: Record<string, unknown> = {
    "/data/index.json": { generatedAt: "2026-09-25T00:00:00Z", total: 3, countries: [{ code: "DE", count: 2, listShards: 2 }, { code: "IN", count: 1, listShards: 1 }] },
    "/data/list/DE-0.json": [make("de-0", "DE")],
    "/data/list/DE-1.json": [make("de-1", "DE")],
    "/data/list/IN-0.json": [make("in-0", "IN")],
  };
  globalThis.fetch = async (input) => {
    const path = String(input);
    calls.push(path);
    if (path.endsWith("/data/list/DE-1.json") && failSecondShard) return new Response("Unavailable", { status: 503 });
    const key = Object.keys(responses).find((candidate) => path.endsWith(candidate));
    return key ? Response.json(responses[key]) : new Response("Missing", { status: 404 });
  };
  try {
    const initial = await loadData(undefined, true);
    assert.equal(initial.loadedCount, 2);
    assert.equal(initial.complete, false);
    assert.deepEqual(initial.completeCountries, ["IN"]);
    assert.equal(calls.some((path) => path.endsWith("DE-1.json")), false);

    const partial = await loadData(undefined, false, "DE");
    assert.equal(partial.loadedCount, 2);
    assert.equal(partial.errors.length, 1);
    failSecondShard = false;
    const recovered = await loadData(undefined, false, "DE");
    assert.equal(recovered.loadedCount, 3);
    assert.equal(recovered.complete, true);
    assert.deepEqual(recovered.completeCountries, ["DE", "IN"]);
    assert.equal(calls.filter((path) => path.endsWith("DE-0.json")).length, 1);
    assert.equal(calls.filter((path) => path.endsWith("IN-0.json")).length, 1);
    assert.equal(calls.filter((path) => path.endsWith("DE-1.json")).length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
