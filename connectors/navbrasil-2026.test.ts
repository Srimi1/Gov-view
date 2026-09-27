import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { navbrasil2026, verifyNavbrasilRegisters } from "./navbrasil-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";

const extraction = JSON.parse(readFileSync(new URL("../data/extractions/navbrasil-2026-tower-control.json", import.meta.url), "utf8"));
const employerHtml = readFileSync(new URL("../data/evidence/research/navbrasil-concurso-2026.html", import.meta.url), "utf8");
const organizerHtml = readFileSync(new URL("../data/evidence/research/navbrasil-fgv-2026.html", import.meta.url), "utf8");
const pdfs = [
  "navbrasil-edital-01-2026-retificado.pdf",
  "navbrasil-retificacao-1-2026.pdf",
  "navbrasil-retificacao-2-2026.pdf",
].map((name) => readFileSync(new URL(`../data/evidence/research/${name}`, import.meta.url)));
const registry = JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[];
const source = registry.find((item) => item.id === "br-navbrasil-2026")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({ url, fetchedAt: "2026-09-25T03:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType, bytes: bytes.length });
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T03:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => {
    const html = url === extraction.indexUrl ? employerHtml : organizerHtml;
    return { text: html, evidence: evidence(url, Buffer.from(html), "text/html") };
  },
  fetchBytes: async (url) => {
    const index = extraction.documents.findIndex((document: { url: string }) => document.url === url);
    if (index < 0) throw new Error(`Unexpected PDF ${url}`);
    return { bytes: pdfs[index], evidence: evidence(url, pdfs[index], "application/pdf") };
  },
  ...override,
});

test("NAV Brasil employer and FGV registers bind only first and second amendments", () => {
  verifyNavbrasilRegisters(employerHtml, organizerHtml);
  assert.throws(() => verifyNavbrasilRegisters(employerHtml.replace("2ª Retificação", "3ª Retificação"), organizerHtml), /amendment register changed/);
  assert.throws(() => verifyNavbrasilRegisters(employerHtml, organizerHtml.replace("2ª Retificação", "3ª Retificação")), /amendment register changed/);
  assert.throws(() => verifyNavbrasilRegisters(employerHtml.replace("edital-01-2026-nav-brasil_retificado_08_05.pdf", "changed.pdf"), organizerHtml), /edital or amendment link changed/);
});

test("NAV Brasil Tower Control draft separates application, training and employment eligibility", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await navbrasil2026(context());
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 5);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "closed");
  assert.match(cycle.outcome, /51 immediate/);
  assert.equal(cycle.applicationWindow.closesOn, "2026-05-28");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "18:00");
  assert.equal(cycle.applicationWindow.officialTimeZone, "America/Sao_Paulo");
  assert.match(cycle.fee, /29 May 2026 at 23:59/);
  assert.equal(cycle.rules?.languages?.length, 2);
  assert.match(cycle.rules!.languages![1].requirement, /no CEFR/i);
  assert.equal(cycle.venues.length, 11);
  const us = evaluateEligibility(cycle.rules, { nationality: "US", education: "secondary" });
  assert.equal(us.canApply.result, "needs-verification");
  assert.equal(us.canEnterSelection.result, "does-not-match");
  const pt = evaluateEligibility(cycle.rules, { nationality: "PT", education: "secondary" });
  assert.equal(pt.canEnterSelection.result, "needs-verification");
  assert.equal(pt.canObtainOutcome.result, "needs-verification");
});

test("NAV Brasil changed PDF cannot reuse nationality, dates or language extraction", async () => {
  await assert.rejects(() => navbrasil2026(context({ fetchBytes: async (url) => {
    const index = extraction.documents.findIndex((document: { url: string }) => document.url === url);
    const bytes = Buffer.concat([pdfs[index], Buffer.from("changed")]);
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /extracted applicant rules withheld/);
});
