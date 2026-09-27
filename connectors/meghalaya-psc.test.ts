import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { MEGHALAYA_INDEX, meghalayaPsc, parseMeghalayaIndex } from "./meghalaya-psc.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const root = new URL("../data/evidence/research/", import.meta.url);
const html = readFileSync(new URL("meghalaya-advertisements.html", root), "utf8");
const documents = new Map([
  ["https://mpsc.meghalaya.gov.in/advt/Advt25May2026.pdf", readFileSync(new URL("meghalaya-03-2026.pdf", root))],
  ["https://mpsc.meghalaya.gov.in/notify/Notice03June2026a.pdf", readFileSync(new URL("meghalaya-03-2026-fishery-age.pdf", root))],
  ["https://mpsc.meghalaya.gov.in/notify/Notice24June2026a.pdf", readFileSync(new URL("meghalaya-03-2026-coach-addendum.pdf", root))],
]);
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-ml-recruitment")!;
const evidence = (url: string, bytes: Buffer): Evidence => ({ url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType: url.endsWith(".pdf") ? "application/pdf" : "text/html", bytes: bytes.length });
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => ({ text: html, evidence: evidence(url, Buffer.from(html)) }),
  fetchBytes: async (url) => { const bytes = documents.get(url); if (!bytes) throw Error(`unexpected URL ${url}`); return { bytes, evidence: evidence(url, bytes) }; },
  ...override,
});

test("Meghalaya index groups original and both corrections without unrelated notices", () => {
  assert.equal(parseMeghalayaIndex(html).length, 3);
  assert.throws(() => parseMeghalayaIndex(html.replace("notify/Notice03June2026a.pdf", "https://example.org/age.pdf")), /outside official PDF folders/);
  assert.throws(() => parseMeghalayaIndex(html.replace("notify/Notice24June2026a.pdf", "notify/new-addendum.pdf")), /document set changed/);
  assert.throws(() => parseMeghalayaIndex(html.replace("advt/Advt25May2026.pdf", "notify/Notice03June2026a.pdf")), /duplicate document rows/);
});

test("Meghalaya posts stay two cycles with separate amended rules and five city-level centres", async () => {
  const result = await meghalayaPsc(context());
  assert.equal(source.homepage, MEGHALAYA_INDEX);
  assert.equal(source.reviewRequired, true);
  assert.equal(source.enabled, false);
  assert.equal(result.cycles.length, 2);
  const fishery = result.cycles.find((cycle) => cycle.cycleLabel.includes("Post 01"))!;
  const coach = result.cycles.find((cycle) => cycle.cycleLabel.includes("Post 02"))!;
  assert.equal(fishery.status, "closed");
  assert.equal(fishery.applicationWindow.closesOn, "2026-06-25");
  assert.equal(coach.applicationWindow.closesOn, "2026-06-30");
  assert.ok(coach.qualifications.includes("BSc Sports Coaching"));
  assert.equal(coach.changes.filter((change) => change.kind === "extended").length, 1);
  assert.ok(fishery.rules?.manualChecks?.some((check) => check.text.includes("amended age 18–32")));
  assert.equal(fishery.venues.length, 5);
  assert.ok(fishery.venues.every((venue) => venue.kind === "published" && venue.precision === "city"));
  assert.equal(result.cycles.reduce((count) => count + 1, 0), 2);
  assert.equal(evaluateEligibility(fishery.rules, { nationality: "US" }).canApply.result, "does-not-match");
  assert.equal(evaluateEligibility(coach.rules, { nationality: "IN" }).canApply.result, "needs-verification");
  assert.equal(coach.rules?.languages?.[0].framework, undefined);
  assert.ok(coach.sources.every((item) => item.lastValidatedAt === null));
});

test("Meghalaya changed scanned amendment withholds all extracted critical fields", async () => {
  const modifiedUrl = "https://mpsc.meghalaya.gov.in/notify/Notice24June2026a.pdf";
  await assert.rejects(() => meghalayaPsc(context({ fetchBytes: async (url) => {
    const base = documents.get(url)!;
    const bytes = url === modifiedUrl ? Buffer.concat([base, Buffer.from("changed")]) : base;
    return { bytes, evidence: evidence(url, bytes) };
  } })), /PDF changed/);
});
