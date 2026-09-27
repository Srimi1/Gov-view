import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { dnsricmLecturer2026, verifyDnsricmIndex } from "./dnsricm-lecturer-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const notice = JSON.parse(readFileSync(new URL("../data/extractions/dnsricm-lecturer-2026.json", import.meta.url), "utf8")) as {
  indexUrl: string; announcementUrl: string; announcementSha256: string;
  detailsUrl: string; detailsSha256: string; formUrl: string; formSha256: string;
};
const index = readFileSync(new URL("../data/evidence/research/dnsricm-notice-index-2026.html", import.meta.url), "utf8");
const documents = new Map([
  [notice.announcementUrl, readFileSync(new URL("../data/evidence/research/dnsricm-lecturer-announcement-2026.jpeg", import.meta.url))],
  [notice.detailsUrl, readFileSync(new URL("../data/evidence/research/dnsricm-lecturer-details-2026.pdf", import.meta.url))],
  [notice.formUrl, readFileSync(new URL("../data/evidence/research/dnsricm-lecturer-form-2026.pdf", import.meta.url))],
]);
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-br-dnsricm-lecturer-2026")!;

function evidence(url: string, bytes: Buffer): Evidence {
  return { url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length, contentType: url.endsWith(".jpeg") ? "image/jpeg" : url.endsWith(".pdf") ? "application/pdf" : "text/html" };
}
function context(changed?: string): ConnectorContext {
  return { source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
    fetchText: async (url) => ({ text: index, evidence: evidence(url, Buffer.from(index)) }),
    fetchBytes: async (url) => {
      const original = documents.get(url);
      assert.ok(original);
      const bytes = changed === url ? Buffer.concat([original, Buffer.from("changed")]) : original;
      return { bytes, evidence: evidence(url, bytes) };
    },
  };
}

test("DNS-RICM register binds three dated documents and exact bytes", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyDnsricmIndex(index));
  assert.throws(() => verifyDnsricmIndex(index.replaceAll("BBA/17-08-26.jpeg", "BBA/other.jpeg")), /register changed/);
  assert.throws(() => verifyDnsricmIndex(index.replace("BBA/DetailsofAdvertisment14-08-26.pdf", "BBA/other.pdf")), /register changed/);
  assert.throws(() => verifyDnsricmIndex(index.replace("BBA/ApplicationForm14-08-26.pdf", "BBA/other.pdf")), /register changed/);
  assert.equal(evidence(notice.announcementUrl, documents.get(notice.announcementUrl)!).sha256, notice.announcementSha256);
  assert.equal(evidence(notice.detailsUrl, documents.get(notice.detailsUrl)!).sha256, notice.detailsSha256);
  assert.equal(evidence(notice.formUrl, documents.get(notice.formUrl)!).sha256, notice.formSha256);
  assert.equal((await dnsricmLecturer2026(context())).evidence.length, 4);
  await assert.rejects(dnsricmLecturer2026(context(notice.announcementUrl)), /JPEG changed/);
  await assert.rejects(dnsricmLecturer2026(context(notice.detailsUrl)), /PDF changed/);
});

test("DNS-RICM retains unknown deadline and international eligibility", async () => {
  const result = await dnsricmLecturer2026(context());
  assert.equal(result.cycles.length, 1);
  assert.equal(result.complete, false);
  const cycle = result.cycles[0];
  assert.equal(cycle.pathway, "recruitment");
  assert.equal(cycle.status, "uncertain");
  assert.equal(cycle.applicationWindow.closesOn, null);
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.equal(cycle.applicationMethod, "post");
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(cycle.sources.find((item) => item.format === "image")?.url, notice.announcementUrl);
  const international = evaluateEligibility(cycle.rules, { nationality: "US" });
  assert.equal(international.canApply.result, "needs-verification");
  assert.equal(international.canEnterSelection.result, "needs-verification");
  assert.equal(international.canObtainOutcome.result, "needs-verification");
});
