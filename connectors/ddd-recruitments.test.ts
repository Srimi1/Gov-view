import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { DDD_RECRUITMENT_INDEX, checkDddRecruitmentIndex, dddRecruitments } from "./ddd-recruitments.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const read = (name: string) => readFileSync(new URL(`../data/evidence/research/${name}`, import.meta.url));
const html = read("ddd-recruitments-2026.html").toString();
const rows = (JSON.parse(readFileSync(new URL("../data/extractions/ddd-recruitments-september-2026.json", import.meta.url), "utf8")) as { rows: { key: string; url: string }[] }).rows;
const pdfs = new Map(rows.map((row) => [row.url, read(`ddd-${row.url.split("/").at(-1)}`)]));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-dh-recruitment")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => { assert.equal(url, DDD_RECRUITMENT_INDEX); return { text: html, evidence: evidence(url, Buffer.from(html), "text/html") }; },
  fetchBytes: async (url) => { const bytes = pdfs.get(url); assert.ok(bytes, `unexpected PDF ${url}`); return { bytes, evidence: evidence(url, bytes, "application/pdf") }; },
  ...override,
});

test("DNH & DD register binds four exact notices and holds new or amended rows", () => {
  assert.doesNotThrow(() => checkDddRecruitmentIndex(html));
  assert.throws(() => checkDddRecruitmentIndex(html.replace("15/10/2026", "16/10/2026")), /dates changed/);
  assert.throws(() => checkDddRecruitmentIndex(html.replace("202609151067779559.pdf", "202609151067779560.pdf")), /document link changed/);
  assert.throws(() => checkDddRecruitmentIndex(html.replace("<tbody>", "<tbody><tr><td>0</td></tr>")), /row set changed/);
});

test("three government intakes retain job type, foreign uncertainty, language and different cutoffs", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await dddRecruitments(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 3);
  assert.equal(result.evidence.length, 5);
  assert.equal(new Set(result.cycles.map((cycle) => cycle.id)).size, 3);
  assert.equal(result.cycles.some((cycle) => /Sarvajanik/i.test(cycle.title)), false);
  const [poly, college, hospital] = result.cycles;
  assert.equal(poly.status, "open");
  assert.equal(poly.applicationWindow.cutoffLocalTime, "17:00");
  assert.match(poly.qualifications, /Plastic Engineering/);
  assert.equal(poly.rules?.languages?.[0].mandatory, false);
  assert.equal(college.applicationWindow.closesOn, "2026-10-09");
  assert.match(college.qualifications, /B\.E\.\/B\.Tech\. and M\.E\.\/M\.Tech\./);
  assert.equal(hospital.status, "uncertain");
  assert.equal(hospital.applicationWindow.opensOn, null);
  assert.equal(hospital.applicationWindow.cutoffLocalTime, "17:30");
  assert.match(hospital.outcome, /Anaesthetist 2.*General Surgeon 1/);
  assert.equal(hospital.venues[0].kind, "published");
  if (hospital.venues[0].kind === "published") assert.equal(hospital.venues[0].precision, "city");
  for (const cycle of result.cycles) {
    assert.equal(cycle.rules?.nationality, undefined);
    assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", education: "master" }).canApply.result, "needs-verification");
    assert.equal(cycle.rules?.languages?.some((language) => Boolean(language.minimumLevel)) ?? false, false);
  }
  assert.equal((await dddRecruitments(context({ now: new Date("2026-10-15T16:59:00+05:30") }))).cycles[0].status, "open");
  const atCutoff = (await dddRecruitments(context({ now: new Date("2026-10-15T17:00:00+05:30") }))).cycles;
  assert.equal(atCutoff[0].status, "closed");
  assert.equal(atCutoff[2].status, "closed");
});

test("changed official PDF blocks stale qualifications and deadline", async () => {
  const changedUrl = rows[2].url;
  await assert.rejects(() => dddRecruitments(context({ fetchBytes: async (url) => {
    const original = pdfs.get(url)!;
    const bytes = url === changedUrl ? Buffer.concat([original, Buffer.from("changed")]) : original;
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /PDF changed/);
});
