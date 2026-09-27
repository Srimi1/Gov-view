import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { puneDivcommLegal2026, verifyPuneLegalIndex } from "./pune-divcomm-legal-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const extraction = JSON.parse(readFileSync(new URL("../data/extractions/pune-divcomm-legal-officer-2026.json", import.meta.url), "utf8")) as Record<string, string>;
const index = readFileSync(new URL("../data/evidence/research/pune-divcomm-recruitment-2026.html", import.meta.url), "utf8");
const pdf = readFileSync(new URL("../data/evidence/research/pune-divcomm-legal-officer-2026.pdf", import.meta.url));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-mh-pune-divcomm-legal")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType,
});
function context(now = new Date("2026-09-25T00:00:00Z"), changed = false): ConnectorContext {
  return {
    source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      assert.equal(url, extraction.indexUrl);
      return { text: index, evidence: evidence(url, Buffer.from(index), "text/html") };
    },
    fetchBytes: async (url) => {
      assert.equal(url, extraction.documentUrl);
      const bytes = changed ? Buffer.concat([pdf, Buffer.from("changed")]) : pdf;
      return { bytes, evidence: evidence(url, bytes, "application/pdf") };
    },
  };
}

test("Pune recruitment row binds one exact scanned Legal Officer notice", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyPuneLegalIndex(index));
  assert.throws(() => verifyPuneLegalIndex(index.replaceAll("1-8-2026", "2-8-2026")), /changed/);
  assert.throws(() => verifyPuneLegalIndex(index.replaceAll("202608011825918750.pdf", "other.pdf")), /changed/);
  assert.throws(() => verifyPuneLegalIndex(index.replace("</ol>", "<li>Corrigendum for Legal Officer</li></ol>")), /amended/);
  assert.equal(createHash("sha256").update(pdf).digest("hex"), extraction.pdfSha256);
  const result = await puneDivcommLegal2026(context());
  assert.equal(result.cycles.length, 1);
  assert.equal(result.complete, false);
  assert.equal(result.evidence.length, 2);
  await assert.rejects(puneDivcommLegal2026(context(undefined, true)), /PDF changed/);
});

test("Pune contract keeps foreign eligibility uncertain and language level unclaimed", async () => {
  const cycle = (await puneDivcommLegal2026(context())).cycles[0];
  assert.deepEqual(cycle.subdivisionCodes, ["IN-MH"]);
  assert.equal(cycle.applicationWindow.closesOn, "2026-08-31");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.equal(cycle.applicationWindow.officialTimeZone, null);
  assert.equal(cycle.status, "closed");
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.match(cycle.languageNote ?? "", /Marathi, Hindi and English/);
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US" }).canApply.result, "needs-verification");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN" }).canApply.result, "needs-verification");
});
