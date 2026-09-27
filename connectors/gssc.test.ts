import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gssc, GSSC_INDEX, GSSC_INSTRUCTIONS, parseGsscIndex, parseGsscInstructions, verifyGsscApplicationPortal } from "./gssc.ts";
import type { ConnectorContext, SourceConfig } from "./types.ts";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";

const root = new URL("../data/evidence/research/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root));
const index = read("gssc-advertisements.html").toString();
const instructions = read("gssc-instructions.html").toString();
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/gssc-2026-3.json", import.meta.url), "utf8"));
const portalIndex = read("goa-cbes-advertisements-2026.html").toString();
const portalDetails = new Map<number, string>([
  [1, read("goa-cbes-gssc3-desktop-2026.html").toString()],
  [2, read("goa-cbes-gssc3-ldc-2026.html").toString()],
  [3, read("goa-cbes-gssc3-deo-2026.html").toString()],
  [4, read("goa-cbes-gssc3-junior-2026.html").toString()],
]);
const portalByUrl = new Map<string, string>([[extraction.applicationPortal.indexUrl, portalIndex],
  ...extraction.applicationPortal.posts.map((post: { ordinal: number; url: string }) => [post.url, portalDetails.get(post.ordinal)!] as [string, string])]);
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((source) => source.id === "in-ga-gssc")!;
const files = ["gssc-2026-3-0", "gssc-2026-3-1", "gssc-2026-3-2", "gssc-instructions"];
const documents = new Map(files.map((file) => {
  const metadata = JSON.parse(read(file === "gssc-instructions" ? `${file}-pdf.json` : `${file}.json`).toString());
  return [metadata.url as string, { bytes: read(`${file}.pdf`), evidence: metadata }];
}));
const htmlEvidence = (url: string, text: string) => ({ url, sha256: createHash("sha256").update(text).digest("hex"), fetchedAt: "2026-09-25T00:00:00Z", contentType: "text/html", bytes: Buffer.byteLength(text) });
const context = (overrides: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => { const text = url === GSSC_INDEX ? index : url === GSSC_INSTRUCTIONS ? instructions : portalByUrl.get(url); assert.ok(text, `Unrecognized HTML: ${url}`); return { text, evidence: htmlEvidence(url, text) }; },
  fetchBytes: async (url) => { const document = documents.get(url); assert.ok(document, `Unrecognized PDF: ${url}`); return document; },
  ...overrides,
});

test("GSSC groups brief, original and amendment into one advertisement identity", () => {
  const parsed = parseGsscIndex(index);
  const current = parsed.notices.filter((notice) => notice.number === "3/2026");
  assert.equal(current.length, 3);
  assert.deepEqual(new Set(current.map((notice) => notice.kind)), new Set(["brief", "advertisement", "amendment"]));
  assert.equal(current.find((notice) => notice.kind === "amendment")?.releasedOn, "2026-09-21");
  assert.ok(parsed.warnings.some((warning) => /Historical unnumbered/.test(warning)));
  assert.equal(parseGsscInstructions(instructions), extraction.documents.find((document: { role: string }) => document.role === "instructions").url);
});

test("GSSC yields four separately applied posts, not one cycle per department or vacancy", async () => {
  const result = await gssc(context());
  assert.equal(result.cycles.length, 4);
  assert.equal(new Set(result.cycles.map((cycle) => cycle.id)).size, 4);
  assert.ok(result.warnings.some((warning) => /separate application for each post/.test(warning)));
  assert.equal(result.evidence.length, 11);
  assert.ok(result.cycles.every((cycle) => cycle.status === "uncertain" && cycle.applicationWindow.opensOn === "2026-09-11" && cycle.applicationWindow.closesOn === "2026-10-02" && cycle.applicationWindow.cutoffLocalTime === null));
  assert.deepEqual(result.cycles.map((cycle) => cycle.applicationUrl), extraction.applicationPortal.posts.map((post: { url: string }) => post.url));
  assert.ok(result.cycles.every((cycle) => cycle.sources.every((source) => source.lastValidatedAt === null)));
  assert.ok(result.cycles.every((cycle) => cycle.venues.every((venue) => venue.kind === "unknown")));
  assert.equal(source.reviewRequired, true);
  assert.equal(source.enabled, false);
});

