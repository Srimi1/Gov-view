import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { iitbL102026, verifyIitbFacultyIndex, verifyIitbFacultyNotice } from "./iitb-l10-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const notice = JSON.parse(readFileSync(new URL("../data/extractions/iitb-l10-2026.json", import.meta.url), "utf8")) as {
  indexUrl: string; noticeUrl: string; eligibilityUrl: string; eligibilitySha256: string;
  specializationsUrl: string; specializationsSha256: string; applicationUrl: string;
};
const index = readFileSync(new URL("../data/evidence/research/iitb-career-apply-2026.html", import.meta.url), "utf8");
const ad = readFileSync(new URL("../data/evidence/research/iitb-l10-2026.html", import.meta.url), "utf8");
const eligibility = readFileSync(new URL("../data/evidence/research/iitb-l10-eligibility.pdf", import.meta.url));
const specializations = readFileSync(new URL("../data/evidence/research/iitb-l10-specializations.pdf", import.meta.url));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-iitb-faculty-l10-2026")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType,
});

function context(changedPdf = false, now = new Date("2026-09-25T00:00:00Z")): ConnectorContext {
  return {
    source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      const html = url === notice.indexUrl ? index : url === notice.noticeUrl ? ad : null;
      assert.ok(html);
      return { text: html, evidence: evidence(url, Buffer.from(html), "text/html") };
    },
    fetchBytes: async (url) => {
      const original = url === notice.eligibilityUrl ? eligibility : url === notice.specializationsUrl ? specializations : null;
      assert.ok(original);
      const bytes = changedPdf ? Buffer.concat([original, Buffer.from("changed")]) : original;
      return { bytes, evidence: evidence(url, bytes, "application/pdf") };
    },
  };
}

test("IIT Bombay current index, notice and exact annexures gate the draft", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyIitbFacultyIndex(index));
  assert.doesNotThrow(() => verifyIitbFacultyNotice(ad));
  assert.throws(() => verifyIitbFacultyIndex(index.replace("/job-vacancy-ad/rolling-advertisement-no-l-1025-26", "/job-vacancy-ad/other")), /changed/);
  assert.throws(() => verifyIitbFacultyNotice(ad.replace("Thu, 31/12/2026 - 23:59", "Thu, 31/12/2026 - 20:00")), /changed/);
  assert.throws(() => verifyIitbFacultyNotice(ad.replace("and foreign nationals for faculty positions", "for faculty positions")), /changed/);
  assert.equal(createHash("sha256").update(eligibility).digest("hex"), notice.eligibilitySha256);
  assert.equal(createHash("sha256").update(specializations).digest("hex"), notice.specializationsSha256);
  assert.equal((await iitbL102026(context())).evidence.length, 4);
  await assert.rejects(iitbL102026(context(true)), /PDF changed/);
});

test("IIT Bombay counts one rolling call and keeps international outcome conditional", async () => {
  const result = await iitbL102026(context());
  assert.equal(result.cycles.length, 1);
  assert.equal(result.complete, false);
  const cycle = result.cycles[0];
  assert.equal(cycle.pathway, "recruitment");
  assert.equal(cycle.applicationMethod, "online");
  assert.equal(cycle.applicationWindow.closesOn, "2026-12-31");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "23:59");
  assert.equal(cycle.applicationWindow.officialTimeZone, null);
  assert.deepEqual(cycle.rules?.nationality?.allowed, ["*"]);
  assert.equal(cycle.rules?.languages, undefined);
  assert.match(cycle.languageNote ?? "", /no required language.*proficiency level/i);
  assert.equal(cycle.venues[0].kind, "unknown");
  const foreign = evaluateEligibility(cycle.rules, { nationality: "US" });
  assert.equal(foreign.canApply.result, "needs-verification");
  assert.equal(foreign.canObtainOutcome.result, "needs-verification");
  assert.equal(foreign.canApply.checks.find((check) => check.rule === "nationality")?.result, "matches-published-criteria");
  assert.equal((await iitbL102026(context(false, new Date("2027-01-01T00:00:00Z")))).cycles[0].status, "closed");
});
