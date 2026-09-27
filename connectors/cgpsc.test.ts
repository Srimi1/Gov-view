import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { cgpsc, CGPSC_INDEX, parseCgpscArchive } from "./cgpsc.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";

const archive = readFileSync(new URL("../data/evidence/research/cgpsc-advertisements.html", import.meta.url), "utf8");
const document = readFileSync(new URL("../data/evidence/research/cgpsc-05-2026.pdf", import.meta.url));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-ct-recruitment")!;
const evidence = (url: string, bytes: Buffer): Evidence => ({ url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType: url.endsWith(".pdf") ? "application/pdf" : "text/html", bytes: bytes.length });
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => ({ text: archive, evidence: evidence(url, Buffer.from(archive)) }),
  fetchBytes: async (url) => ({ bytes: document, evidence: evidence(url, document) }),
  ...override,
});

test("CGPSC archive selects one original notice and fails on new microbiologist amendments", () => {
  const parsed = parseCgpscArchive(archive);
  assert.equal(parsed.selected.url, "https://psc.cg.gov.in/PDFs/advertisement/MICRO_BIOLOGIST_ADVERTISEMENT%20(08-09-2026).pdf");
  assert.ok(parsed.notices.length > 5);
  assert.throws(() => parseCgpscArchive(archive.replace("MICRO_BIOLOGIST_ADVERTISEMENT (08-09-2026).pdf", "MICRO_BIOLOGIST_ADVERTISEMENT (09-09-2026).pdf")), /changed/);
  assert.throws(() => parseCgpscArchive(archive.replace("PDFs/advertisement/MICRO_BIOLOGIST_ADVERTISEMENT", "https://example.org/PDFs/advertisement/MICRO_BIOLOGIST_ADVERTISEMENT")), /outside official archive/);
});

test("CGPSC counts separately applied posts and keeps international applicant eligibility uncertain", async () => {
  const result = await cgpsc(context());
  assert.equal(result.cycles.length, 2);
  assert.deepEqual(result.cycles.map((cycle) => cycle.id), ["cgpsc-2026-05-food-lab", "cgpsc-2026-05-drug-lab"]);
  assert.ok(result.cycles.every((cycle) => cycle.status === "uncertain"));
  assert.ok(result.cycles.every((cycle) => cycle.applicationWindow.officialTimeZone === null));
  assert.ok(result.cycles.every((cycle) => cycle.applicationWindow.closesOn === "2026-10-09" && cycle.applicationWindow.cutoffLocalTime === "23:59"));
  assert.ok(result.cycles.every((cycle) => cycle.sources.some((item) => item.format === "PDF" && item.language === "Hindi")));
  assert.ok(result.cycles.every((cycle) => cycle.rules === null && /need verification/.test(cycle.citizenshipRule)));
  assert.equal(evaluateEligibility(result.cycles[0].rules, { nationality: "US" }).canApply.result, "needs-verification");
  assert.ok(result.cycles.every((cycle) => !cycle.rules?.languages?.length));
  assert.equal(source.reviewRequired, true);
  assert.equal(source.enabled, false);
  assert.equal(source.homepage, CGPSC_INDEX);
});

test("CGPSC unknown timezone keeps deadline boundary uncertain until all civil dates pass", async () => {
  const boundary = await cgpsc(context({ now: new Date("2026-10-09T18:30:00Z") }));
  assert.ok(boundary.cycles.every((cycle) => cycle.status === "uncertain"));
  const safeClose = await cgpsc(context({ now: new Date("2026-10-10T12:00:00Z") }));
  assert.ok(safeClose.cycles.every((cycle) => cycle.status === "closed"));
});

test("CGPSC changed notice bytes cannot reuse extracted dates or job identities", async () => {
  await assert.rejects(() => cgpsc(context({ fetchBytes: async (url) => {
    const bytes = Buffer.concat([document, Buffer.from("changed")]);
    return { bytes, evidence: evidence(url, bytes) };
  } })), /bytes changed/);
});
