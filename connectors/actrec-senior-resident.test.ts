import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { actrecSeniorResident, parseActrecSeniorResidentIndex } from "./actrec-senior-resident.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";

const index = readFileSync(new URL("../data/evidence/research/actrec-jobs-2026.html", import.meta.url), "utf8");
const pdf = readFileSync(new URL("../data/evidence/research/actrec-senior-resident-198-2026.pdf", import.meta.url));
const registry = JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[];
const source = registry.find((item) => item.id === "in-mh-actrec")!;
const expectedPdf = "https://www.actrec.gov.in/sites/default/files/2026-09/FINAL%20ADVT-%20Senior%20Resident%20%28Transfusion%20Medicine%29FINAL.pdf";
const evidence = (url: string, bytes: Buffer, type: string): Evidence => ({ url, fetchedAt: "2026-09-25T03:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType: type, bytes: bytes.length });
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T03:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => ({ text: index, evidence: evidence(url, Buffer.from(index), "text/html") }),
  fetchBytes: async (url) => ({ bytes: pdf, evidence: evidence(url, pdf, "application/pdf") }),
  ...override,
});

test("ACTREC official row binds one exact notice, application route and index dates", () => {
  const row = parseActrecSeniorResidentIndex(index);
  assert.equal(row.pdfUrl, expectedPdf);
  assert.equal(row.closesOn, "2026-10-08");
  assert.equal(row.applicationUrl, "https://webapps.actrec.gov.in/actjrfapp/frm_Registration.aspx");
  assert.throws(() => parseActrecSeniorResidentIndex(index.replace("Senior%20Resident%20%28Transfusion%20Medicine%29FINAL.pdf", "changed.pdf")), /PDF, application link or date range changed/);
  assert.throws(() => parseActrecSeniorResidentIndex(index + index), /missing or duplicated/);
});

test("ACTREC senior resident draft separates Indian nationality, language, fee and joining deposit", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await actrecSeniorResident(context());
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 2);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "open");
  assert.equal(cycle.applicationWindow.opensOn, null);
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "17:30");
  assert.equal(cycle.applicationWindow.officialTimeZone, "Asia/Kolkata");
  assert.match(cycle.scopeLabel, /non-permanent residency/);
  assert.match(cycle.citizenshipRule, /Indian nationals/);
  assert.match(cycle.fee, /Separate .*caution deposit/);
  assert.equal(cycle.rules?.languages, undefined);
  assert.equal(cycle.sources[1].sha256, evidence(expectedPdf, pdf, "application/pdf").sha256);
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", education: "doctorate" }).canApply.result, "does-not-match");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN", education: "master", educationField: "Transfusion Medicine" }).canApply.result, "needs-verification");
  const after = await actrecSeniorResident(context({ now: new Date("2026-10-08T12:00:00Z") }));
  assert.equal(after.cycles[0].status, "closed");
});

test("ACTREC changed PDF or index cannot reuse nationality and deadline", async () => {
  await assert.rejects(() => actrecSeniorResident(context({ fetchBytes: async (url) => {
    const bytes = Buffer.concat([pdf, Buffer.from("changed")]);
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /PDF changed/);
  await assert.rejects(() => actrecSeniorResident(context({ fetchText: async (url) => {
    const text = index.replace("08/10/2026", "09/10/2026");
    return { text, evidence: evidence(url, Buffer.from(text), "text/html") };
  } })), /PDF, application link or date range changed/);
});
