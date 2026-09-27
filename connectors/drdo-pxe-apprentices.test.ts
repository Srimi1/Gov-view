import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { drdoPxeApprentices, verifyDrdoPxeDetail, verifyDrdoPxeIndex } from "./drdo-pxe-apprentices.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const extract = JSON.parse(readFileSync(new URL("../data/extractions/drdo-pxe-apprentices-2026.json", import.meta.url), "utf8")) as {
  indexUrl: string; detailUrl: string; noticeUrl: string;
};
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-or-drdo-pxe-apprentices")!;
const read = (file: string) => readFileSync(new URL(`../data/evidence/research/${file}`, import.meta.url));
const index = read("drdo-vacancies-2026-09-25.html").toString();
const detail = read("drdo-pxe-apprentices-2026.html").toString();
const pdf = read("drdo-pxe-apprentices-2026.pdf");
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType, bytes: bytes.length,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => {
    assert.ok(url === extract.indexUrl || url === extract.detailUrl);
    const text = url === extract.indexUrl ? index : detail;
    return { text, evidence: evidence(url, Buffer.from(text), "text/html") };
  },
  fetchBytes: async (url) => {
    assert.equal(url, extract.noticeUrl);
    return { bytes: pdf, evidence: evidence(url, pdf, "application/pdf") };
  },
  ...override,
});

test("DRDO PXE binds one register card, dated detail and original notice bytes", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyDrdoPxeIndex(index));
  assert.doesNotThrow(() => verifyDrdoPxeDetail(detail));
  assert.throws(() => verifyDrdoPxeIndex(index.replace("12/10/2026", "13/10/2026")), /changed/);
  assert.throws(() => verifyDrdoPxeDetail(detail.replace("12-10-2026", "13-10-2026")), /changed/);
  assert.throws(() => verifyDrdoPxeDetail(detail.replace("advtPXE23092026.pdf", "changed.pdf")), /changed/);
  const changed = Buffer.concat([pdf, Buffer.from("changed")]);
  await assert.rejects(() => drdoPxeApprentices(context({ fetchBytes: async (url) => ({ bytes: changed, evidence: evidence(url, changed, "application/pdf") }) })), /notice changed/);
});

test("DRDO PXE stages one postal vocational intake with foreign and language uncertainty", async () => {
  const result = await drdoPxeApprentices(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 3);
  const cycle = result.cycles[0];
  assert.equal(cycle.pathway, "vocational");
  assert.equal(cycle.status, "open");
  assert.equal(cycle.applicationMethod, "post");
  assert.equal(cycle.applicationWindow.opensOn, "2026-09-23");
  assert.equal(cycle.applicationWindow.closesOn, "2026-10-12");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.match(cycle.outcome, /50 places across 12/);
  assert.match(cycle.outcome, /no right to DRDO employment/);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", education: "bachelor" }).canApply.result, "needs-verification");
  assert.equal((await drdoPxeApprentices(context({ now: new Date("2026-10-12T12:00:00+05:30") }))).cycles[0].status, "uncertain");
  assert.equal((await drdoPxeApprentices(context({ now: new Date("2026-10-13T00:00:00+05:30") }))).cycles[0].status, "closed");
});
