import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { belNotificationCards, belSeptemberEngineers2026, verifyBelIndexes } from "./bel-september-engineers-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const root = new URL("../data/evidence/research/", import.meta.url);
const indexes = Array.from({ length: 11 }, (_, i) => readFileSync(new URL(
  `bel-job-notifications${i === 0 ? "" : `-page-${i + 1}`}-2026-09-27.html`, root), "utf8"));
const pdfs = ["sr-assistant-engineer", "senior-fixed-term-engineer"].map((name) => readFileSync(new URL(`bel-${name}-2026-09-27.pdf`, root)));
const data = JSON.parse(readFileSync(new URL("../data/extractions/bel-september-engineers-2026.json", import.meta.url), "utf8")) as {
  indexPages: { url: string }[]; roles: { pdfUrl: string }[];
};
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-bel-september-engineers-2026")!;
const evidence = (url: string, bytes: Buffer): Evidence => ({ url, fetchedAt: "2026-09-26T20:15:00Z",
  sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
  contentType: url.endsWith(".pdf") ? "application/pdf" : "text/html" });
function context(now = new Date("2026-09-27T00:00:00Z"), mutation = ""): ConnectorContext {
  return { source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      const index = data.indexPages.findIndex((page) => page.url === url); assert.ok(index >= 0);
      const text = indexes[index];
      return { text, evidence: evidence(mutation === "redirect" ? url + "&redirected=1" : url, Buffer.from(text)) };
    },
    fetchBytes: async (url) => {
      const index = data.roles.findIndex((role) => role.pdfUrl === url); assert.ok(index >= 0);
      const bytes = mutation === "pdf" ? Buffer.concat([pdfs[index], Buffer.from("retirement amendment")]) : pdfs[index];
      return { bytes, evidence: evidence(url, bytes) };
    },
  };
}

test("BEL rejects missing/changed pages, cancellations, pagination, redirects and replacement PDFs", async () => {
  assert.equal(source.enabled, false); assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyBelIndexes(indexes));
  assert.throws(() => verifyBelIndexes(indexes.slice(0, 10)), /pagination incomplete/);
  const changed = [...indexes];
  changed[3] = changed[3].replace("Cancellation Notice", "Revised Cancellation Notice");
  assert.notEqual(changed[3], indexes[3]);
  assert.throws(() => verifyBelIndexes(changed), /changed/);
  changed[3] = indexes[3].replace('queryParams.set("page_num",id)', 'queryParams.set("page",id)');
  assert.throws(() => verifyBelIndexes(changed), /pagination contract changed/);
  changed[3] = indexes[3];
  changed[0] = indexes[0].replace("16-10-2026", "17-10-2026");
  assert.throws(() => verifyBelIndexes(changed), /changed/);
  changed[0] = indexes[0].replace(data.roles[0].pdfUrl, "https://bel-india.in/replacement.pdf");
  assert.throws(() => verifyBelIndexes(changed), /changed/);
  await assert.rejects(belSeptemberEngineers2026(context(undefined, "redirect")), /redirected/);
  await assert.rejects(belSeptemberEngineers2026(context(undefined, "pdf")), /PDF changed/);
});

test("BEL preserves 84 cards including undated withdrawals without treating footer links as jobs", () => {
  assert.equal(indexes.flatMap((html, i) => belNotificationCards(html, data.indexPages[i].url)).length, 84);
  const cards = belNotificationCards(indexes[3], data.indexPages[3].url);
  assert.match(cards.at(-1)!.title, /Cancellation Notice/);
  assert.ok(cards.every((card) => !card.urls.some((url) => url.includes("javascript:"))));
  assert.throws(() => belNotificationCards(indexes[0].replace("<h2>", "<h3>"), data.indexPages[0].url), /structure changed/);
});

