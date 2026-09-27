import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { meclNonexecutive, verifyMeclIndex } from "./mecl-nonexecutive.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const index = readFileSync(new URL("../data/evidence/research/mecl-careers-2026.html", import.meta.url), "utf8");
const original = readFileSync(new URL("../data/evidence/research/mecl-advertisement-03-2026.pdf", import.meta.url));
const instructions = readFileSync(new URL("../data/evidence/research/mecl-exam-instructions-03-2026.pdf", import.meta.url));
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/mecl-nonexecutive-03-2026.json", import.meta.url), "utf8")) as {
  indexUrl: string; advertisementUrl: string; instructionsUrl: string; applicationUrl: string;
};
const registry = JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[];
const source = registry.find((entry) => entry.id === "in-mecl-nonexecutive")!;
const evidence = (url: string, bytes: Buffer, type: string): Evidence => ({
  url, fetchedAt: "2026-09-25T04:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"),
  contentType: type, bytes: bytes.length,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T04:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => ({ text: index, evidence: evidence(url, Buffer.from(index), "text/html") }),
  fetchBytes: async (url) => {
    const bytes = url === extraction.advertisementUrl ? original : instructions;
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  },
  ...override,
});

test("MECL register binds both exact notice documents and official application link", () => {
  verifyMeclIndex(index);
  assert.throws(() => verifyMeclIndex(index + index), /notice set changed/);
  assert.throws(() => verifyMeclIndex(index.replaceAll("Final_Advt_03R26.pdf", "changed.pdf")), /document link or title changed/);
  assert.throws(() => verifyMeclIndex(index.replaceAll("mecljul26", "different-form")), /application link changed/);
});

test("MECL counts applications by post code, keeps date precision and international eligibility", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await meclNonexecutive(context());
  assert.equal(result.cycles.length, 16);
  assert.equal(new Set(result.cycles.map((cycle) => cycle.id)).size, 16);
  assert.equal(result.cycles.reduce((sum, cycle) => sum + Number(/^\d+/.exec(cycle.outcome)?.[0] ?? 0), 0), 122);
  assert.equal(result.evidence.length, 3);
  assert.equal(result.complete, false);
  for (const cycle of result.cycles) {
    assert.equal(cycle.status, "open");
    assert.equal(cycle.applicationWindow.opensOn, "2026-09-12");
    assert.equal(cycle.applicationWindow.closesOn, "2026-10-11");
    assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
    assert.equal(cycle.applicationWindow.precision, "date");
    assert.equal(cycle.applicationUrl, extraction.applicationUrl);
    assert.equal(cycle.rules?.complete, false);
    assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", education: "master" }).canApply.result, "does-not-match");
    assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN", education: "master" }).canApply.result, "needs-verification");
    assert.equal(cycle.rules?.languages?.[0].minimumLevel, undefined);
  }
  assert.deepEqual(result.cycles[6].rules?.languages?.map((rule) => rule.language), ["en", "en"]);
  assert.deepEqual(result.cycles[7].rules?.languages?.map((rule) => rule.language), ["en", "hi"]);
  assert.equal(result.cycles[6].rules?.languages?.[1].minimumLevel, undefined);
  assert.equal((await meclNonexecutive(context({ now: new Date("2026-10-12T00:00:00Z") }))).cycles[0].status, "closed");
});

test("MECL changed official PDF blocks reuse of old critical fields", async () => {
  await assert.rejects(() => meclNonexecutive(context({ fetchBytes: async (url) => {
    const bytes = url === extraction.advertisementUrl ? Buffer.concat([original, Buffer.from("change")]) : instructions;
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /PDF changed/);
});
