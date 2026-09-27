import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { drdoJrfSeptember2026, verifyDrdoJrfIndexes } from "./drdo-jrf-september-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const root = new URL("../data/evidence/research/", import.meta.url);
const indexes = ["drdo-vacancies-2026-09-27.html", "drdo-vacancies-page-2-2026-09-27.html"]
  .map((name) => readFileSync(new URL(name, root), "utf8"));
const details = ["dysl-sm", "lrde"].map((name) => readFileSync(new URL(`drdo-${name}-jrf-detail-2026.html`, root), "utf8"));
const pdfs = ["dysl-sm", "lrde"].map((name) => readFileSync(new URL(`drdo-${name}-jrf-2026.pdf`, root)));
const config = JSON.parse(readFileSync(new URL("../data/extractions/drdo-jrf-september-2026.json", import.meta.url), "utf8")) as {
  indexPages: { url: string }[]; roles: { detailUrl: string; pdfUrl: string }[];
};
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-drdo-jrf-september-2026")!;
const evidence = (url: string, bytes: Buffer): Evidence => ({ url, fetchedAt: "2026-09-26T19:24:00Z",
  sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
  contentType: url.endsWith(".pdf") ? "application/pdf" : "text/html" });
function context(now = new Date("2026-09-27T00:00:00Z"), change = ""): ConnectorContext {
  return { source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      const index = config.indexPages.findIndex((page) => page.url === url);
      if (index >= 0) return { text: indexes[index], evidence: evidence(url, Buffer.from(indexes[index])) };
      const role = config.roles.findIndex((item) => item.detailUrl === url); assert.ok(role >= 0);
      const text = change === "detail" && role === 0 ? details[role].replace("advtDYSLSM08092026.pdf", "replacement.pdf") : details[role];
      return { text, evidence: evidence(url, Buffer.from(text)) };
    },
    fetchBytes: async (url) => {
      const role = config.roles.findIndex((item) => item.pdfUrl === url); assert.ok(role >= 0);
      const bytes = change === "pdf" && role === 0 ? Buffer.concat([pdfs[role], Buffer.from("changed")]) : pdfs[role];
      return { bytes, evidence: evidence(url, bytes) };
    },
  };
}

test("DRDO JRF extraction rejects changed pagination, editions, detail links and PDFs", async () => {
  assert.equal(source.enabled, false); assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyDrdoJrfIndexes(indexes));
  assert.throws(() => verifyDrdoJrfIndexes(indexes.slice(0, 1)), /pagination incomplete/);
  assert.throws(() => verifyDrdoJrfIndexes([indexes[0].replace('href="?page=1"', 'href="?page=2"'), indexes[1]]), /pagination changed/);
  assert.throws(() => verifyDrdoJrfIndexes([indexes[0].replace("DYSL-SM/HRD/JRF/REC/2026/1", "DYSL-SM/HRD/JRF/REC/2027/1"), indexes[1]]), /changed/);
  await assert.rejects(drdoJrfSeptember2026(context(undefined, "detail")), /detail changed/);
  await assert.rejects(drdoJrfSeptember2026(context(undefined, "pdf")), /PDF changed/);
});

test("DRDO JRF counts two calls, excludes result notices and rejects foreign nationals", async () => {
  const result = await drdoJrfSeptember2026(context());
  assert.equal(result.complete, false); assert.equal(result.cycles.length, 2);
  assert.equal(result.evidence.length, 6);
  assert.equal(new Set(result.cycles.map((cycle) => cycle.id)).size, 2);
  for (const cycle of result.cycles) {
    assert.equal(cycle.appointmentType, "temporary"); assert.equal(cycle.pathway, "recruitment");
    assert.equal(cycle.applicationWindow.officialTimeZone, null); assert.equal(cycle.applicationWindow.opensOn, null);
    assert.equal(cycle.rules?.languages, undefined); assert.equal(cycle.rules?.age, undefined);
    assert.equal(cycle.venues.length, 1); assert.equal(cycle.venues[0].kind, "published-address");
    assert.match(cycle.outcome, /does not confer any right to absorption/);
    const foreign = evaluateEligibility(cycle.rules, { nationality: "US", ociStatus: "yes", education: "doctorate" });
    assert.equal(foreign.canApply.result, "does-not-match");
    assert.equal(foreign.canEnterSelection.result, "does-not-match");
    assert.equal(foreign.canObtainOutcome.result, "does-not-match");
    assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN", education: "bachelor" }).canApply.result, "needs-verification");
    assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN", education: "secondary" }).canApply.result, "does-not-match");
  }
  assert.match(result.cycles[0].outcome, /^1 JRF place/);
  assert.match(result.cycles[1].outcome, /^2 JRF places/);
});

test("DRDO willingness advisory and walk-in times stay distinct from email deadlines", async () => {
  const [dysl, lrde] = (await drdoJrfSeptember2026(context())).cycles;
  assert.equal(dysl.status, "open"); assert.equal(dysl.applicationWindow.closesOn, "2026-10-06");
  assert.equal(dysl.applicationWindow.cutoffLocalTime, null); assert.equal(dysl.rules?.asOn, null);
  assert.match(dysl.qualifications, /actual date of application/);
  assert.match(dysl.qualifications, /literally "MechanicalMechatronics".*authority clarification/);
  assert.equal(lrde.status, "uncertain"); assert.equal(lrde.applicationWindow.closesOn, "2026-10-08");
  assert.equal(lrde.applicationWindow.cutoffLocalTime, "09:30"); assert.equal(lrde.rules?.asOn, "2026-09-01");
  assert.match(lrde.applicationWindow.note!, /25 September.*prerequisite/);
  assert.match(lrde.languageNote!, /self-attested English transcripts/);
  assert.equal((await drdoJrfSeptember2026(context(new Date("2026-09-24T00:00:00Z")))).cycles[1].status, "open");
  assert.equal((await drdoJrfSeptember2026(context(new Date("2026-10-08T23:00:00Z")))).cycles[1].status, "uncertain");
  const closed = await drdoJrfSeptember2026(context(new Date("2026-10-10T00:00:00Z")));
  assert.ok(closed.cycles.every((cycle) => cycle.status === "closed"));
});
