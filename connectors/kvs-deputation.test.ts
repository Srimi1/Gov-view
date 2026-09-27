import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { kvsDeputation, verifyKvsIndex } from "./kvs-deputation.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const index = readFileSync(new URL("../data/evidence/research/kvs-2026-recruitment-index.html", import.meta.url), "utf8");
const original = readFileSync(new URL("../data/evidence/research/kvs-advertisement-03-2026.pdf", import.meta.url));
const extension = readFileSync(new URL("../data/evidence/research/kvs-extension-2026-09-17.pdf", import.meta.url));
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/kvs-deputation-03-2026.json", import.meta.url), "utf8")) as { indexUrl: string; advertisementUrl: string; extensionUrl: string };
const registry = JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[];
const source = registry.find((entry) => entry.id === "in-kvs-deputation")!;
const evidence = (url: string, bytes: Buffer, type: string): Evidence => ({ url, fetchedAt: "2026-09-25T04:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType: type, bytes: bytes.length });
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T04:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => ({ text: index, evidence: evidence(url, Buffer.from(index), "text/html") }),
  fetchBytes: async (url) => {
    const bytes = url === extraction.advertisementUrl ? original : extension;
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  },
  ...override,
});

test("KVS register binds original and signed extension, rejecting changed deadlines or duplicate notices", () => {
  verifyKvsIndex(index);
  assert.throws(() => verifyKvsIndex(index.replace("17/09/2026", "18/09/2026")), /document, date or post identity changed/);
  assert.throws(() => verifyKvsIndex(index + index), /register entries changed/);
  assert.throws(() => verifyKvsIndex(index.replaceAll("2026091723.pdf", "replacement.pdf")), /document, date or post identity changed/);
});

test("KVS post applications remain distinct; extension, postal receipt and language alternatives stay explicit", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await kvsDeputation(context());
  assert.equal(result.cycles.length, 2);
  assert.equal(new Set(result.cycles.map((cycle) => cycle.id)).size, 2);
  assert.equal(result.evidence.length, 3);
  for (const cycle of result.cycles) {
    assert.equal(cycle.appointmentType, "deputation");
    assert.equal(cycle.status, "open");
    assert.equal(cycle.applicationWindow.opensOn, null);
    assert.equal(cycle.applicationWindow.closesOn, "2026-10-05");
    assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
    assert.match(cycle.applicationWindow.note ?? "", /postal delivery must reach KVS/i);
    assert.match(cycle.citizenshipRule, /International applicants need KVS confirmation/);
    assert.equal(cycle.applicationUrl, extraction.advertisementUrl);
    assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", education: "master" }).canApply.result, "needs-verification");
  }
  assert.equal(result.cycles[0].rules?.languages, undefined);
  assert.deepEqual(result.cycles[1].rules?.languages?.map((rule) => rule.language), ["hi", "en"]);
  assert.equal(result.cycles[1].rules?.languages?.[0].minimumLevel, undefined);
  assert.equal((await kvsDeputation(context({ now: new Date("2026-10-06T00:00:00Z") }))).cycles[0].status, "closed");
});

test("KVS changed scanned PDF cannot reuse prior qualification or deadline extraction", async () => {
  await assert.rejects(() => kvsDeputation(context({ fetchBytes: async (url) => {
    const bytes = url === extraction.advertisementUrl ? original : Buffer.concat([extension, Buffer.from("change")]);
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /scanned PDF changed/);
});
