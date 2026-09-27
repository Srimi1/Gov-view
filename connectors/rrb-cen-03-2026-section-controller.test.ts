import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { rrbCen032026SectionController, verifyRrbSectionControllerArchive } from "./rrb-cen-03-2026-section-controller.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const data = JSON.parse(readFileSync(new URL("../data/extractions/rrb-cen-03-2026-section-controller.json", import.meta.url), "utf8")) as {
  archiveUrl: string; noticeUrl: string; noticeSha256: string; corrigendumUrl: string; corrigendumSha256: string;
};
const archive = readFileSync(new URL("../data/evidence/research/rrb-secunderabad-notices-2026.html", import.meta.url), "utf8");
const notice = readFileSync(new URL("../data/evidence/research/rrb-cen-03-2026-section-controller-en.pdf", import.meta.url));
const corrigendum = readFileSync(new URL("../data/evidence/research/rrb-cen-03-2026-corrigendum-1.pdf", import.meta.url));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-rrb-railways")!;
const evidence = (url: string, bytes: Buffer): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
  contentType: url.endsWith(".pdf") ? "application/pdf" : "text/html",
});
function context(changed = false, now = new Date("2026-09-25T00:00:00Z")): ConnectorContext {
  return { source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      assert.equal(url, data.archiveUrl);
      return { text: archive, evidence: evidence(url, Buffer.from(archive)) };
    },
    fetchBytes: async (url) => {
      assert.ok(url === data.noticeUrl || url === data.corrigendumUrl);
      const original = url === data.noticeUrl ? notice : corrigendum;
      const bytes = changed && url === data.noticeUrl ? Buffer.concat([original, Buffer.from("changed")]) : original;
      return { bytes, evidence: evidence(url, bytes) };
    },
  };
}

test("RRB archive binds both original PDFs and halts on a new corrigendum or altered notice", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyRrbSectionControllerArchive(archive));
  assert.throws(() => verifyRrbSectionControllerArchive(archive.replaceAll("FINAL-CEN-03_2026_SECTION-CONTROLLER.pdf", "revised.pdf")), /changed/);
  assert.throws(() => verifyRrbSectionControllerArchive(archive.replaceAll("Date : 17/07/2026", "Date : 18/07/2026")), /changed/);
  assert.throws(() => verifyRrbSectionControllerArchive(archive.replaceAll("CEN 03/2026 (Section Controller) - Corrigendum No.1", "CEN 03/2026 (Section Controller) - Corrigendum No.2")), /changed/);
  assert.equal(evidence(data.noticeUrl, notice).sha256, data.noticeSha256);
  assert.equal(evidence(data.corrigendumUrl, corrigendum).sha256, data.corrigendumSha256);
  await assert.rejects(rrbCen032026SectionController(context(true)), /PDF changed/);
});

test("national railway cycle keeps 119 vacancies as one closed cycle and foreign pathways conditional", async () => {
  const result = await rrbCen032026SectionController(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  const cycle = result.cycles[0];
  assert.equal(cycle.id, "rrb-cen-03-2026-section-controller");
  assert.equal(cycle.status, "closed");
  assert.match(cycle.outcome, /^119 provisional/);
  assert.equal(cycle.applicationWindow.opensOn, "2026-07-15");
  assert.equal(cycle.applicationWindow.closesOn, "2026-08-14");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "23:59");
  assert.equal(cycle.applicationWindow.officialTimeZone, null);
  assert.equal(cycle.appointmentType, undefined);
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(cycle.syllabus?.status, "pending");
  assert.equal(cycle.rules?.languages?.[0].framework, undefined);
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "NP", education: "bachelor" }).canApply.result, "needs-verification");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", education: "bachelor" }).canApply.result, "needs-verification");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN", education: "secondary" }).canApply.result, "does-not-match");
  assert.equal((await rrbCen032026SectionController(context(false, new Date("2026-08-14T08:00:00Z")))).cycles[0].status, "uncertain");
});
