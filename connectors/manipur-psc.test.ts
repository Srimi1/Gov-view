import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { MANIPUR_INDEX, manipurPsc, parseManipurIndex } from "./manipur-psc.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const root = new URL("../data/evidence/research/", import.meta.url);
const html = readFileSync(new URL("manipur-whats-new.html", root), "utf8");
const pdf = readFileSync(new URL("manipur-04-2026.pdf", root));
const pdfUrl = "https://mpscmanipur.gov.in/files/MPSC_26092317020.pdf";
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-mn-recruitment")!;
const evidence = (url: string, bytes: Buffer): Evidence => ({ url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType: url.endsWith(".pdf") ? "application/pdf" : "text/html", bytes: bytes.length });
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => ({ text: html, evidence: evidence(url, Buffer.from(html)) }),
  fetchBytes: async (url) => ({ bytes: pdf, evidence: evidence(url, pdf) }),
  ...override,
});

test("Manipur latest-notices row binds advertisement and syllabus to official PDFs", () => {
  const parsed = parseManipurIndex(html);
  assert.equal(parsed.notice.url.href, pdfUrl);
  assert.equal(parsed.syllabusUrl, "https://mpscmanipur.gov.in/files/DS_Syllabus_2026.pdf");
  assert.throws(() => parseManipurIndex(html.replace("files/MPSC_26092317020.pdf", "https://example.org/notice.pdf")), /outside official PDF archive/);
  assert.throws(() => parseManipurIndex(html.replace("files/MPSC_26092317020.pdf", "files/changed.pdf")), /notice changed/);
  const duplicated = html.replace(/(<tr>\s*<td><\/td>\s*<td>\s*<a class="notification-link" href="files\/MPSC_26092317020\.pdf">[\s\S]*?<\/tr>)/, "$1$1");
  assert.throws(() => parseManipurIndex(duplicated), /missing or amended/);
});

test("Manipur draft states foreign-citizen exclusion and leaves other eligibility under review", async () => {
  const result = await manipurPsc(context());
  assert.equal(source.homepage, MANIPUR_INDEX);
  assert.equal(source.reviewRequired, true);
  assert.equal(source.enabled, false);
  assert.equal(result.cycles.length, 1);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "upcoming");
  assert.equal(cycle.applicationWindow.opensOn, "2026-09-28");
  assert.equal(cycle.applicationWindow.closesOn, "2026-10-18");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "23:59");
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(cycle.rules?.languages?.[0].framework, undefined);
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US" }).canApply.result, "does-not-match");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN" }).canApply.result, "needs-verification");
  assert.equal(cycle.sources[1].format, "scanned PDF");
  assert.equal(cycle.sources[1].lastValidatedAt, null);
});

test("Manipur changed PDF blocks stale eligibility; dates retain local cutoff", async () => {
  const changed = Buffer.concat([pdf, Buffer.from("changed")]);
  await assert.rejects(() => manipurPsc(context({ fetchBytes: async (url) => ({ bytes: changed, evidence: evidence(url, changed) }) })), /PDF changed/);
  const opened = await manipurPsc(context({ now: new Date("2026-09-28T00:00:00+05:30") }));
  assert.equal(opened.cycles[0].status, "open");
  const closed = await manipurPsc(context({ now: new Date("2026-10-19T00:00:00+05:30") }));
  assert.equal(closed.cycles[0].status, "closed");
});
