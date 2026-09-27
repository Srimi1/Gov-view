import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { checkPsssbPages, PSSSB_PAGES, PSSSB_PDFS, punjabSssb } from "./punjab-sssb.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const research = (name: string) => readFileSync(new URL(`../data/evidence/research/${name}`, import.meta.url));
const pages = ["psssb-group-d-2026-09-25.html", "psssb-04-2026-detail.html", "psssb-04-2026-amendments.html"].map((name) => research(name).toString());
const pdfs = ["psssb-04-2026-original.pdf", "psssb-04-2026-aug-corrigendum.pdf", "psssb-04-2026-punjabi-corrigendum.pdf", "psssb-04-2026-corrigendum-merged.pdf", "psssb-04-2026-correction-portal.pdf"].map(research);
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-pb-sssb")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType, bytes: bytes.length,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => {
    const position = PSSSB_PAGES.indexOf(url as typeof PSSSB_PAGES[number]);
    assert.notEqual(position, -1);
    const text = pages[position];
    return { text, evidence: evidence(url, Buffer.from(text), "text/html") };
  },
  fetchBytes: async (url) => {
    const position = PSSSB_PDFS.indexOf(url);
    assert.notEqual(position, -1);
    const bytes = pdfs[position];
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  },
  ...override,
});

test("Punjab Group D official index and complete amendment set are pinned", () => {
  assert.doesNotThrow(() => checkPsssbPages(pages[0], pages[1], pages[2]));
  assert.throws(() => checkPsssbPages(pages[0].replace("Advertisement No. 04 of 2026", "Advertisement No. 05 of 2026"), pages[1], pages[2]), /index changed/);
  assert.throws(() => checkPsssbPages(pages[0], pages[1], pages[2].replace("12345698_merged.pdf", "new-notice.pdf")), /amendments changed/);
});

test("Correction portal does not reopen one closed Group D cycle", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await punjabSssb(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 8);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "closed");
  assert.equal(cycle.applicationWindow.opensOn, "2026-08-25");
  assert.equal(cycle.applicationWindow.closesOn, "2026-09-21");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.match(cycle.outcome, /2,098/);
  assert.match(cycle.statusNote, /existing applicants only/);
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(cycle.changes.filter((change) => change.kind === "extended").length, 1);
});

test("International status and Punjabi assessment remain evidence-bounded", async () => {
  const { cycles: [cycle] } = await punjabSssb(context());
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.residence, undefined);
  assert.equal(cycle.rules?.age?.min, 18);
  assert.equal(cycle.rules?.age?.max, undefined);
  assert.equal(cycle.rules?.languages?.[0].minimumLevel, undefined);
  assert.match(cycle.rules!.languages![0].requirement, /50%/);
  for (const nationality of ["IN", "US"]) {
    const report = evaluateEligibility(cycle.rules, { nationality, residenceCountry: nationality, dateOfBirth: "1995-01-01", education: "secondary" });
    assert.equal(report.canApply.result, "needs-verification");
    assert.equal(report.canEnterSelection.result, "needs-verification");
    assert.equal(report.canObtainOutcome.result, "needs-verification");
  }
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", dateOfBirth: "2010-01-01" }).canApply.result, "does-not-match");
});

test("Changed signed PDF withholds deadline, count and correction interpretation", async () => {
  for (const changedUrl of [PSSSB_PDFS[0], PSSSB_PDFS[3], PSSSB_PDFS[4]]) {
    await assert.rejects(() => punjabSssb(context({ fetchBytes: async (url) => {
      const position = PSSSB_PDFS.indexOf(url);
      const bytes = Buffer.concat([pdfs[position], Buffer.from(url === changedUrl ? "changed" : "")]);
      return { bytes, evidence: evidence(url, bytes, "application/pdf") };
    } })), /PDF changed/);
  }
});
