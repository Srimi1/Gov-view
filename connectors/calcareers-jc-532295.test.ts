import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { calcareersJc532295, verifyCalcareersFaq, verifyCalcareersPosting } from "./calcareers-jc-532295.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const extraction = JSON.parse(readFileSync(new URL("../data/extractions/calcareers-jc-532295.json", import.meta.url), "utf8")) as { postingUrl: string; faqUrl: string };
const posting = readFileSync(new URL("../data/evidence/research/calcareers-jc-532295-2026.html", import.meta.url), "utf8");
const faq = readFileSync(new URL("../data/evidence/research/calcareers-general-faq-2026.html", import.meta.url), "utf8");
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "us-ca-calcareers-jc-532295")!;
const evidence = (url: string, text: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(text).digest("hex"), bytes: Buffer.byteLength(text), contentType: "text/html",
});
function context(now = new Date("2026-09-25T00:00:00Z")): ConnectorContext {
  return {
    source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      assert.ok(url === extraction.postingUrl || url === extraction.faqUrl);
      const text = url === extraction.postingUrl ? posting : faq;
      return { text, evidence: evidence(url, text) };
    },
  };
}

test("California exact job-control page and statewide guidance gate claims", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyCalcareersPosting(posting));
  assert.doesNotThrow(() => verifyCalcareersFaq(faq));
  assert.throws(() => verifyCalcareersPosting(posting.replace('id="lblJobType">12 Month Limited Term - Full Time', 'id="lblJobType">Permanent - Full Time')), /changed/);
  assert.throws(() => verifyCalcareersPosting(posting.replace('id="lblFinalFilingDate">9\/30\/2026', 'id="lblFinalFilingDate">10\/1\/2026')), /changed/);
  assert.throws(() => verifyCalcareersFaq(faq.replace("Generally, only a few State jobs require U.S. citizenship.", "Only citizens may work.")), /changed/);
  const result = await calcareersJc532295(context());
  assert.equal(result.evidence.length, 2);
  assert.equal(result.complete, false);
});

test("California limited-term vacancy keeps foreign work authorization and English level uncertain", async () => {
  const result = await calcareersJc532295(context());
  assert.equal(result.cycles.length, 1);
  const cycle = result.cycles[0];
  assert.equal(cycle.id, "calcareers-jc-532295");
  assert.equal(cycle.appointmentType, "temporary");
  assert.match(cycle.outcome, /One advertised position; 12-month limited-term/);
  assert.equal(cycle.applicationWindow.closesOn, "2026-09-30");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.equal(cycle.applicationWindow.officialTimeZone, null);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN" }).canApply.result, "needs-verification");
  assert.match(cycle.citizenshipRule, /work visas.*E-Verify/);
  assert.equal(cycle.rules?.languages?.[0].framework, undefined);
  assert.equal(cycle.rules?.languages?.[0].stage, "selection");
  assert.match(cycle.languageNote ?? "", /no.*formal level/i);
  assert.match(cycle.qualifications, /40 WPM/);
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal((await calcareersJc532295(context(new Date("2026-10-01T12:00:00Z")))).cycles[0].status, "closed");
  assert.equal((await calcareersJc532295(context(new Date("2026-09-30T12:00:00Z")))).cycles[0].status, "uncertain");
});
