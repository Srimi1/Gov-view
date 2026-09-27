import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { jharkhandJjbCwc2026, verifyJharkhandChildProtectionIndex } from "./jharkhand-jjb-cwc-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const extraction = JSON.parse(readFileSync(new URL("../data/extractions/jharkhand-jjb-cwc-2026.json", import.meta.url), "utf8")) as {
  indexUrl: string; notices: { documentUrl: string; sha256: string }[];
};
const index = readFileSync(new URL("../data/evidence/research/jharkhand-recruitment-home-2026-09-25.html", import.meta.url), "utf8");
const pdf198 = readFileSync(new URL("../data/evidence/research/jharkhand-jjb-file-198.pdf", import.meta.url));
const pdf199 = readFileSync(new URL("../data/evidence/research/jharkhand-jjb-cwc-file-199.pdf", import.meta.url));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-jh-jjb-cwc-2026")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType,
});
function context(changed = false, now = new Date("2026-09-25T00:00:00Z")): ConnectorContext {
  return {
    source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      assert.equal(url, extraction.indexUrl);
      return { text: index, evidence: evidence(url, Buffer.from(index), "text/html") };
    },
    fetchBytes: async (url) => {
      const original = url.endsWith("198") ? pdf198 : url.endsWith("199") ? pdf199 : null;
      assert.ok(original, `unexpected PDF ${url}`);
      const bytes = changed && url.endsWith("199") ? Buffer.concat([original, Buffer.from("changed")]) : original;
      return { bytes, evidence: evidence(url, bytes, "application/pdf") };
    },
  };
}

test("Jharkhand index binds two distinct honorary notices and exact PDFs", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyJharkhandChildProtectionIndex(index));
  assert.throws(() => verifyJharkhandChildProtectionIndex(index.replace("10/10/2026 11:59 PM", "11/10/2026 11:59 PM")), /deadline changed/);
  assert.throws(() => verifyJharkhandChildProtectionIndex(index.replace("/Home/fileDownload/199", "/Home/fileDownload/200")), /link changed/);
  assert.throws(() => verifyJharkhandChildProtectionIndex(index.replace("<h2>Notice</h2>", "<li>JJB corrigendum</li><h2>Notice</h2>")), /notice set changed/);
  assert.throws(() => verifyJharkhandChildProtectionIndex(index.replace("<h2>Notice</h2>", "<h2>Notice</h2><li>JJB corrigendum</li>")), /later notice/);
  assert.equal(createHash("sha256").update(pdf198).digest("hex"), extraction.notices[0].sha256);
  assert.equal(createHash("sha256").update(pdf199).digest("hex"), extraction.notices[1].sha256);
  const result = await jharkhandJjbCwc2026(context());
  assert.equal(result.cycles.length, 2);
  assert.equal(result.evidence.length, 3);
  assert.equal(result.complete, false);
  await assert.rejects(jharkhandJjbCwc2026(context(true)), /PDF changed/);
});

test("Jharkhand cycles count applications once and leave foreign and language eligibility unresolved", async () => {
  const [jjb, combined] = (await jharkhandJjbCwc2026(context())).cycles;
  assert.equal(jjb.applicationWindow.closesOn, "2026-10-10");
  assert.equal(combined.applicationWindow.closesOn, "2026-10-15");
  assert.equal(combined.applicationWindow.cutoffLocalTime, "23:59");
  assert.equal(combined.applicationWindow.officialTimeZone, null);
  assert.equal(combined.status, "open");
  assert.match(combined.scopeLabel ?? "", /Four JJB and seven CWC/);
  assert.match(combined.outcome, /honorary/);
  assert.equal(combined.venues[0].kind, "unknown");
  assert.equal(combined.rules?.nationality, undefined);
  assert.equal(combined.rules?.languages, undefined);
  assert.equal(evaluateEligibility(combined.rules, { nationality: "US" }).canApply.result, "needs-verification");
  assert.equal(evaluateEligibility(combined.rules, { nationality: "IN" }).canApply.result, "needs-verification");
  assert.equal((await jharkhandJjbCwc2026(context(false, new Date("2026-10-17T12:00:00Z")))).cycles[0].status, "closed");
});
