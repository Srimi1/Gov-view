import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { GUJARAT_DASHBOARD, gujaratPsc, parseGujaratDashboard, parseGujaratDetail } from "./gujarat-psc.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const read = (name: string) => readFileSync(new URL(`../data/evidence/research/${name}`, import.meta.url));
const dashboard = read("gpsc-ads-2026.html").toString();
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/gpsc-maritime-42-43-2026.json", import.meta.url), "utf8")) as {
  advertisements: { number: string; title: string; detailUrl: string; experienceYears: number; ageLimit: number; disability: string; documents: { key: string; url: string; sha256: string }[] }[];
};
const details = new Map(extraction.advertisements.map((ad) => [ad.detailUrl, read(`gpsc-detail-${ad.number.slice(0, 2)}.html`).toString()]));
const pdfs = new Map(extraction.advertisements.flatMap((ad) => ad.documents.map((doc) => [doc.url, read(`gpsc-${doc.key === "detailed" ? "da" : "rr"}-${ad.number.slice(0, 2)}-2026.pdf`)] as const)));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-gj-recruitment")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => { const text = url === GUJARAT_DASHBOARD ? dashboard : details.get(url); assert.ok(text, `unexpected HTML ${url}`); return { text, evidence: evidence(url, Buffer.from(text), "text/html") }; },
  fetchBytes: async (url) => { const bytes = pdfs.get(url); assert.ok(bytes, `unexpected PDF ${url}`); return { bytes, evidence: evidence(url, bytes, "application/pdf") }; },
  ...override,
});

test("GPSC dashboard binds two separate applications, dates and exact attachments", () => {
  assert.equal(parseGujaratDashboard(dashboard).size, 2);
  for (const advertisement of extraction.advertisements) assert.equal(parseGujaratDetail(details.get(advertisement.detailUrl)!, advertisement).size, 2);
  assert.throws(() => parseGujaratDashboard(dashboard.replaceAll("08-10-2026 11:59 PM", "09-10-2026 11:59 PM")), /window changed/);
  assert.throws(() => parseGujaratDetail(details.get(extraction.advertisements[0].detailUrl)!.replace("DA-42-2026.pdf", "DA-42-2026-new.pdf"), extraction.advertisements[0]), /outside official archive|PDF link changed/);
});

test("GPSC drafts retain PwD differences, applicant uncertainty and language wording", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await gujaratPsc(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 2);
  assert.equal(result.evidence.length, 7);
  assert.notEqual(result.cycles[0].id, result.cycles[1].id);
  assert.equal(result.cycles[0].applicationUrl, result.cycles[1].applicationUrl);
  assert.match(result.cycles[0].outcome, /Specific Learning Disability/);
  assert.match(result.cycles[1].outcome, /Low Vision/);
  assert.match(result.cycles[0].qualifications, /five|5 years/);
  assert.match(result.cycles[1].qualifications, /8 years/);
  for (const cycle of result.cycles) {
    assert.equal(cycle.status, "uncertain");
    assert.equal(cycle.applicationWindow.opensOn, "2026-09-24");
    assert.equal(cycle.applicationWindow.closesOn, "2026-10-08");
    assert.equal(cycle.applicationWindow.cutoffLocalTime, "23:59");
    assert.equal(cycle.venues[0].kind, "unknown");
    assert.equal(cycle.rules?.nationality, undefined);
    assert.equal(cycle.rules?.languages, undefined);
    assert.match(cycle.qualifications, /Gujarati or Hindi/);
    assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", education: "bachelor" }).canApply.result, "needs-verification");
  }
  assert.equal((await gujaratPsc(context({ now: new Date("2026-10-08T23:59:00+05:30") }))).cycles[0].status, "closed");
});

test("GPSC changed scan prevents stale critical fields", async () => {
  const url = extraction.advertisements[0].documents[0].url;
  await assert.rejects(() => gujaratPsc(context({ fetchBytes: async (candidate) => {
    const bytes = candidate === url ? Buffer.concat([pdfs.get(candidate)!, Buffer.from("changed")]) : pdfs.get(candidate)!;
    return { bytes, evidence: evidence(candidate, bytes, "application/pdf") };
  } })), /PDF changed/);
});
