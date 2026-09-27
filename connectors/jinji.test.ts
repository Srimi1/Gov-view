import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { jinji } from "./jinji.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const pdfUrl = "https://www.jinji.go.jp/content/900036094.pdf";
const listUrl = "https://www.jinji.go.jp/saiyo/siken/jyukennannnaiichiran.html";
const source: SourceConfig = {
  id: "jp-jinji", name: "National Personnel Authority", country: "JP",
  authority: "人事院", homepage: listUrl, connector: "jinji",
  cadenceHours: 24, licence: "", enabled: true, reviewRequired: true,
};
const guide = readFileSync(new URL("../data/evidence/research/jinji-900036094.pdf", import.meta.url));
const sha256 = createHash("sha256").update(guide).digest("hex");
const html = `<table><tr><td>国家公務員採用総合職試験</td><td>大卒程度試験（秋）（教養区分）</td><td><a href="/content/900036094.pdf">受験案内</a></td></tr><tr><td>専門職試験（大卒程度）</td><td>Other exam</td><td><a href="/content/other.pdf">受験案内</a></td></tr></table>`;
const listEvidence: Evidence = { url: listUrl, fetchedAt: "2026-09-25T00:00:00Z", sha256: "a".repeat(64), contentType: "text/html", bytes: html.length };
const pdfEvidence: Evidence = { url: pdfUrl, fetchedAt: "2026-09-25T00:00:00Z", sha256, contentType: "application/pdf", bytes: guide.length };

function context(pdfHash = sha256): ConnectorContext {
  return {
    source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
    fetchText: async () => ({ text: html, evidence: listEvidence }),
    fetchBytes: async () => ({ bytes: guide, evidence: { ...pdfEvidence, sha256: pdfHash } }),
  };
}

test("Jinji stages only exact-checked 2026 guide; foreign nationals cannot sit exam", async () => {
  const result = await jinji(context());
  assert.equal(result.complete, false);
  assert.equal(result.totalAvailable, 2);
  assert.equal(result.cycles.length, 1);
  const cycle = result.cycles[0];
  assert.equal(cycle.applicationWindow.closesOn, "2026-08-24");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.equal(cycle.sources[0].sha256, sha256);
  assert.equal(cycle.sources[0].fetchStatus, "fetched");
  assert.equal(cycle.rules?.languages, undefined, "optional English bonus is not mandatory eligibility");
  const foreign = evaluateEligibility(cycle.rules, { nationality: "US" });
  assert.equal(foreign.canApply.result, "needs-verification");
  assert.equal(foreign.canEnterSelection.result, "does-not-match");
  assert.equal(foreign.canObtainOutcome.result, "does-not-match");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "JP" }).canEnterSelection.result, "needs-verification");
});

test("Jinji refuses changed PDF until dates and rules are rechecked", async () => {
  const result = await jinji(context("b".repeat(64)));
  assert.equal(result.cycles.length, 0);
  assert.equal(result.complete, false);
  assert.match(result.warnings[0], /PDF changed/);
});
