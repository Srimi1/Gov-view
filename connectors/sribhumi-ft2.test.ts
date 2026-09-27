import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { checkSribhumiIndex, SRIBHUMI_INDEX, SRIBHUMI_NOTICE, sribhumiFt2 } from "./sribhumi-ft2.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const read = (name: string) => readFileSync(new URL(`../data/evidence/research/${name}`, import.meta.url));
const index = read("sribhumi-advertisements-2026-09-25.html").toString();
const pdf = read("sribhumi-ft2-deo-copyist-2026.pdf");
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-as-sribhumi-ft2")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType, bytes: bytes.length,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => {
    assert.equal(url, SRIBHUMI_INDEX);
    return { text: index, evidence: evidence(url, Buffer.from(index), "text/html") };
  },
  fetchBytes: async (url) => {
    assert.equal(url, SRIBHUMI_NOTICE);
    return { bytes: pdf, evidence: evidence(url, pdf, "application/pdf") };
  },
  ...override,
});

test("Sribhumi register binds dated Tribunal-II original and holds later link changes", () => {
  assert.doesNotThrow(() => checkSribhumiIndex(index));
  assert.throws(() => checkSribhumiIndex(index.replace("Foreigners%20Tribunal-II.pdf", "changed.pdf")), /identity changed/);
  assert.throws(() => checkSribhumiIndex(index.replace('datetime="2026-09-05T', 'datetime="2026-09-06T')), /publication row changed/);
  assert.throws(() => checkSribhumiIndex(index.replace(/(<a\b[^>]*title="[^"]*Foreigners Tribunal-II"[^>]*>)/, '$1<a href="/new.pdf" title="Correction to Foreigners Tribunal-II">New</a>')), /identity changed/);
});

test("Sribhumi stages two role drafts; English and Bengali handwriting applies only to Copyist", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await sribhumiFt2(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 2);
  assert.equal(result.evidence.length, 2);
  const [operator, copyist] = result.cycles;
  assert.equal(operator.status, "closed");
  assert.equal(operator.rules?.languages, undefined);
  assert.deepEqual(copyist.rules?.languages?.map((language) => language.language), ["en", "bn"]);
  assert.equal(copyist.applicationWindow.closesOn, "2026-09-12");
  assert.equal(copyist.applicationWindow.cutoffLocalTime, "11:00");
  assert.equal(copyist.applicationWindow.cutoffInclusive, true);
  assert.equal(copyist.venues[0].kind, "unknown");
  assert.equal(copyist.rules?.nationality, undefined);
  for (const stage of Object.values(evaluateEligibility(copyist.rules, { nationality: "US", education: "higher-secondary" }))) assert.equal(stage.result, "needs-verification");
});

test("Sribhumi walk-in registration respects 09:00 opening and 11:00 inclusive limit", async () => {
  const before = await sribhumiFt2(context({ now: new Date("2026-09-12T03:29:59Z") }));
  const atClose = await sribhumiFt2(context({ now: new Date("2026-09-12T05:30:00Z") }));
  const after = await sribhumiFt2(context({ now: new Date("2026-09-12T05:30:01Z") }));
  assert.equal(before.cycles[0].status, "upcoming");
  assert.equal(atClose.cycles[0].status, "open");
  assert.equal(after.cycles[0].status, "closed");
});

test("changed Sribhumi scan blocks retained eligibility and time", async () => {
  await assert.rejects(() => sribhumiFt2(context({ fetchBytes: async (url) => {
    const bytes = Buffer.concat([pdf, Buffer.from("changed")]);
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /PDF changed/);
});