test("BEL counts two fixed-term cycles and keeps nationality and human-language evidence distinct", async () => {
  const result = await belSeptemberEngineers2026(context());
  assert.equal(result.complete, false); assert.equal(result.cycles.length, 2); assert.equal(result.evidence.length, 13);
  const [ghaziabad, bengaluru] = result.cycles;
  assert.match(ghaziabad.outcome, /^36 posts/); assert.match(bengaluru.outcome, /^12 posts/);
  assert.equal(ghaziabad.rules?.nationality, undefined);
  assert.equal(evaluateEligibility(ghaziabad.rules, { nationality: "US", education: "diploma", exServiceman: true }).canApply.result, "needs-verification");
  assert.equal(evaluateEligibility(ghaziabad.rules, { nationality: "IN", education: "secondary" }).canApply.result, "does-not-match");
  const foreign = evaluateEligibility(bengaluru.rules, { nationality: "US", ociStatus: "yes", education: "doctorate" });
  for (const stage of [foreign.canApply, foreign.canEnterSelection, foreign.canObtainOutcome]) assert.equal(stage.result, "does-not-match");
  assert.equal(evaluateEligibility(bengaluru.rules, { nationality: "IN", education: "secondary" }).canApply.result, "does-not-match");
  assert.equal(evaluateEligibility(bengaluru.rules, { nationality: "IN", education: "bachelor", experienceYears: 15 }).canApply.result, "needs-verification");
  for (const cycle of result.cycles) {
    assert.equal(cycle.appointmentType, "contract"); assert.equal(cycle.rules?.languages, undefined);
    assert.equal(cycle.rules?.age, undefined); assert.equal(cycle.rules?.experience, undefined);
    assert.equal(cycle.rules?.residence, undefined); assert.equal(cycle.subdivisionCodes, undefined);
    assert.ok(cycle.venues.every((venue) => venue.kind === "unknown"));
    assert.ok(cycle.sources.every((item) => item.lastValidatedAt === null && item.verificationStatus === "pending-review"));
  }
  assert.match(bengaluru.languageNote!, /technical skills, not human-language frameworks/);
  assert.equal(ghaziabad.sources.at(-1)!.language, "English/Hindi"); assert.equal(bengaluru.sources.at(-1)!.language, "English");
});

test("BEL keeps retirement conflicts, unknown cutoff zones, receipt deadlines and annual editions explicit", async () => {
  const [ghaziabad, bengaluru] = (await belSeptemberEngineers2026(context())).cycles;
  assert.equal(ghaziabad.status, "uncertain"); assert.equal(bengaluru.status, "open");
  assert.match(ghaziabad.qualifications, /1 August 2026.*31 July.*1 July.*three months/);
  assert.match(ghaziabad.outcome, /Form title says fixed tenure five years/);
  assert.equal(ghaziabad.applicationWindow.opensOn, null); assert.equal(bengaluru.applicationWindow.opensOn, "2026-09-09");
  assert.match(ghaziabad.applicationWindow.note!, /receipt deadline.*not postmark/);
  for (const cycle of [ghaziabad, bengaluru]) {
    assert.equal(cycle.applicationWindow.cutoffLocalTime, null); assert.equal(cycle.applicationWindow.officialTimeZone, null);
    assert.equal(cycle.applicationWindow.precision, "date");
  }
  assert.equal(ghaziabad.applicationMethod, "post"); assert.equal(bengaluru.applicationMethod, "online");
  assert.equal((await belSeptemberEngineers2026(context(new Date("2026-09-29T23:00:00Z")))).cycles[1].status, "uncertain");
  assert.equal((await belSeptemberEngineers2026(context(new Date("2026-10-01T00:00:00Z")))).cycles[1].status, "closed");
  assert.equal((await belSeptemberEngineers2026(context(new Date("2026-10-18T00:00:00Z")))).cycles[0].status, "closed");
  assert.equal((await belSeptemberEngineers2026(context(new Date("2027-09-27T00:00:00Z")))).cycles[1].status, "closed");
});
