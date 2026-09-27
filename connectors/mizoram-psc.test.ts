import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { languageName } from "../lib/eligibility/languages.ts";
import { checkMizoramAmendments, MIZORAM_AMENDMENTS, MIZORAM_INDEX, mizoramPsc, parseMizoramIndex } from "./mizoram-psc.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const root = new URL("../data/evidence/research/", import.meta.url);
const html = readFileSync(new URL("mizoram-advertisements-2026-27.html", root), "utf8");
const amendments = readFileSync(new URL("mizoram-corrigenda.html", root), "utf8");
const documents = new Map([
  ["https://mpsc.mizoram.gov.in/uploads/attachments/2026/09/17dca86bb7be076440b21bddde555703/advertisement-no25-of-2026-27-lower-divisional-clerkldc-under-mpsc.pdf", readFileSync(new URL("mizoram-25-2026-27-ldc.pdf", root))],
  ["https://mpsc.mizoram.gov.in/uploads/attachments/2026/09/a9a8a87b7b07a57b38320c2d4cc679e8/advertisement-no26-of-2026-27-peon-under-mpsc.pdf", readFileSync(new URL("mizoram-26-2026-27-peon.pdf", root))],
  ["https://mpsc.mizoram.gov.in/uploads/attachments/2024/07/52ea207563543b0339fa1815438dadbb/notification-mizo-language-proficiency-qualifying-test-for-all-direct-recruitment-examinations.pdf", readFileSync(new URL("mizoram-mizo-language-2024.pdf", root))],
]);
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-mz-recruitment")!;
const evidence = (url: string, bytes: Buffer): Evidence => ({ url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType: url.endsWith(".pdf") ? "application/pdf" : "text/html", bytes: bytes.length });
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => ({ text: url === MIZORAM_INDEX ? html : amendments, evidence: evidence(url, Buffer.from(url === MIZORAM_INDEX ? html : amendments)) }),
  fetchBytes: async (url) => { const bytes = documents.get(url); if (!bytes) throw Error(`unexpected URL ${url}`); return { bytes, evidence: evidence(url, bytes) }; },
  ...override,
});

test("Mizoram archive binds two current rows to official PDFs and dates", () => {
  const parsed = parseMizoramIndex(html);
  assert.deepEqual(parsed.map((entry) => entry.post.advertisement), ["26/2026-27", "25/2026-27"]);
  assert.throws(() => parseMizoramIndex(html.replace("13.10.2026", "14.10.2026")), /dates or PDF changed/);
  assert.throws(() => parseMizoramIndex(html.replace("/uploads/attachments/2026/09/a9a8a87b7b07a57b38320c2d4cc679e8/advertisement-no26-of-2026-27-peon-under-mpsc.pdf", "https://example.org/notice.pdf")), /outside official PDF archive/);
  const row = /(<tr><td[^>]*>1<\/td>[\s\S]*?<\/tr>)/.exec(html)?.[1];
  assert.ok(row);
  assert.throws(() => parseMizoramIndex(html.replace(row, `${row}${row}`)), /missing or duplicated/);
  checkMizoramAmendments(amendments);
  assert.throws(() => checkMizoramAmendments(amendments.replace("</body>", "<p>Corrigendum to Advertisement No.26 of 2026-27</p></body>")), /new amendment/);
});

test("Mizoram cycles keep foreign eligibility uncertain and exact Mizo test wording", async () => {
  const result = await mizoramPsc(context());
  assert.equal(source.homepage, MIZORAM_INDEX);
  assert.equal(source.reviewRequired, true);
  assert.equal(source.enabled, false);
  assert.equal(MIZORAM_AMENDMENTS, "https://mpsc.mizoram.gov.in/page/corrigendumaddendum");
  assert.equal(result.cycles.length, 2);
  const ldc = result.cycles.find((item) => item.title.includes("Clerk"))!;
  const peon = result.cycles.find((item) => item.title.includes("Peon"))!;
  assert.equal(ldc.applicationWindow.closesOn, "2026-10-12");
  assert.equal(peon.applicationWindow.closesOn, "2026-10-13");
  assert.equal(ldc.applicationWindow.cutoffLocalTime, "16:00");
  assert.equal(ldc.applicationWindow.opensOn, null);
  assert.equal(ldc.status, "uncertain");
  assert.equal(ldc.venues[0].kind, "unknown");
  assert.equal(ldc.rules?.nationality, undefined);
  assert.equal(evaluateEligibility(ldc.rules, { nationality: "US" }).canApply.result, "needs-verification");
  assert.equal(languageName("lus"), "Mizo");
  assert.equal(peon.rules?.languages?.[0].language, "lus");
  assert.equal(peon.rules?.languages?.[0].framework, undefined);
  assert.ok(peon.rules?.languages?.[0].requirement.includes("Class X"));
  assert.ok(peon.sources.every((item) => item.lastValidatedAt === null));
});

test("Mizoram changed document blocks draft; 16:00 local deadline closes cycle", async () => {
  const changedUrl = [...documents.keys()][1];
  await assert.rejects(() => mizoramPsc(context({ fetchBytes: async (url) => {
    const base = documents.get(url)!;
    const bytes = url === changedUrl ? Buffer.concat([base, Buffer.from("changed")]) : base;
    return { bytes, evidence: evidence(url, bytes) };
  } })), /PDF changed/);
  const result = await mizoramPsc(context({ now: new Date("2026-10-13T16:00:00+05:30") }));
  assert.ok(result.cycles.every((item) => item.status === "closed"));
});
