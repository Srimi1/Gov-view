import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { iiserkolNt04, verifyIiserkolNt04Index } from "./iiserkol-nt04-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const notice = JSON.parse(readFileSync(new URL("../data/extractions/iiserkol-nt04-2026.json", import.meta.url), "utf8")) as {
  indexUrl: string; englishUrl: string; englishSha256: string; hindiUrl: string; hindiSha256: string;
};
const index = readFileSync(new URL("../data/evidence/research/iiserkol-jobs-2026.html", import.meta.url), "utf8");
const english = readFileSync(new URL("../data/evidence/research/iiserkol-nt04-2026-en.pdf", import.meta.url));
const hindi = readFileSync(new URL("../data/evidence/research/iiserkol-nt04-2026-hi.pdf", import.meta.url));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-wb-iiserkol-nt04-2026")!;
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
      const original = url === notice.englishUrl ? english : url === notice.hindiUrl ? hindi : null;
      assert.ok(original, `unexpected PDF ${url}`);
      const bytes = changed && url === notice.englishUrl ? Buffer.concat([original, Buffer.from("changed")]) : original;
      return { bytes, evidence: evidence(url, bytes, "application/pdf") };
    },
  };
}

test("IISER Kolkata index binds exact notice, dates and both PDFs", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyIiserkolNt04Index(index));
  assert.throws(() => verifyIiserkolNt04Index(index.replace("19.10.2026, 5.30 pm", "20.10.2026, 5.30 pm")), /changed/);
  assert.throws(() => verifyIiserkolNt04Index(index.replace("Advt-NT-04-2026_19.09.2026_hindi.pdf", "other.pdf")), /changed/);
  assert.throws(() => verifyIiserkolNt04Index(index.replace("<b>Advt. for Sports Personnel", "<b>NT-04/2026 Corrigendum</b><b>Advt. for Sports Personnel")), /changed/);
  assert.equal(createHash("sha256").update(english).digest("hex"), notice.englishSha256);
  assert.equal(createHash("sha256").update(hindi).digest("hex"), notice.hindiSha256);
  const result = await iiserkolNt04(context());
  assert.equal(result.cycles.length, 7);
  assert.equal(result.evidence.length, 3);
  assert.equal(result.complete, false);
  await assert.rejects(iiserkolNt04(context(true)), /PDF changed/);
});

test("IISER Kolkata counts separate applications, blocks foreign citizens and flags age-date conflict", async () => {
  const result = await iiserkolNt04(context());
  assert.equal(new Set(result.cycles.map((cycle) => cycle.id)).size, 7);
  assert.deepEqual(result.cycles.map((cycle) => Number(/^(\d+) regular/.exec(cycle.outcome)?.[1])).reduce((a, b) => a + b), 17);
  const cycle = result.cycles[0];
  assert.equal(cycle.applicationWindow.opensOn, "2026-09-19");
  assert.equal(cycle.applicationWindow.closesOn, "2026-10-19");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "17:30");
  assert.equal(cycle.applicationWindow.officialTimeZone, null);
  assert.equal(cycle.rules?.asOn, null);
  assert.equal(cycle.rules?.age, undefined);
  assert.deepEqual(cycle.rules?.nationality?.allowed, ["IN"]);
  assert.equal(cycle.rules?.languages, undefined);
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US" }).canApply.result, "does-not-match");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN" }).canApply.result, "needs-verification");
  assert.equal((await iiserkolNt04(context(false, new Date("2026-10-21T00:00:00Z")))).cycles[0].status, "closed");
});

test("IISER Kolkata guard keeps citizenship, reckoning-date and deadline uncertainty", async () => {
  const result = await iiserkolNt04(context());
  assert.equal(result.cycles.length, 7);
  for (const cycle of result.cycles) {
    assert.equal(cycle.rules?.complete, false);
    assert.deepEqual(cycle.rules?.nationality?.allowed, ["IN"]);
    assert.equal(cycle.rules?.nationality?.ociAccepted, undefined);
    assert.match(cycle.citizenshipRule, /citizens of India/);
    assert.match(cycle.citizenshipRule, /Foreign citizens do not meet/);
    assert.doesNotMatch(cycle.citizenshipRule, /no other route|no exception\b|OCI (is|are) (not eligible|ineligible|excluded)/i);
    assert.equal(evaluateEligibility(cycle.rules, { nationality: "US" }).canApply.result, "does-not-match");
    assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN" }).canApply.result, "needs-verification");
    assert.equal(cycle.rules?.asOn, null);
    assert.equal(cycle.rules?.age, undefined);
    assert.match(cycle.qualifications, /19 September/);
    assert.match(cycle.qualifications, /19 October/);
    assert.match(cycle.qualifications, /Do not calculate age automatically/);
    const withDob = evaluateEligibility(cycle.rules, { nationality: "IN", dateOfBirth: "2000-01-01" });
    assert.equal(withDob.canApply.result, "needs-verification");
    assert.equal(withDob.canApply.checks.some((check) => check.rule === "age"), false);
    assert.match(cycle.statusNote, /seek authority clarification/);
    assert.equal(cycle.applicationWindow.closesOn, "2026-10-19");
    assert.equal(cycle.applicationWindow.cutoffLocalTime, "17:30");
    assert.equal(cycle.applicationWindow.officialTimeZone, null);
    assert.match(cycle.applicationWindow.note ?? "", /19 October 2026 at 17:30/);
    assert.match(cycle.applicationWindow.note ?? "", /2026-10-29 at 17:30/);
    assert.match(cycle.applicationWindow.note ?? "", /timezone is not printed/i);
    assert.match(cycle.applicationWindow.note ?? "", /second required step, not a new online/i);
    assert.ok(cycle.selectionStages.some((stage) => /29 October 2026 at 17:30/.test(stage)));
  }
  assert.ok(result.warnings.some((warning) => /19 September 2026.*19 October 2026/.test(warning)));
  assert.ok(result.warnings.some((warning) => /distinct.*neither prints a governing cutoff timezone/i.test(warning)));
});
