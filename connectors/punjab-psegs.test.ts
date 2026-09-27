import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { checkPunjabDitIndex, checkPunjabStateIndex, PUNJAB_DIT_INDEX, PUNJAB_PDFS, PUNJAB_STATE_INDEX, punjabPsegs } from "./punjab-psegs.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const read = (name: string) => readFileSync(new URL(`../data/evidence/research/${name}`, import.meta.url));
const state = read("punjab-state-recruitments-2026-09-25.html").toString();
const department = read("punjab-dit-home-2026-09-25.html").toString();
const detailed = read("punjab-dgm-cyber-2026.pdf");
const newspaper = read("punjab-dgm-cyber-newspaper-2026.pdf");
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-pb-psegs")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType, bytes: bytes.length,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => {
    assert.ok(url === PUNJAB_STATE_INDEX || url === PUNJAB_DIT_INDEX);
    const text = url === PUNJAB_STATE_INDEX ? state : department;
    return { text, evidence: evidence(url, Buffer.from(text), "text/html") };
  },
  fetchBytes: async (url) => {
    assert.ok(PUNJAB_PDFS.includes(url as typeof PUNJAB_PDFS[number]));
    const bytes = url.includes("Detailed-") ? detailed : newspaper;
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  },
  ...override,
});

test("Punjab state and DGG&IT bind matching DGM notices and dated recruitment row", () => {
  assert.doesNotThrow(() => checkPunjabStateIndex(state));
  assert.doesNotThrow(() => checkPunjabDitIndex(department));
  assert.throws(() => checkPunjabStateIndex(state.replace("08-10-2026", "09-10-2026")), /deadline or department changed/);
  assert.throws(() => checkPunjabStateIndex(state.replace("Detailed-Advertisement-for-the-position-of-DGM-Technical-Cyber-Security.pdf", "changed.pdf")), /links changed/);
  assert.throws(() => checkPunjabDitIndex(department.replace("Newspaper-Advertisement-for-the-position-of-DGM-Technical-Cyber-Security.pdf", "changed.pdf")), /links changed/);
});

test("Punjab DGM draft retains exact time, contract type, fee and safe official information URL", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await punjabPsegs(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 6);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "open");
  assert.equal(cycle.applicationWindow.opensOn, null);
  assert.equal(cycle.applicationWindow.closesOn, "2026-10-08");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "23:59");
  assert.match(cycle.outcome, /2-year contract/);
  assert.match(cycle.fee, /₹2,000/);
  assert.ok(cycle.applicationUrl?.startsWith("https://dit.punjab.gov.in/"));
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(cycle.changes.length, 0);
});

test("Punjab DGM international status stays uncertain and Punjabi test remains notice-specific", async () => {
  const { cycles: [cycle] } = await punjabPsegs(context());
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.age?.max, 42);
  assert.equal(cycle.rules?.experience?.minYears, 13);
  assert.equal(cycle.rules?.languages?.[0].language, "pa");
  assert.equal(cycle.rules?.languages?.[0].minimumLevel, undefined);
  assert.match(cycle.rules!.languages![0].requirement, /six months after appointment/);
  for (const nationality of ["IN", "US"]) {
    const report = evaluateEligibility(cycle.rules, { nationality, dateOfBirth: "1995-01-01", education: "bachelor", experienceYears: 13 });
    assert.equal(report.canApply.result, "needs-verification");
    assert.equal(report.canObtainOutcome.result, "needs-verification");
  }
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN", dateOfBirth: "1980-01-01", education: "bachelor", experienceYears: 13 }).canApply.result, "does-not-match");
});

test("Punjab DGM document changes withhold retained deadline and applicant rules", async () => {
  for (const changedUrl of PUNJAB_PDFS) {
    await assert.rejects(() => punjabPsegs(context({ fetchBytes: async (url) => {
      const bytes = Buffer.concat([url.includes("Detailed-") ? detailed : newspaper, Buffer.from(url === changedUrl ? "changed" : "")]);
      return { bytes, evidence: evidence(url, bytes, "application/pdf") };
    } })), /PDF changed/);
  }
});
