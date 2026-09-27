import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { isroSac022026, verifySacPages } from "./isro-sac-02-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const notice = JSON.parse(readFileSync(new URL("../data/extractions/isro-sac-02-2026.json", import.meta.url), "utf8")) as {
  indexUrl: string; detailUrl: string; documentUrl: string; documentSha256: string;
};
const index = readFileSync(new URL("../data/evidence/research/isro-sac-02-2026-index.html", import.meta.url), "utf8");
const detail = readFileSync(new URL("../data/evidence/research/isro-sac-02-2026-detail.html", import.meta.url), "utf8");
const document = readFileSync(new URL("../data/evidence/research/isro-sac-02-2026-notice.pdf", import.meta.url));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-isro-sac-02-2026")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType,
});
function context(changedPdf = false, now = new Date("2026-09-25T00:00:00Z")): ConnectorContext {
  return {
    source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      assert.ok(url === notice.indexUrl || url === notice.detailUrl);
      const html = url === notice.indexUrl ? index : detail;
      return { text: html, evidence: evidence(url, Buffer.from(html), "text/html") };
    },
    fetchBytes: async (url) => {
      assert.equal(url, notice.documentUrl);
      const bytes = changedPdf ? Buffer.concat([document, Buffer.from("changed")]) : document;
      return { bytes, evidence: evidence(url, bytes, "application/pdf") };
    },
  };
}

test("SAC current index, detail and exact original notice gate draft claims", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifySacPages(index, detail));
  assert.throws(() => verifySacPages(index.replace("Sept 30,2026", "Oct 1,2026"), detail), /changed/);
  assert.throws(() => verifySacPages(index, detail.replace("1700 hours of", "1800 hours of")), /changed/);
  assert.throws(() => verifySacPages(index, detail.replace("Status: </b>", "Status: </b> Closed ")), /changed/);
  assert.equal(evidence(notice.documentUrl, document, "application/pdf").sha256, notice.documentSha256);
  const result = await isroSac022026(context());
  assert.equal(result.evidence.length, 3);
  assert.equal(result.complete, true);
  await assert.rejects(isroSac022026(context(true)), /PDF changed/);
});

test("SAC post codes stay distinct, and foreign-citizen, language, venue and deadline limits stay explicit", async () => {
  const result = await isroSac022026(context());
  assert.equal(result.cycles.length, 16);
  assert.equal(new Set(result.cycles.map((cycle) => cycle.id)).size, 16);
  assert.equal(result.cycles.every((cycle) => cycle.appointmentType === "temporary"), true);
  assert.equal(result.cycles.reduce((sum, cycle) => sum + Number(/^(\d+) provisional/.exec(cycle.outcome)?.[1]), 0), 48);
  const jrf = result.cycles.find((cycle) => cycle.id.endsWith("-03"))!;
  const ra = result.cycles.find((cycle) => cycle.id.endsWith("-08"))!;
  const scientist = result.cycles.find((cycle) => cycle.id.endsWith("-13"))!;
  assert.deepEqual(jrf.rules?.nationality?.allowed, ["IN"]);
  assert.equal(evaluateEligibility(jrf.rules, { nationality: "US" }).canApply.result, "does-not-match");
  assert.equal(evaluateEligibility(jrf.rules, { nationality: "IN" }).canApply.result, "needs-verification");
  assert.match(jrf.qualifications, /B\.E\.\/B\.Tech.*valid CSIR-UGC NET, GATE/);
  assert.match(ra.qualifications, /three years.*SCI/);
  assert.match(scientist.qualifications, /Ph\.D\..*OR M\.E\.\/M\.Tech/);
  assert.equal(jrf.rules?.languages, undefined);
  assert.match(jrf.languageNote ?? "", /No mandatory language, level or language certificate/);
  assert.equal(jrf.venues.filter((venue) => venue.kind === "published").length, 0);
  assert.match(jrf.scopeLabel, /Ahmedabad is a work location, not a published interview venue/);
  assert.deepEqual(jrf.workLocations, ["Space Applications Centre, Ahmedabad, Gujarat, India"]);
  assert.equal(jrf.applicationWindow.cutoffLocalTime, "17:00");
  assert.equal(jrf.applicationWindow.officialTimeZone, null);
  assert.equal((await isroSac022026(context(false, new Date("2026-10-01T00:00:00Z")))).cycles[0].status, "closed");
  assert.equal((await isroSac022026(context(false, new Date("2026-09-30T12:00:00Z")))).cycles[0].status, "uncertain");
});
