import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { UKPSC_RECRUITMENT_INDEX, checkUttarakhandIndex, uttarakhandPsc } from "./uttarakhand-psc.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const read = (name: string) => readFileSync(new URL(`../data/evidence/research/${name}`, import.meta.url));
const html = read("uttarakhand-psc-recruitment-2026.html").toString();
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/ukpsc-pcs-a1-2026-27.json", import.meta.url), "utf8")) as {
  documents: { key: string; url: string; sha256: string }[];
};
const pdfs = new Map(extraction.documents.map((document) => [document.url, read(`uttarakhand-psc-${document.url.split("/").at(-1)}`)]));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-ut-recruitment")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => { assert.equal(url, UKPSC_RECRUITMENT_INDEX); return { text: html, evidence: evidence(url, Buffer.from(html), "text/html") }; },
  fetchBytes: async (url) => { const bytes = pdfs.get(url); assert.ok(bytes, `unexpected PDF ${url}`); return { bytes, evidence: evidence(url, bytes, "application/pdf") }; },
  ...override,
});

test("UKPSC nested register binds one original notice and rejects changed or new earlier rows", () => {
  assert.doesNotThrow(() => checkUttarakhandIndex(html));
  assert.throws(() => checkUttarakhandIndex(html.replace("1843959203.pdf", "1843959204.pdf")), /PDF set changed|index row missing/);
  assert.throws(() => checkUttarakhandIndex(html.replace("29-09-2026", "30-09-2026")), /dates changed/);
  assert.throws(() => checkUttarakhandIndex(html.replace('<tbody>', '<tbody><tr><td><a href="/public/uploads/recruitment/new.pdf">New correction</a></td></tr>')), /new earlier notice/);
});

test("UKPSC draft has one application, exact cutoff and cautious international assessment", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await uttarakhandPsc(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 4);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "open");
  assert.equal(cycle.applicationWindow.closesOn, "2026-09-29");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "23:59:59");
  assert.equal(cycle.applicationWindow.precision, "second");
  assert.equal(cycle.applicationWindow.cutoffInclusive, true);
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.match(cycle.outcome, /67.*16 post codes/);
  assert.match(cycle.citizenshipRule, /Tibetan refugees/);
  assert.match(cycle.residenceRule, /unreserved consideration/);
  assert.match(cycle.rules?.languages?.[0].requirement ?? "", /General Hindi.*35%/);
  assert.equal(cycle.rules?.nationality, undefined);
  for (const stage of Object.values(evaluateEligibility(cycle.rules, { nationality: "US", education: "bachelor" }))) assert.equal(stage.result, "needs-verification");
  assert.equal((await uttarakhandPsc(context({ now: new Date("2026-09-29T23:59:59+05:30") }))).cycles[0].status, "open");
  assert.equal((await uttarakhandPsc(context({ now: new Date("2026-09-30T00:00:00+05:30") }))).cycles[0].status, "closed");
});

test("UKPSC changed PDF cannot reuse old critical fields", async () => {
  const changedUrl = extraction.documents[1].url;
  await assert.rejects(() => uttarakhandPsc(context({ fetchBytes: async (url) => {
    const original = pdfs.get(url)!;
    const bytes = url === changedUrl ? Buffer.concat([original, Buffer.from("changed")]) : original;
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /PDF changed/);
});
