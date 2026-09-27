import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { iprcRmt2026, verifyIprcRmtIndex } from "./iprc-rmt-2026-01.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const notice = JSON.parse(readFileSync(new URL("../data/extractions/iprc-rmt-2026-01.json", import.meta.url), "utf8")) as {
  indexUrl: string; documentUrl: string; documentSha256: string; annexureUrl: string; annexureSha256: string;
};
const index = readFileSync(new URL("../data/evidence/research/iprc-careers-2026.html", import.meta.url), "utf8");
const document = readFileSync(new URL("../data/evidence/research/iprc-rmt-2026-01.pdf", import.meta.url));
const annexure = readFileSync(new URL("../data/evidence/research/iprc-rmt-2026-01-annexure-a.pdf", import.meta.url));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-isro-iprc-rmt-2026-01")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType,
});
function context(changed = false, now = new Date("2026-09-25T00:00:00Z")): ConnectorContext {
  return {
    source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      assert.equal(url, notice.indexUrl);
      return { text: index, evidence: evidence(url, Buffer.from(index), "text/html") };
    },
    fetchBytes: async (url) => {
      assert.ok(url === notice.documentUrl || url === notice.annexureUrl);
      const original = url === notice.documentUrl ? document : annexure;
      const bytes = changed && url === notice.documentUrl ? Buffer.concat([original, Buffer.from("changed")]) : original;
      return { bytes, evidence: evidence(url, bytes, "application/pdf") };
    },
  };
}

test("IPRC current 11-post block and both original PDFs gate recruitment facts", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyIprcRmtIndex(index));
  assert.throws(() => verifyIprcRmtIndex(index.replace("05-10-2026, 16:00 Hrs", "06-10-2026, 16:00 Hrs")), /changed/);
  assert.throws(() => verifyIprcRmtIndex(index.replace("Advertisement_12092026.pdf", "revised.pdf")), /changed/);
  assert.throws(() => verifyIprcRmtIndex(index.replace("Technician ‘B’ (Electrician)", "Technician ‘B’ (Plumber)")), /changed/);
  assert.equal(evidence(notice.documentUrl, document, "application/pdf").sha256, notice.documentSha256);
  assert.equal(evidence(notice.annexureUrl, annexure, "application/pdf").sha256, notice.annexureSha256);
  const result = await iprcRmt2026(context());
  assert.equal(result.evidence.length, 3);
  assert.equal(result.complete, false);
  await assert.rejects(iprcRmt2026(context(true)), /PDF changed/);
});

test("IPRC counts distinct applications and keeps international, language and venue evidence separate", async () => {
  const result = await iprcRmt2026(context());
  assert.equal(result.cycles.length, 11);
  assert.equal(result.cycles.every((cycle) => cycle.appointmentType === "temporary"), true);
  assert.equal(new Set(result.cycles.map((cycle) => cycle.id)).size, 11);
  assert.equal(result.cycles.reduce((sum, cycle) => sum + Number(/^(\d+) vacanc(?:y|ies)/.exec(cycle.outcome)?.[1]), 0), 22);
  const technical = result.cycles.find((cycle) => cycle.id.endsWith("-60"))!;
  const cook = result.cycles.find((cycle) => cycle.id.endsWith("-70"))!;
  const fireman = result.cycles.find((cycle) => cycle.id.endsWith("-71"))!;
  assert.deepEqual(technical.rules?.nationality?.allowed, ["IN"]);
  assert.equal(evaluateEligibility(technical.rules, { nationality: "US" }).canApply.result, "does-not-match");
  assert.equal(evaluateEligibility(technical.rules, { nationality: "IN" }).canApply.result, "needs-verification");
  assert.match(technical.languageNote ?? "", /English and Hindi.*No formal proficiency level/);
  assert.match(cook.languageNote ?? "", /Tamil, Hindi and English.*Class 10 level/);
  assert.equal(technical.rules?.languages, undefined);
  assert.equal(technical.applicationWindow.closesOn, "2026-10-05");
  assert.equal(technical.applicationWindow.cutoffLocalTime, "16:00");
  assert.equal(technical.applicationWindow.officialTimeZone, null);
  assert.equal(technical.venues.filter((venue) => venue.kind === "published").length, 2);
  assert.equal(fireman.sources.length, 3);
  assert.match(fireman.qualifications, /Annexure A/);
  assert.match(technical.outcome, /temporary but likely to continue indefinitely/);
  assert.match(technical.fee, /₹750 initially.*Refund only if/);
  assert.equal((await iprcRmt2026(context(false, new Date("2026-10-06T00:00:00Z")))).cycles[0].status, "closed");
  assert.equal((await iprcRmt2026(context(false, new Date("2026-10-05T11:00:00Z")))).cycles[0].status, "uncertain");
});
