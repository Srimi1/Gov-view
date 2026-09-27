import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { tgSportsPhysiotherapist, verifyTgSportsIndex } from "./tg-sports-physiotherapist.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const page = readFileSync(new URL("../data/evidence/research/tg-sports-recruitment-2026.html", import.meta.url), "utf8");
const pdf = readFileSync(new URL("../data/evidence/research/tg-sports-physio-2026.pdf", import.meta.url));
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/tg-sports-physiotherapist-2026.json", import.meta.url), "utf8")) as {
  indexUrl: string; noticeUrl: string; applicationUrl: string;
};
const registry = JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[];
const source = registry.find((entry) => entry.id === "in-tg-sports-physio")!;
const evidence = (url: string, bytes: Buffer, type: string): Evidence => ({
  url, fetchedAt: "2026-09-25T05:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"),
  contentType: type, bytes: bytes.length,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T05:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => ({ text: page, evidence: evidence(url, Buffer.from(page), "text/html") }),
  fetchBytes: async (url) => ({ bytes: pdf, evidence: evidence(url, pdf, "application/pdf") }),
  ...override,
});

test("Telangana Sports visible intake title, dates and exact official links gate extraction", () => {
  verifyTgSportsIndex(page);
  assert.throws(() => verifyTgSportsIndex(page.replace("(Male Only)", "(Female Only)")), /title changed/);
  assert.throws(() => verifyTgSportsIndex(page.replace("26-09-2026 till 05:00 PM", "27-09-2026 till 05:00 PM")), /dates changed/);
  assert.throws(() => verifyTgSportsIndex(page.replace('href="https://satgrecruitment.telangana.gov.in/public/frontend/Images/Notification.pdf"', 'href="changed.pdf"')), /notice or application link changed/);
});

test("Telangana Sports has one open role, exact cutoff and no invented citizenship or language pass", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await tgSportsPhysiotherapist(context());
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 2);
  assert.equal(result.complete, false);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "open");
  assert.equal(cycle.applicationWindow.opensOn, "2026-09-23");
  assert.equal(cycle.applicationWindow.closesOn, "2026-09-26");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "17:00");
  assert.deepEqual(cycle.subdivisionCodes, ["IN-TG"]);
  assert.equal(cycle.applicationUrl, extraction.applicationUrl);
  assert.equal(cycle.venues.length, 0);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.equal(cycle.rules?.asOn, null);
  assert.match(cycle.citizenshipRule, /foreign-university degree.*qualification only/i);
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", education: "master", experienceYears: 3 }).canApply.result, "needs-verification");
  assert.equal((await tgSportsPhysiotherapist(context({ now: new Date("2026-09-27T00:00:00Z") }))).cycles[0].status, "closed");
});

test("Telangana Sports changed PDF cannot reuse extracted qualification or deadline", async () => {
  await assert.rejects(() => tgSportsPhysiotherapist(context({ fetchBytes: async (url) => {
    const bytes = Buffer.concat([pdf, Buffer.from("changed")]);
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /notice PDF changed/);
});
