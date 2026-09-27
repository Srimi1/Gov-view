import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { btsc, BTSC_INDEX, parseBtscPage } from "./btsc.ts";
import type { ConnectorContext, SourceConfig } from "./types.ts";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";

const root = new URL("../data/evidence/research/", import.meta.url);
const read = (file: string) => readFileSync(new URL(file, root));
const pages = Array.from({ length: 7 }, (_, index) => read(`btsc-page-${index}.html`).toString());
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((source) => source.id === "in-br-btsc")!;
const documents = new Map(["28", "27"].map((number) => {
  const evidence = JSON.parse(read(`btsc-${number}-2026.json`).toString());
  return [evidence.url as string, { evidence, bytes: read(`btsc-${number}-2026.pdf`) }];
}));
const context = (overrides: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => { const text = pages[Number(new URL(url).searchParams.get("page"))]; return { text, evidence: { url, sha256: createHash("sha256").update(text).digest("hex"), fetchedAt: "2026-09-25T00:00:00Z", contentType: "text/html", bytes: Buffer.byteLength(text) } }; },
  fetchBytes: async (url) => { const doc = documents.get(url); if (!doc) throw new Error("Document unavailable in this test"); return doc; },
  ...overrides,
});

test("BTSC nested document tables retain all register rows and separate deadline fields", () => {
  const parsed = parseBtscPage(pages[0], BTSC_INDEX);
  assert.equal(parsed.entries.length, 10);
  assert.equal(parsed.next, "https://btsc.bihar.gov.in/recruitment?page=1");
  const first = parsed.entries[0];
  assert.equal(first.number, "28/2026");
  assert.equal(first.documents[0].url, "https://btsc.bihar.gov.in/sites/default/files/Advertisement/28_2026.pdf");
  assert.equal(first.opensOn, "2026-09-24");
  const altered = pages[0].replace(/(headers="view-field-payment-last-day-table-column"[^>]*>)23\/10\/2026/, "$130/10/2026");
  const changed = parseBtscPage(altered, BTSC_INDEX).entries[0];
  assert.equal(changed.paymentClosesOn, "2026-10-30");
  assert.equal(changed.closesOn, "2026-10-23");
  assert.equal(parseBtscPage(pages[2], "https://btsc.bihar.gov.in/recruitment?page=2").entries[8].number, "32/2025");
});

test("BTSC follows all pages, holds conflicting annual identities and counts recent advertisements once", async () => {
  const visited: string[] = [];
  const original = context();
  const result = await btsc(context({ fetchText: async (url) => { visited.push(url); return original.fetchText(url); } }));
  assert.equal(visited.length, 7);
  assert.deepEqual(result.cycles.map((cycle) => cycle.cycleLabel), ["28/2026", "27/2026", "26/2026", "25/2026"]);
  assert.ok(result.warnings.some((warning) => /Conflicting BTSC identifier 18\/2025/.test(warning)));
  assert.ok(result.warnings.some((warning) => /Conflicting BTSC identifier 23\/2025/.test(warning)));
  assert.ok(!result.cycles.some((cycle) => cycle.id === "btsc-2026-18"));
  assert.ok(result.cycles.every((cycle) => cycle.venues.every((venue) => venue.kind === "unknown")));
  assert.ok(result.cycles.every((cycle) => cycle.applicationWindow.cutoffLocalTime === null));
  assert.equal(source.reviewRequired, true);
  assert.equal(source.enabled, false);
});

test("BTSC scanned nationality applies only to its exact notice; domicile benefit is not an application ban", async () => {
  const result = await btsc(context());
  const fishery = result.cycles.find((cycle) => cycle.cycleLabel === "28/2026")!;
  const veterinarian = result.cycles.find((cycle) => cycle.cycleLabel === "27/2026")!;
  assert.deepEqual(fishery.rules?.nationality?.allowed, ["IN"]);
  assert.equal(veterinarian.rules, null);
  assert.equal(fishery.rules?.residence, undefined);
  assert.equal(fishery.rules?.languages, undefined);
  assert.match(fishery.selectionStages.join(" "), /paper supplied in Hindi and English/);
  assert.match(fishery.residenceRule, /not a blanket ban/);
  const foreign = evaluateEligibility(fishery.rules, { nationality: "US" });
  assert.equal(foreign.canApply.result, "does-not-match");
  const otherState = evaluateEligibility(fishery.rules, { nationality: "IN", residenceCountry: "IN", residenceSubdivision: "IN-MH" });
  assert.equal(otherState.canApply.result, "needs-verification");
  assert.ok(result.warnings.some((warning) => /35 marks.*25/.test(warning)));
});

test("BTSC changed scan bytes or additional document suppresses old applicant rules", async () => {
  const original = context();
  const result = await btsc(context({ fetchBytes: async (url) => { const doc = await original.fetchBytes!(url); return { ...doc, bytes: Buffer.concat([doc.bytes, Buffer.from("amended")]) }; } }));
  assert.equal(result.cycles[0].rules, null);
  assert.ok(result.warnings.some((warning) => /old applicant-rule extraction withheld/.test(warning)));
  const additional = pages[0].replace('>Advertisement</a>', '>Advertisement</a><a href="/sites/default/files/Advertisement/amendment.pdf">Amendment</a>');
  const result2 = await btsc(context({ fetchText: async (url) => { const fetched = await original.fetchText(url); return url === BTSC_INDEX ? { ...fetched, text: additional } : fetched; } }));
  assert.equal(result2.cycles[0].rules, null);
});

test("BTSC missing page aborts complete-register collection; failed PDF keeps index evidence explicit", async () => {
  const original = context();
  await assert.rejects(() => btsc(context({ fetchText: async (url) => { if (url.endsWith("page=1")) throw new Error("HTTP 503"); return original.fetchText(url); } })), /HTTP 503/);
  const result = await btsc(context({ fetchBytes: async () => { throw new Error("HTTP 503"); } }));
  assert.equal(result.cycles[0].rules, null);
  assert.ok(result.cycles[0].sources.filter((source) => source.format === "PDF").every((source) => source.lastSuccessfulFetchAt === null && !source.sha256));
  assert.ok(result.cycles[0].sources.some((source) => source.format === "HTML" && !!source.sha256));
});

test("BTSC unsafe pagination, off-domain documents and missing named dates fail closed", () => {
  assert.throws(() => parseBtscPage(pages[0].replace('href="?page=1" class="pager__link" title="Go to next page"', 'href="https://evil.example/?page=1" class="pager__link" title="Go to next page"'), BTSC_INDEX), /pagination changed/);
  assert.throws(() => parseBtscPage(pages[0].replaceAll('href="/sites/default/files/Advertisement/', 'href="https://evil.example/sites/default/files/Advertisement/'), BTSC_INDEX), /outside official archive/);
  assert.throws(() => parseBtscPage(pages[0].replaceAll('headers="view-field-application-last-date-table-column"', 'headers="unknown-date"'), BTSC_INDEX), /date fields need review/);
});
