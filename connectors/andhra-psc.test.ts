import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { ANDHRA_INDEX, andhraPsc, parseAndhraIndex } from "./andhra-psc.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { liveStatus } from "../lib/opportunities.ts";

const root = new URL("../data/evidence/research/", import.meta.url);
const html = readFileSync(new URL("andhra-recruitment.html", root), "utf8");
const pdf = readFileSync(new URL("andhra-16-2026.pdf", root));
const pdfUrl = "https://psc.ap.gov.in/Documents/NotificationDocuments/Forest_Range_Officer_162026.pdf";
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-ap-recruitment")!;
const evidence = (url: string, bytes: Buffer): Evidence => ({ url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType: url.endsWith(".pdf") ? "application/pdf" : "text/html", bytes: bytes.length });
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => ({ text: html, evidence: evidence(url, Buffer.from(html)) }),
  fetchBytes: async (url) => ({ bytes: pdf, evidence: evidence(url, pdf) }),
  ...override,
});

test("Andhra index ties brief notification 16/2026 to one official PDF", () => {
  const parsed = parseAndhraIndex(html);
  assert.equal(parsed.selected.url, pdfUrl);
  assert.ok(parsed.count2026 >= 20);
  assert.throws(() => parseAndhraIndex(html.replace(pdfUrl, "https://example.org/notice.pdf")), /outside official PDF archive/);
  assert.throws(() => parseAndhraIndex(html.replace(pdfUrl, "https://psc.ap.gov.in/Documents/NotificationDocuments/changed.pdf")), /changed or amended/);
  const duplicated = html.replace(/(<li>\s*<a href="https:\/\/psc\.ap\.gov\.in\/Documents\/NotificationDocuments\/Forest_Range_Officer_162026\.pdf"[\s\S]*?<\/li>)/, "$1$1");
  assert.throws(() => parseAndhraIndex(duplicated), /changed or amended/);
});

test("Andhra future cycle keeps international eligibility uncertain and both qualifying languages explicit", async () => {
  const result = await andhraPsc(context());
  assert.equal(source.homepage, ANDHRA_INDEX);
  assert.equal(source.reviewRequired, true);
  assert.equal(source.enabled, false);
  assert.equal(result.cycles.length, 1);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "upcoming");
  assert.equal(cycle.applicationWindow.opensOn, "2026-10-16");
  assert.equal(cycle.applicationWindow.closesOn, "2026-11-05");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "23:59");
  assert.equal(cycle.applicationWindow.officialTimeZone, null);
  assert.ok(cycle.selectionStages.some((stage) => /Walking test and Medical Board/.test(stage)));
  assert.ok(cycle.selectionStages.some((stage) => /Computer Proficiency Test/.test(stage)));
  assert.deepEqual(cycle.rules?.languages?.map((rule) => rule.language), ["en", "te"]);
  assert.ok(cycle.rules?.languages?.every((rule) => !rule.framework && rule.stage === "selection"));
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US" }).canApply.result, "needs-verification");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN" }).canEnterSelection.result, "needs-verification");
  assert.equal(cycle.venues[0].kind, "unknown");
});

test("Andhra unknown timezone cannot create an Indian midnight cutoff", async () => {
  const cycle = (await andhraPsc(context())).cycles[0];
  assert.equal(liveStatus(cycle, new Date("2026-11-05T18:30:00Z")), "uncertain");
  assert.equal(liveStatus(cycle, new Date("2026-11-06T12:00:00Z")), "closed");
});

test("Andhra changed PDF or detailed-notice date blocks stale brief extraction", async () => {
  await assert.rejects(() => andhraPsc(context({ fetchBytes: async (url) => ({ bytes: Buffer.concat([pdf, Buffer.from("changed")]), evidence: evidence(url, Buffer.concat([pdf, Buffer.from("changed")])) }) })), /bytes changed/);
  await assert.rejects(() => andhraPsc(context({ now: new Date("2026-10-16T00:00:00+05:30") })), /detailed notice is due/);
});
