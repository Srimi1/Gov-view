import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { checkWbpscPages, WBPSC_PAGES, WBPSC_PDFS, wbpsc } from "./wbpsc.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const research = (name: string) => readFileSync(new URL(`../data/evidence/research/${name}`, import.meta.url));
const pages = ["wbpsc-home.html", "wbpsc-announcements.html"].map((name) => research(name).toString());
const pdfs = ["wbpsc-05-2026.pdf", "wbpsc-05-2026-extension.pdf", "wbpsc-05-2026-indicative.pdf"].map(research);
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-wb-recruitment")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType, bytes: bytes.length,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => {
    const position = WBPSC_PAGES.indexOf(url as typeof WBPSC_PAGES[number]);
    assert.notEqual(position, -1);
    const text = pages[position];
    return { text, evidence: evidence(url, Buffer.from(text), "text/html") };
  },
  fetchBytes: async (url) => {
    const position = WBPSC_PDFS.indexOf(url);
    assert.notEqual(position, -1);
    const bytes = pdfs[position];
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  },
  ...override,
});

test("WBPSC 05/2026 homepage, extension and indicative rows stay bound", () => {
  assert.doesNotThrow(() => checkWbpscPages(pages[0], pages[1]));
  assert.throws(() => checkWbpscPages(pages[0].replace("Ad_20260513181624_05_2026_ADVT.pdf", "changed.pdf"), pages[1]), /homepage advertisement changed/);
  assert.throws(() => checkWbpscPages(pages[0], pages[1].replace("Notice_for_extension_of_Online_Application_date.pdf", "replacement.pdf")), /announcements changed/);
});

test("WBPSC extension closes one Principal application; later edit window cannot reopen it", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await wbpsc(context());
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 5);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "closed");
  assert.equal(cycle.applicationWindow.opensOn, null);
  assert.equal(cycle.applicationWindow.closesOn, "2026-06-03");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "15:00");
  assert.match(cycle.statusNote, /never began/);
  assert.match(cycle.outcome, /12/);
  assert.equal(cycle.venues[0].kind, "unknown");
});

test("International eligibility, Bengali exception and age relaxations remain conditional", async () => {
  const { cycles: [cycle] } = await wbpsc(context());
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.age, undefined);
  assert.equal(cycle.rules?.education?.minLevel, "master");
  assert.equal(cycle.rules?.experience?.minYears, 5);
  assert.equal(cycle.rules?.languages?.[0].minimumLevel, undefined);
  assert.match(cycle.rules!.languages![0].requirement, /exempts Nepali mother-tongue/);
  for (const nationality of ["IN", "NP", "US"]) {
    const result = evaluateEligibility(cycle.rules, { nationality, education: "master", experienceYears: 5, dateOfBirth: "1980-01-01" });
    assert.equal(result.canApply.result, "needs-verification");
    assert.equal(result.canObtainOutcome.result, "needs-verification");
  }
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN", education: "bachelor", experienceYears: 5 }).canApply.result, "does-not-match");
});

test("Changed WBPSC document cannot reuse deadline or applicant conditions", async () => {
  for (const changedUrl of WBPSC_PDFS) {
    await assert.rejects(() => wbpsc(context({ fetchBytes: async (url) => {
      const position = WBPSC_PDFS.indexOf(url);
      const bytes = Buffer.concat([pdfs[position], Buffer.from(url === changedUrl ? "changed" : "")]);
      return { bytes, evidence: evidence(url, bytes, "application/pdf") };
    } })), /PDF changed/);
  }
});
