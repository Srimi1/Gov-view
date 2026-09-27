import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { btRcscBcse2026, verifyBcsePages } from "./bt-rcsc-bcse-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const data = JSON.parse(readFileSync(new URL("../data/extractions/bt-rcsc-bcse-2026.json", import.meta.url), "utf8")) as Record<string, string | number>;
const research = new URL("../data/evidence/research/", import.meta.url);
const pages = [
  readFileSync(new URL("bt-rcsc-bcse-announcement-page-2026.html", research), "utf8"),
  readFileSync(new URL("bt-rcsc-bcse-vacancies-page-2026.html", research), "utf8"),
  readFileSync(new URL("bt-rcsc-bcse-reprioritised-page-2026.html", research), "utf8"),
];
const pdfs = [
  readFileSync(new URL("bt-rcsc-bcse-announcement-2026.pdf", research)),
  readFileSync(new URL("bt-rcsc-bcse-vacancies-2026.pdf", research)),
  readFileSync(new URL("bt-rcsc-bcse-reprioritised-2026.pdf", research)),
];
const pageUrls = [data.announcementPageUrl, data.initialVacancyPageUrl, data.revisedVacancyPageUrl] as string[];
const pdfUrls = [data.announcementUrl, data.initialVacancyUrl, data.revisedVacancyUrl] as string[];
const pdfHashes = [data.announcementSha256, data.initialVacancySha256, data.revisedVacancySha256];
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "bt-rcsc-bcse-2026")!;
const evidence = (url: string, bytes: Buffer): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
  contentType: url.endsWith(".pdf") ? "application/pdf" : "text/html",
});
function context(changed = false, now = new Date("2026-09-25T00:00:00Z")): ConnectorContext {
  return { source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      const index = pageUrls.indexOf(url);
      assert.ok(index >= 0);
      return { text: pages[index], evidence: evidence(url, Buffer.from(pages[index])) };
    },
    fetchBytes: async (url) => {
      const index = pdfUrls.indexOf(url);
      assert.ok(index >= 0);
      const bytes = changed && index === 2 ? Buffer.concat([pdfs[index], Buffer.from("changed")]) : pdfs[index];
      return { bytes, evidence: evidence(url, bytes) };
    },
  };
}

test("RCSC BCSE pages and all three exact PDFs gate extraction", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyBcsePages(pages[0], pages[1], pages[2]));
  assert.throws(() => verifyBcsePages(pages[0], pages[1], pages[2].replace("742 vacancies reprioritised", "743 vacancies reprioritised")), /changed/);
  assert.throws(() => verifyBcsePages(pages[0], pages[1].replaceAll("LETTER-HEAD-NEW.docx.pdf", "replacement.pdf"), pages[2]), /changed/);
  pdfs.forEach((pdf, index) => assert.equal(evidence(pdfUrls[index], pdf).sha256, pdfHashes[index]));
  await assert.rejects(btRcscBcse2026(context(true)), /PDF changed/);
});

test("BCSE registration counts once, closes in July, and separates citizenship from language tests", async () => {
  const result = await btRcscBcse2026(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "closed");
  assert.equal(cycle.applicationWindow.opensOn, "2026-06-08");
  assert.equal(cycle.applicationWindow.closesOn, "2026-07-07");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.equal(cycle.applicationWindow.officialTimeZone, null);
  assert.match(cycle.outcome, /711.*742/);
  assert.equal(cycle.rules?.nationality?.stage, "selection");
  assert.equal(cycle.rules?.languages, undefined);
  const foreign = evaluateEligibility(cycle.rules, { nationality: "IN" });
  assert.equal(foreign.canApply.result, "needs-verification");
  assert.equal(foreign.canEnterSelection.result, "does-not-match");
  assert.equal(foreign.canObtainOutcome.result, "does-not-match");
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal((await btRcscBcse2026(context(false, new Date("2026-07-07T12:00:00Z")))).cycles[0].status, "uncertain");
});
