import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { languageName } from "../lib/eligibility/languages.ts";
import { checkHsscIndex, checkHsscPublicNotices, HSSC_EXTENSION, HSSC_GROUP_C, HSSC_INDEX, HSSC_ORIGINAL, HSSC_PUBLIC_NOTICES, haryanaSsc } from "./haryana-ssc.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const read = (name: string) => readFileSync(new URL(`../data/evidence/research/${name}`, import.meta.url));
const index = read("hssc-advertisements-2026-09-25.html").toString();
const notices = read("hssc-public-notices-2026-09-25.html").toString();
const original = read("hssc-05-2026-original.pdf");
const extension = read("hssc-05-2026-extension.pdf");
const groupC = read("hssc-06-2026.pdf");
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-hr-hssc")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType, bytes: bytes.length,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => {
    assert.ok(url === HSSC_INDEX || url === HSSC_PUBLIC_NOTICES);
    const text = url === HSSC_INDEX ? index : notices;
    return { text, evidence: evidence(url, Buffer.from(text), "text/html") };
  },
  fetchBytes: async (url) => {
    const bytes = url === HSSC_ORIGINAL ? original : url === HSSC_EXTENSION ? extension : url === HSSC_GROUP_C ? groupC : null;
    assert.ok(bytes);
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  },
  ...override,
});

test("HSSC register ties both advertisements and extension to exact dated rows", () => {
  assert.doesNotThrow(() => checkHsscIndex(index));
  assert.throws(() => checkHsscIndex(index.replace("2026-07-03</td>", "2026-07-04</td>")), /register changed/);
  assert.throws(() => checkHsscIndex(index.replace("ac1f23cd-9d9c-1328-819f-293dcbcf0080", "changed")), /register changed/);
  assert.throws(() => checkHsscIndex(index.replace("Advt. No. 06/2026 (Group-C)", "Advt. No. 05/2026 (Group-D) Correction")), /register changed/);
  assert.throws(() => checkHsscIndex(index.replace("ac1f23cd-9d9c-1328-819e-ef25fa0a0061", "changed")), /register changed/);
  assert.doesNotThrow(() => checkHsscPublicNotices(notices));
  assert.throws(() => checkHsscPublicNotices(notices.replace("2026-08-03 </td>", "2026-08-04 </td>")), /public-notice set changed/);
  assert.throws(() => checkHsscPublicNotices(notices.replace("</tbody>", '<tr><td>06/2026 new correction</td><td>2026-09-25</td><td><a href="/new.pdf">PDF</a></td></tr></tbody>')), /public-notice set changed/);
});

test("HSSC stages closed Group-D CET and Group-C prison applications without venue duplication", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await haryanaSsc(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 2);
  assert.equal(result.evidence.length, 5);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "closed");
  assert.equal(cycle.applicationWindow.opensOn, "2026-06-19");
  assert.equal(cycle.applicationWindow.closesOn, "2026-07-05");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "23:59");
  assert.equal(cycle.changes[0].kind, "extended");
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.match(cycle.scopeLabel, /count is unknown/);
  assert.match(cycle.statusNote, /fee and correction periods do not reopen/);
  const prison = result.cycles[1];
  assert.equal(prison.status, "closed");
  assert.equal(prison.applicationWindow.closesOn, "2026-06-30");
  assert.equal(prison.applicationWindow.cutoffLocalTime, "23:59");
  assert.match(prison.scopeLabel, /1,238/);
  assert.match(prison.qualifications, /21–27.*18–25/);
  assert.match(prison.fee, /no fee/);
  assert.equal(prison.venues[0].kind, "unknown");
  assert.equal(prison.sources.filter((source) => source.fetchStatus === "linked").length, 3);
  assert.equal(prison.changes.length, 0);
});

test("HSSC conditional international CET entry and alternative language rule stay evidence-bound", async () => {
  const { cycles: [cycle] } = await haryanaSsc(context());
  const rules = cycle.rules!;
  assert.deepEqual(rules.nationality?.allowed, ["IN"]);
  assert.deepEqual(rules.nationality?.conditional, ["NP", "BT"]);
  assert.equal(rules.nationality?.stage, "selection");
  assert.equal(languageName(rules.languages![0].language), "Hindi or Sanskrit");
  assert.match(rules.languages![0].requirement, /higher standard/);
  assert.equal(rules.languages![0].minimumLevel, undefined);
  for (const nationality of ["NP", "BT"]) {
    const report = evaluateEligibility(rules, { nationality, education: "secondary", dateOfBirth: "2000-01-01" });
    assert.equal(report.canEnterSelection.result, "needs-verification");
    assert.match(report.canEnterSelection.checks.find((check) => check.rule === "nationality")!.reason, /extra certificate/);
  }
  const us = evaluateEligibility(rules, { nationality: "US", education: "secondary", dateOfBirth: "2000-01-01" });
  assert.equal(us.canApply.result, "needs-verification");
  assert.equal(us.canApply.checks.some((check) => check.rule === "nationality"), false);
  assert.equal(us.canEnterSelection.result, "does-not-match");
  assert.equal(us.canObtainOutcome.result, "does-not-match");
  const india = evaluateEligibility(rules, { nationality: "IN", education: "secondary", dateOfBirth: "2000-01-01" });
  assert.equal(india.canEnterSelection.result, "needs-verification");
  assert.equal(india.canEnterSelection.checks.find((check) => check.rule === "language")?.result, "needs-verification");
  const prison = (await haryanaSsc(context())).cycles[1];
  assert.equal(prison.rules?.nationality?.stage, "selection");
  assert.equal(prison.rules?.languages?.[0].minimumLevel, undefined);
  assert.equal(evaluateEligibility(prison.rules, { nationality: "US" }).canApply.result, "needs-verification");
  assert.equal(evaluateEligibility(prison.rules, { nationality: "US" }).canEnterSelection.result, "does-not-match");
});

test("changed HSSC original or extension PDF withholds retained eligibility and cutoff", async () => {
  for (const alteredUrl of [HSSC_ORIGINAL, HSSC_EXTENSION, HSSC_GROUP_C]) {
    await assert.rejects(() => haryanaSsc(context({ fetchBytes: async (url) => {
      const bytes = Buffer.concat([url === HSSC_ORIGINAL ? original : url === HSSC_EXTENSION ? extension : groupC, Buffer.from(url === alteredUrl ? "changed" : "")]);
      return { bytes, evidence: evidence(url, bytes, "application/pdf") };
    } })), /PDF changed/);
  }
});
