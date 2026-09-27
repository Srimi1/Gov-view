import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { CHANDIGARH_NOTICES, chandigarhUtcps, checkChandigarhUtcpsIndex } from "./chandigarh-utcps.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const read = (name: string) => readFileSync(new URL(`../data/evidence/research/${name}`, import.meta.url));
const html = read("chandigarh-public-notice-2026.html").toString();
const pdf = read("chandigarh-utcps-2026.pdf");
const documentUrl = "https://chandigarh.gov.in/cadmin//uploads/1790090575_8638fb02d8c9539f7600.pdf";
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-ch-recruitment")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => { assert.equal(url, CHANDIGARH_NOTICES); return { text: html, evidence: evidence(url, Buffer.from(html), "text/html") }; },
  fetchBytes: async (url) => { assert.equal(url, documentUrl); return { bytes: pdf, evidence: evidence(url, pdf, "application/pdf") }; },
  ...override,
});

test("Chandigarh dated index binds one UTCPS notice and holds changes", () => {
  assert.doesNotThrow(() => checkChandigarhUtcpsIndex(html));
  assert.throws(() => checkChandigarhUtcpsIndex(html.replace("1790090575_8638fb02d8c9539f7600.pdf", "revised.pdf")), /PDF changed or moved/);
  assert.throws(() => checkChandigarhUtcpsIndex(html.replace("22/09/2026", "23/09/2026")), /identity or date changed/);
  assert.throws(() => checkChandigarhUtcpsIndex(html.replace("</tbody>", '<tr><td><a href="new.pdf">UTCPS Accountant deadline change</a></td></tr></tbody>')), /notice set changed/);
});

test("UTCPS draft keeps walk-in timing separate from application deadline and foreign eligibility uncertain", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await chandigarhUtcps(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 2);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "uncertain");
  assert.match(cycle.outcome, /one year/i);
  assert.equal(cycle.applicationWindow.opensOn, null);
  assert.equal(cycle.applicationWindow.closesOn, null);
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.match(cycle.selectionStages.join(" "), /8 October 2026 at 10:00/);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.equal(cycle.venues[0].kind, "published");
  if (cycle.venues[0].kind === "published") assert.equal(cycle.venues[0].precision, "city");
  for (const stage of Object.values(evaluateEligibility(cycle.rules, { nationality: "US", education: "bachelor" }))) assert.equal(stage.result, "needs-verification");
  assert.equal((await chandigarhUtcps(context({ now: new Date("2026-10-09T00:00:00+05:30") }))).cycles[0].status, "closed");
});

test("UTCPS changed PDF cannot reuse old qualifications or interview details", async () => {
  await assert.rejects(() => chandigarhUtcps(context({ fetchBytes: async (url) => {
    const bytes = Buffer.concat([pdf, Buffer.from("changed")]);
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /PDF changed/);
});
