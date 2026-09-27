import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { dmerNashikFaculty2026, verifyDmerNashikIndex } from "./dmer-nashik-faculty-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const notice = JSON.parse(readFileSync(new URL("../data/extractions/dmer-nashik-faculty-2026.json", import.meta.url), "utf8")) as {
  indexUrl: string; noticeUrl: string; noticeSha256: string;
};
const html = readFileSync(new URL("../data/evidence/research/dmer-home-news-2026-09-25.html", import.meta.url), "utf8");
const pdf = readFileSync(new URL("../data/evidence/research/dmer-nashik-faculty-2026-09-24.pdf", import.meta.url));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-mh-dmer-nashik-faculty-2026")!;
const evidence = (url: string, bytes: Buffer): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"),
  bytes: bytes.length, contentType: url.endsWith(".pdf") ? "application/octet-stream" : "text/html",
});
function context(changed = false, now = new Date("2026-09-25T00:00:00Z")): ConnectorContext {
  return { source, now, env: {}, log: () => {},
    fetchText: async (url) => ({ text: html, evidence: evidence(url, Buffer.from(html)) }),
    fetchBytes: async (url) => {
      const bytes = changed ? Buffer.concat([pdf, Buffer.from("changed")]) : pdf;
      return { bytes, evidence: evidence(url, bytes) };
    },
  };
}

test("Maharashtra DMER dated index and exact Nashik PDF gate the draft", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyDmerNashikIndex(html));
  assert.throws(() => verifyDmerNashikIndex(html.replaceAll("September 24, 2026", "September 23, 2026")), /index changed/);
  assert.throws(() => verifyDmerNashikIndex(html.replaceAll("जाहिरात-04-शावैम-नाशिक.pdf", "other.pdf")), /index changed/);
  assert.equal(evidence(notice.noticeUrl, pdf).sha256, notice.noticeSha256);
  assert.equal((await dmerNashikFaculty2026(context())).evidence.length, 2);
  await assert.rejects(dmerNashikFaculty2026(context(true)), /PDF changed/);
});

test("Nashik counts one call and preserves international, language and timezone uncertainty", async () => {
  const cycle = (await dmerNashikFaculty2026(context())).cycles[0];
  assert.equal(cycle.status, "open");
  assert.equal(cycle.pathway, "recruitment");
  assert.equal(cycle.applicationWindow.closesOn, "2026-09-28");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "17:00");
  assert.equal(cycle.applicationWindow.officialTimeZone, null);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.equal(cycle.venues[0].kind, "published");
  assert.equal(cycle.applicationMethod, undefined);
  const foreign = evaluateEligibility(cycle.rules, { nationality: "US" });
  assert.equal(foreign.canApply.result, "needs-verification");
  assert.equal(foreign.canEnterSelection.result, "needs-verification");
  assert.equal(foreign.canObtainOutcome.result, "needs-verification");
  assert.equal((await dmerNashikFaculty2026(context(false, new Date("2026-09-28T00:00:00Z")))).cycles[0].status, "uncertain");
  assert.equal((await dmerNashikFaculty2026(context(false, new Date("2026-09-29T00:00:00Z")))).cycles[0].status, "closed");
});
