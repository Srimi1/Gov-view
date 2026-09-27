import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { venueText } from "../lib/format.ts";
import { icmrNihrBhubaneswarJuniorConsultant2026, verifyNihrBhubaneswarPages } from "./icmr-nihr-bhubaneswar-junior-consultant-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const data = JSON.parse(readFileSync(new URL("../data/extractions/icmr-nihr-bhubaneswar-junior-consultant-2026.json", import.meta.url), "utf8")) as Record<string, string | number>;
const root = new URL("../data/evidence/research/", import.meta.url);
const pages = ["icmr-employment-2026.html", "icmr-nihr-bhubaneswar-career-2026.html", "icmr-nihr-bhubaneswar-junior-consultant-detail-2026.html"]
  .map((name) => readFileSync(new URL(name, root), "utf8"));
const pageUrls = [data.indexUrl, data.careerUrl, data.detailUrl] as string[];
const documents = ["english", "hindi", "institute"].map((name) =>
  readFileSync(new URL(`icmr-nihr-bhubaneswar-junior-consultant-2026-${name}.pdf`, root)));
const documentUrls = [data.englishUrl, data.hindiUrl, data.instituteHindiUrl] as string[];
const documentHashes = [data.englishSha256, data.hindiSha256, data.instituteHindiSha256];
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-icmr-nihr-bhubaneswar-junior-consultant-2026")!;

const evidence = (url: string, bytes: Buffer): Evidence => ({ url, fetchedAt: "2026-09-25T00:00:00Z",
  sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
  contentType: url.endsWith(".pdf") ? "application/pdf" : "text/html" });
function context(changed = false, now = new Date("2026-09-25T00:00:00Z")): ConnectorContext {
  return { source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      const index = pageUrls.indexOf(url);
      assert.ok(index >= 0);
      return { text: pages[index], evidence: evidence(url, Buffer.from(pages[index])) };
    },
    fetchBytes: async (url) => {
      const index = documentUrls.indexOf(url);
      assert.ok(index >= 0);
      const bytes = changed && index === 0 ? Buffer.concat([documents[index], Buffer.from("changed")]) : documents[index];
      return { bytes, evidence: evidence(url, bytes) };
    },
  };
}

test("NIHR September intake is bound to current index, career row and original PDFs", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyNihrBhubaneswarPages(pages[0], pages[1], pages[2]));
  assert.throws(() => verifyNihrBhubaneswarPages(pages[0].replaceAll("1790076083_dristienglishadvt.pdf", "replacement.pdf"), pages[1], pages[2]), /changed/);
  const newAmendment = pages[1].replace("</table>", "<tr><td>Corrigendum for DRISTI Junior Consultant (Medical)</td><td>25/09/2026</td></tr></table>");
  assert.throws(() => verifyNihrBhubaneswarPages(pages[0], newAmendment, pages[2]), /later amendment/);
  documents.forEach((pdf, index) => assert.equal(evidence(documentUrls[index], pdf).sha256, documentHashes[index]));
  await assert.rejects(icmrNihrBhubaneswarJuniorConsultant2026(context(true)), /PDF changed/);
});

test("NIHR walk-in is one contract, with uncertain international and language eligibility", async () => {
  const result = await icmrNihrBhubaneswarJuniorConsultant2026(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "upcoming");
  assert.equal(cycle.appointmentType, "contract");
  assert.equal(cycle.applicationMethod, "in-person");
  assert.equal(cycle.applicationWindow.closesOn, "2026-09-29");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.equal(cycle.applicationWindow.officialTimeZone, null);
  assert.equal(cycle.rules?.age, undefined);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.equal(cycle.venues[0].kind, "published-address");
  assert.match(venueText(cycle), /Annex Building.*map pin unavailable/);
  const foreign = evaluateEligibility(cycle.rules, { nationality: "US" });
  assert.equal(foreign.canApply.result, "needs-verification");
  assert.equal(foreign.canObtainOutcome.result, "needs-verification");
  assert.equal((await icmrNihrBhubaneswarJuniorConsultant2026(context(false, new Date("2026-09-29T07:00:00Z")))).cycles[0].status, "uncertain");
  assert.equal((await icmrNihrBhubaneswarJuniorConsultant2026(context(false, new Date("2026-09-30T00:00:00Z")))).cycles[0].status, "closed");
});
