import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { mirsacGroupD2026, verifyMirsacPages } from "./mirsac-group-d-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const notice = JSON.parse(readFileSync(new URL("../data/extractions/mirsac-group-d-2026.json", import.meta.url), "utf8")) as {
  registerUrl: string; detailUrl: string; noticeUrl: string; noticeSha256: string; formUrl: string; formSha256: string;
};
const research = new URL("../data/evidence/research/", import.meta.url);
const register = readFileSync(new URL("mirsac-all-news-2026.html", research), "utf8");
const detail = readFileSync(new URL("mirsac-group-d-page.html", research), "utf8");
const pdf = readFileSync(new URL("mirsac-group-d-2026.pdf", research));
const form = readFileSync(new URL("mirsac-group-d-2026-form.pdf", research));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-mz-mirsac-group-d-2026")!;
const evidence = (url: string, bytes: Buffer): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
  contentType: url.endsWith(".pdf") ? "application/pdf" : "text/html",
});
function context(changed = false, now = new Date("2026-09-25T00:00:00Z")): ConnectorContext {
  return {
    source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      assert.ok(url === notice.registerUrl || url === notice.detailUrl);
      const html = url === notice.registerUrl ? register : detail;
      return { text: html, evidence: evidence(url, Buffer.from(html)) };
    },
    fetchBytes: async (url) => {
      assert.ok(url === notice.noticeUrl || url === notice.formUrl);
      const original = url === notice.noticeUrl ? pdf : form;
      const bytes = changed && url === notice.noticeUrl ? Buffer.concat([original, Buffer.from("changed")]) : original;
      return { bytes, evidence: evidence(url, bytes) };
    },
  };
}

test("MIRSAC live article, register and both exact PDFs gate scanned recruitment facts", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyMirsacPages(register, detail));
  assert.throws(() => verifyMirsacPages(register, detail.replace("30 October 2026", "31 October 2026")), /changed/);
  assert.throws(() => verifyMirsacPages(register, detail.replace("MIRSAC-Recruitment-2026.pdf", "revision.pdf")), /changed/);
  assert.throws(() => verifyMirsacPages(register, detail.replace("</div><!-- .entry-content .clear -->", "<p>Corrigendum issued</p></div><!-- .entry-content .clear -->")), /changed/);
  assert.equal(evidence(notice.noticeUrl, pdf).sha256, notice.noticeSha256);
  assert.equal(evidence(notice.formUrl, form).sha256, notice.formSha256);
  assert.equal((await mirsacGroupD2026(context())).evidence.length, 4);
  await assert.rejects(mirsacGroupD2026(context(true)), /PDF changed/);
});

test("MIRSAC counts one application; foreign eligibility and Mizo level remain evidence-bounded", async () => {
  const cycle = (await mirsacGroupD2026(context())).cycles[0];
  assert.equal(cycle.id, "mirsac-group-d-pe-2026");
  assert.equal(cycle.appointmentType, "temporary");
  assert.match(cycle.outcome, /^2 Group D Provisional Employee positions/);
  assert.equal(cycle.status, "open");
  assert.equal(cycle.applicationWindow.opensOn, null);
  assert.equal(cycle.applicationWindow.closesOn, "2026-10-30");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.equal(cycle.applicationWindow.officialTimeZone, null);
  assert.equal(cycle.applicationMethod, "in-person");
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US" }).canApply.result, "needs-verification");
  assert.equal(cycle.rules?.languages?.[0].language, "lus");
  assert.equal(cycle.rules?.languages?.[0].framework, undefined);
  assert.match(cycle.rules?.languages?.[0].requirement ?? "", /Class VIII/);
  assert.equal(cycle.rules?.education?.minLevel, "secondary");
  assert.equal(evaluateEligibility(cycle.rules, { education: "none" }).canApply.result, "does-not-match");
  assert.equal((await mirsacGroupD2026(context(false, new Date("2026-10-30T08:00:00Z")))).cycles[0].status, "uncertain");
  assert.equal((await mirsacGroupD2026(context(false, new Date("2026-10-31T00:00:00Z")))).cycles[0].status, "closed");
});