test("GSSC preserves language threshold, desirable Marathi, skill speeds and experience exemption", async () => {
  const { cycles } = await gssc(context());
  const operator = cycles[0];
  assert.ok(operator.rules?.languages?.every((rule) => rule.language === "kok" && !rule.framework && !rule.minimumLevel));
  assert.match(operator.rules!.languages!.find((rule) => rule.stage === "selection")!.requirement, /4 marks out of 10/);
  assert.match(operator.qualifications, /Marathi knowledge is desirable/);
  assert.match(operator.qualifications, /exempts candidates with benchmark disabilities/);
  assert.equal(operator.rules?.experience, undefined);
  assert.match(operator.selectionStages.join(" "), /40 words per minute/);
  assert.match(cycles[1].selectionStages.join(" "), /30 words per minute/);
  assert.equal(operator.rules?.nationality, undefined);
  assert.equal(operator.rules?.residence, undefined); // Current residence cannot establish 15-year certificate eligibility.
  assert.match(operator.residenceRule, /15-year Goa residence certificate/);
  const report = evaluateEligibility(operator.rules, { nationality: "IN", residenceCountry: "IN", residenceSubdivision: "IN-GA", languageSkills: [{ language: "kok", framework: "CEFR", level: "C2" }] });
  assert.equal(report.canApply.result, "needs-verification");
  assert.equal(report.canEnterSelection.result, "needs-verification");
  assert.equal(report.canObtainOutcome.result, "needs-verification");
});

test("GSSC supplementary selection ratios replace original text; fee conflict stays visible", async () => {
  const result = await gssc(context());
  for (const [index, cycle] of result.cycles.entries()) {
    assert.match(cycle.selectionStages[1], index === 0 || index === 2 ? /15 times/ : /5 times/);
    assert.match(cycle.fee, /Conflict requires confirmation/);
  }
  assert.ok(result.warnings.some((warning) => /204 to 203/.test(warning)));
  assert.ok(result.warnings.some((warning) => /fee conflict/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /CBES application portal still lists 111 UR and 204 total/.test(warning)));
});

test("GSSC CBES detail pages support exact dates and essential Konkani, but stale LDC count stays flagged", () => {
  assert.doesNotThrow(() => verifyGsscApplicationPortal(portalIndex, portalDetails));
  assert.throws(() => verifyGsscApplicationPortal(portalIndex, new Map(portalDetails).set(1, portalDetails.get(1)!.replace("Knowledge of Konkani", "Konkani optional"))), /detail changed/);
  assert.throws(() => verifyGsscApplicationPortal(portalIndex, new Map(portalDetails).set(1, portalDetails.get(1)!.replace("Essential :", "Desirable :"))), /detail changed/);
  assert.throws(() => verifyGsscApplicationPortal(portalIndex, new Map(portalDetails).set(2, portalDetails.get(2)!.replace("111 Post (resvd for : General)", "110 Post (resvd for : General)"))), /count changed/);
  assert.throws(() => verifyGsscApplicationPortal(portalIndex, new Map(portalDetails).set(3, portalDetails.get(3)!.replace("11-09-2026", "12-09-2026"))), /detail changed/);
});

test("GSSC changed PDF bytes with stale metadata cannot reuse extracted critical fields", async () => {
  await assert.rejects(() => gssc(context({ fetchBytes: async (url) => {
    const document = documents.get(url)!;
    return { ...document, bytes: Buffer.concat([document.bytes, Buffer.from("changed")]) };
  } })), /PDF changed/);
  await assert.rejects(() => gssc(context({ fetchBytes: undefined })), /exact PDF bytes/);
});

test("GSSC new amendment, removed supplement or changed instruction link invalidates extraction", async () => {
  const amendment = '<a href="https://gssc.goa.gov.in/wp-content/uploads/2026/09/new-amendment.pdf">Corrigendum to Advertisement No. 3 of Year 2026 dated 24/09/2026</a>';
  const altered = [index.replace('<!-- .entry-content -->', amendment + '<!-- .entry-content -->'), index.replace(/<li><a[^>]*supplementary-note[\s\S]*?<\/li>/, "")];
  for (const html of altered) await assert.rejects(() => gssc(context({ fetchText: async (url) => { const text = url === GSSC_INDEX ? html : url === GSSC_INSTRUCTIONS ? instructions : portalByUrl.get(url)!; return { text, evidence: htmlEvidence(url, text) }; } })), /document set changed/);
  await assert.rejects(() => gssc(context({ fetchText: async (url) => { const text = url === GSSC_INDEX ? index : url === GSSC_INSTRUCTIONS ? instructions.replaceAll("instructions-to-candidates-updated_28_04_25.pdf", "new-instructions.pdf") : portalByUrl.get(url)!; return { text, evidence: htmlEvidence(url, text) }; } })), /document set changed/);
});

test("GSSC drift and external document links fail; repeated links do not add cycles", () => {
  assert.throws(() => parseGsscIndex("Maintenance"), /content section changed/);
  assert.throws(() => parseGsscIndex(index.replace('href="https://gssc.goa.gov.in/wp-content/uploads/2026/09/supplementary', 'href="https://evil.example/wp-content/uploads/2026/09/supplementary')), /outside the official/);
  const original = index.match(/<li><a[^>]*supplementary-note[\s\S]*?<\/li>/)![0];
  assert.deepEqual(parseGsscIndex(index.replace(original, original + original)), parseGsscIndex(index));
});
