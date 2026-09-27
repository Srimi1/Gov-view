import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { nbemsFmge, verifyFmgeOctoberIndex } from "./nbems-fmge.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";

const index = readFileSync(new URL("../data/evidence/research/nbems-fmge-index-sept-2026.html", import.meta.url), "utf8");
const pdf = readFileSync(new URL("../data/evidence/research/nbems-fmge-oct-2026-v22.pdf", import.meta.url));
const registry = JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[];
const source = registry.find((item) => item.id === "in-nbems-fmge")!;
const bulletinUrl = "https://nbe.edu.in/IB/FMGE%20october%202026%20information%20bulletin%20v2.2.pdf";
const evidence = (url: string, bytes: Buffer, type: string): Evidence => ({
  url, fetchedAt: "2026-09-25T12:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"),
  contentType: type, bytes: bytes.length,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T12:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => ({ text: index, evidence: evidence(url, Buffer.from(index), "text/html") }),
  fetchBytes: async (url) => ({ bytes: pdf, evidence: evidence(url, pdf, "application/pdf") }),
  ...override,
});

test("FMGE October index binds one official bulletin and application link", () => {
  assert.doesNotThrow(() => verifyFmgeOctoberIndex(index));
  assert.throws(() => verifyFmgeOctoberIndex(index.replace("FMGE%20october%202026%20information%20bulletin%20v2.2.pdf", "changed.pdf")), /bulletin or application link changed/);
  assert.throws(() => verifyFmgeOctoberIndex(index.replace("100817//Index.html", "changed/Index.html")), /bulletin or application link changed/);
});

test("FMGE draft distinguishes application, exam, language and medical registration", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await nbemsFmge(context());
  assert.equal(result.cycles.length, 1);
  assert.equal(result.complete, false);
  const cycle = result.cycles[0];
  assert.equal(cycle.pathway, "licensing");
  assert.equal(cycle.status, "open");
  assert.equal(cycle.applicationWindow.closesOn, "2026-09-25");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "23:55");
  assert.equal(cycle.applicationWindow.officialTimeZone, "Asia/Kolkata");
  assert.match(cycle.outcome, /does not guarantee a licence/);
  assert.match(cycle.citizenshipRule, /Nepalese exception/);
  assert.match(cycle.languageNote ?? "", /no CEFR/);
  assert.equal(cycle.rules?.nationality?.ociAccepted, true);
  assert.deepEqual(cycle.rules?.nationality?.uncertain, ["NP"]);
  assert.equal(cycle.rules?.languages, undefined); // English exam medium is not a proficiency level.
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "NP", education: "bachelor" }).canApply.result, "needs-verification");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", education: "bachelor" }).canApply.result, "needs-verification");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", ociStatus: "no", education: "bachelor" }).canApply.result, "does-not-match");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", ociStatus: "yes", education: "bachelor" }).canApply.result, "needs-verification");
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(cycle.sources[1].sha256, evidence(bulletinUrl, pdf, "application/pdf").sha256);
  assert.equal((await nbemsFmge(context({ now: new Date("2026-09-25T18:25:30Z") }))).cycles[0].status, "open");
  assert.equal((await nbemsFmge(context({ now: new Date("2026-09-25T18:26:00Z") }))).cycles[0].status, "closed");
});

test("FMGE changed original PDF cannot reuse the extracted licensing terms", async () => {
  await assert.rejects(() => nbemsFmge(context({ fetchBytes: async (url) => {
    const bytes = Buffer.concat([pdf, Buffer.from("changed")]);
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /bulletin changed/);
});
