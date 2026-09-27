import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { nlsiuProfessorLaw2026, verifyNlsiuProfessorPages } from "./nlsiu-professor-law-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const data = JSON.parse(readFileSync(new URL("../data/extractions/nlsiu-professor-law-2026.json", import.meta.url), "utf8")) as {
  indexUrl: string; facultyUrl: string; noticeUrl: string; pdfUrl: string; pdfSha256: string; applicationUrl: string;
};
const pages = new Map([
  [data.indexUrl, readFileSync(new URL("../data/evidence/research/nlsiu-work-with-us-2026.html", import.meta.url), "utf8")],
  [data.facultyUrl, readFileSync(new URL("../data/evidence/research/nlsiu-faculty-september-2026.html", import.meta.url), "utf8")],
  [data.noticeUrl, readFileSync(new URL("../data/evidence/research/nlsiu-professor-law-2026.html", import.meta.url), "utf8")],
]);
const pdf = readFileSync(new URL("../data/evidence/research/nlsiu-professor-law-notification-15-2026.pdf", import.meta.url));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-ka-nlsiu-professor-law-2026")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType,
});

function context(changedPdf = false, now = new Date("2026-09-25T00:00:00Z")): ConnectorContext {
  return {
    source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      const html = pages.get(url);
      assert.ok(html);
      return { text: html, evidence: evidence(url, Buffer.from(html), "text/html") };
    },
    fetchBytes: async (url) => {
      assert.equal(url, data.pdfUrl);
      const bytes = changedPdf ? Buffer.concat([pdf, Buffer.from("changed")]) : pdf;
      return { bytes, evidence: evidence(url, bytes, "application/pdf") };
    },
  };
}

test("NLSIU index, role terms and exact PDF gate extraction", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.equal(createHash("sha256").update(pdf).digest("hex"), data.pdfSha256);
  const [index, faculty, notice] = [...pages.values()];
  assert.doesNotThrow(() => verifyNlsiuProfessorPages(index, faculty, notice));
  assert.throws(() => verifyNlsiuProfessorPages(index, faculty.replace("Professor (Law) &#8211; Permanent | 5 Vacancies", "Professor (Law) &#8211; Permanent | 4 Vacancies"), notice), /changed/);
  assert.throws(() => verifyNlsiuProfessorPages(index, faculty, notice.replace("Foreign nationals/OCI/NRI/PIO are permitted to apply", "Foreign nationals are not permitted to apply")), /changed/);
  assert.throws(() => verifyNlsiuProfessorPages(index, faculty, notice.replace("26 October 2026 at 17:00 hrs IST", "26 October 2026 at 16:00 hrs IST")), /changed/);
  await assert.rejects(nlsiuProfessorLaw2026(context(true)), /PDF changed|notification changed/);
});

test("NLSIU one cycle separates foreign application from visa-dependent appointment", async () => {
  const result = await nlsiuProfessorLaw2026(context());
  assert.equal(result.cycles.length, 1);
  assert.equal(result.complete, false);
  assert.equal(result.evidence.length, 4);
  const cycle = result.cycles[0];
  assert.equal(cycle.pathway, "recruitment");
  assert.equal(cycle.appointmentType, "permanent");
  assert.equal(cycle.applicationWindow.closesOn, "2026-10-26");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "17:00");
  assert.equal(cycle.applicationWindow.officialTimeZone, "Asia/Kolkata");
  assert.equal(cycle.applicationUrl, data.applicationUrl);
  assert.deepEqual(cycle.rules?.nationality?.allowed, ["*"]);
  assert.equal(cycle.rules?.languages, undefined);
  assert.equal(cycle.venues[0].kind, "unknown");
  const foreign = evaluateEligibility(cycle.rules, { nationality: "US" });
  assert.equal(foreign.canApply.checks.find((check) => check.rule === "nationality")?.result, "matches-published-criteria");
  assert.equal(foreign.canApply.result, "needs-verification");
  assert.equal(foreign.canEnterSelection.result, "needs-verification");
  assert.equal(foreign.canObtainOutcome.result, "needs-verification");
  assert.equal(cycle.status, "open");
  assert.equal((await nlsiuProfessorLaw2026(context(false, new Date("2026-10-26T11:29:00Z")))).cycles[0].status, "open");
  assert.equal((await nlsiuProfessorLaw2026(context(false, new Date("2026-10-26T11:31:00Z")))).cycles[0].status, "closed");
});
