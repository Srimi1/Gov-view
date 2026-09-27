import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { nfcItiApprenticeship, verifyNfcItiIndex } from "./nfc-iti-apprenticeship.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const indexUrl = "https://www.nfc.gov.in/recruitment.html";
const noticeUrl = "https://www.nfc.gov.in/pdf/recruitment-advt/2026/nfc-r-III-1082026.pdf";
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-tg-nfc-iti-apprenticeship")!;
const index = readFileSync(new URL("../data/evidence/research/nfc-recruitment-index-2026.html", import.meta.url), "utf8");
const pdf = readFileSync(new URL("../data/evidence/research/nfc-iti-apprenticeship-2026.pdf", import.meta.url));
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType, bytes: bytes.length,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => {
    assert.equal(url, indexUrl);
    return { text: index, evidence: evidence(url, Buffer.from(index), "text/html") };
  },
  fetchBytes: async (url) => {
    assert.equal(url, noticeUrl);
    return { bytes: pdf, evidence: evidence(url, pdf, "application/pdf") };
  },
  ...override,
});

test("NFC ITI connector binds dated index row and exact original notice", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyNfcItiIndex(index));
  assert.throws(() => verifyNfcItiIndex(index.replace("nfc-r-III-1082026.pdf", "different.pdf")), /index row or notice link changed/);
  const changed = Buffer.concat([pdf, Buffer.from("changed")]);
  await assert.rejects(() => nfcItiApprenticeship(context({ fetchBytes: async (url) => ({ bytes: changed, evidence: evidence(url, changed, "application/pdf") }) })), /notice changed/);
});

test("NFC stages one vocational training cycle with uncertain international and language rules", async () => {
  const result = await nfcItiApprenticeship(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 2);
  const cycle = result.cycles[0];
  assert.equal(cycle.pathway, "vocational");
  assert.equal(cycle.status, "closed");
  assert.equal(cycle.applicationWindow.opensOn, null);
  assert.equal(cycle.applicationWindow.closesOn, "2026-09-16");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.match(cycle.outcome, /432 places across 15 trades/);
  assert.match(cycle.outcome, /no right to NFC employment/);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", education: "diploma" }).canApply.result, "needs-verification");
  assert.equal((await nfcItiApprenticeship(context({ now: new Date("2026-09-16T12:00:00+05:30") }))).cycles[0].status, "uncertain");
});
