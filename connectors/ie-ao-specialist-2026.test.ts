import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { ieAoSpecialist2026, ieAoJobBoardLink } from "./ie-ao-specialist-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const root = new URL("../data/evidence/research/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root));
const home = read("ie-publicjobs-home-2026-09-27.html").toString();
const board = read("ie-publicjobs-job-search-2026-09-27.html").toString();
const detail = read("ie-publicjobs-ao-specialist-9005-2026-canonical.html").toString();
const booklet = read("ie-publicjobs-ao-specialist-9005-2026-booklet-1.pdf");
const data = JSON.parse(readFileSync(new URL("../data/extractions/ie-ao-specialist-2026.json", import.meta.url), "utf8")) as {
  homepage: string; detailUrl: string; documents: { key: string; url: string }[];
};
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "ie-publicjobs-ao-specialist-2026")!;
const evidence = (url: string, bytes: Buffer): Evidence => ({ url, fetchedAt: "2026-09-26T19:51:04Z",
  sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType: "application/pdf" });

function context(change = "", now = new Date("2026-09-27T00:00:00Z")): ConnectorContext {
  const freshHome = change === "session" ? home.replaceAll("xf-423dd989250d", "xf-freshpublicsession") : home;
  return { source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      let text = url === data.homepage ? freshHome : url === ieAoJobBoardLink(freshHome) ? board : detail;
      if (url === data.detailUrl) {
        if (change === "deadline") text = text.replaceAll("13/10/2026", "20/10/2026");
        if (change === "edition") text = text.replaceAll("/9005/406178/", "/9005/999999/");
        if (change === "host") text = text.replaceAll('class="file_application_pdf" href="https://publicjobs.tal.net', 'class="file_application_pdf" href="https://example.com');
        if (change === "session") text = text.replace(/xf-[a-f0-9]+/g, "xf-freshpublicsession");
      }
      if (url === ieAoJobBoardLink(freshHome)) {
        if (change === "missing") text = text.replace('id="oppid-9005"', 'id="oppid-removed"');
        if (change === "card") text = text.replace('data-title="Graduate Opportunities 2026 Administrative Officer Specialist"', 'data-title="Unrelated"')
          .replace("<span class=\"candidate-opp-field-label\">Closing Date:</span> 13 Oct 2026", "<span class=\"candidate-opp-field-label\">Closing Date:</span> 20 Oct 2026");
      }
      return { text, evidence: { ...evidence(url, Buffer.from(text)), contentType: "text/html" } };
    },
    fetchBytes: async (url) => {
      const document = data.documents.find((item) => item.url === url);
      let bytes = document ? read(`ie-publicjobs-ao-specialist-9005-2026-${document.key}.pdf`) : booklet;
      assert.ok(document || /\/download_file_opp\/9005\/(105858|406178)\//.test(url), url);
      if (change === "pdf" && document?.key === "eligibility") bytes = Buffer.concat([bytes, Buffer.from("amended")]);
      if (change === "irish-pdf" && url.includes("/406178/")) bytes = Buffer.concat([bytes, Buffer.from("new translation")]);
      return { bytes, evidence: evidence(url, bytes) };
    },
  };
}

test("Irish AO counts one application, preserves offer-date citizenship and opt-in B2", async () => {
  assert.equal(source.enabled, false); assert.equal(source.reviewRequired, true);
  const result = await ieAoSpecialist2026(context());
  assert.equal(result.cycles.length, 1); assert.equal(result.evidence.length, 11); assert.equal(result.complete, false);
  const cycle = result.cycles[0];
  assert.equal(cycle.id, "ie-ao-specialist-9005-2026"); assert.equal(cycle.appointmentType, "permanent");
  assert.match(cycle.outcome, /exactly one of four/); assert.match(cycle.outcome, /nine-month probation/);
  assert.equal(cycle.applicationWindow.closesOn, "2026-10-13"); assert.equal(cycle.applicationWindow.cutoffLocalTime, "15:00");
  assert.equal(cycle.applicationWindow.officialTimeZone, null); assert.equal(cycle.applicationWindow.opensOn, null);
  assert.equal(cycle.rules?.nationality?.stage, "outcome"); assert.equal(cycle.rules?.education, undefined);
  assert.equal(cycle.rules?.experience, undefined); assert.equal(cycle.rules?.languages, undefined);
  assert.match(cycle.languageNote!, /Only candidates opting.*B2/); assert.match(cycle.languageNote!, /not a blanket B2/);
  assert.match(cycle.languageNote!, /identical English PDF/);
  assert.match(cycle.qualifications, /CIPD Associate Diploma/); assert.match(cycle.qualifications, /desirable, not essential/);
  const foreign = evaluateEligibility(cycle.rules, { nationality: "IN", education: "doctorate", residenceCountry: "IE" });
  assert.equal(foreign.canApply.result, "needs-verification"); assert.equal(foreign.canEnterSelection.result, "needs-verification");
  assert.equal(foreign.canObtainOutcome.result, "needs-verification");
  assert.equal(foreign.canApply.checks.some((check) => check.rule === "nationality"), false);
  assert.match(foreign.canObtainOutcome.checks.find((check) => check.rule === "nationality")!.reason, /Stamp 4.*Stamp 5/);
  const eea = evaluateEligibility(cycle.rules, { nationality: "FR", education: "secondary" });
  assert.equal(eea.canObtainOutcome.checks.find((check) => check.rule === "nationality")!.result, "matches-published-criteria");
  assert.equal(eea.canObtainOutcome.result, "needs-verification", "Nationality cannot grant job without specialist qualifications and clearance");
  assert.equal(cycle.venues.some((venue) => "latitude" in venue), false);
});

test("Irish AO withholds changed notices, editions, PDFs and unregistered hosts", async () => {
  for (const change of ["deadline", "edition", "host", "missing", "card", "pdf", "irish-pdf"]) {
    await assert.rejects(ieAoSpecialist2026(context(change)), /changed|missing|withheld/, change);
  }
});

test("Irish AO public session routes do not change cycle identity; unknown timezone stays uncertain", async () => {
  const first = await ieAoSpecialist2026(context());
  const next = await ieAoSpecialist2026(context("session"));
  assert.deepEqual(first.cycles.map((cycle) => cycle.id), next.cycles.map((cycle) => cycle.id));
  assert.equal(next.cycles.length, 1);
  assert.equal((await ieAoSpecialist2026(context("", new Date("2026-10-13T14:00:00Z")))).cycles[0].status, "uncertain");
  assert.equal((await ieAoSpecialist2026(context("", new Date("2026-10-15T00:00:00Z")))).cycles[0].status, "closed");
});
