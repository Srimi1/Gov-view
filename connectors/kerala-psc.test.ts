import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { checkKeralaGazetteDocuments, checkKeralaGeneralConditionsLink, KERALA_GENERAL_CONDITIONS, KERALA_PDFS, keralaPsc, parseKeralaGazette, parseKeralaIndex } from "./kerala-psc.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";
import { indiaSubdivisions } from "../lib/places.ts";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";

const fixture = (name: string) => readFileSync(new URL(`../data/evidence/research/${name}.html`, import.meta.url), "utf8");
const registry = JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[];

test("India directory covers exactly all 36 states/territories with discovery evidence", () => {
  const sources = registry.filter((source) => source.country === "IN" && source.subdivisionCodes?.length);
  const covered = [...new Set(sources.flatMap((source) => source.subdivisionCodes!))].sort();
  assert.equal(covered.length, 36);
  assert.deepEqual(covered, indiaSubdivisions.map(([code]) => code).sort());
  assert.equal(new Set(sources.map((source) => source.id)).size, sources.length);
  assert.ok(sources.every((source) => source.discoveredFrom && source.discoveredAt && !source.enabled));
});

test("Kerala index preserves date precision and fails closed on drift", () => {
  const pages = parseKeralaIndex(fixture("kerala-index"));
  assert.deepEqual(pages.find((page) => page.url.endsWith("31082026")), { url: "https://www.keralapsc.gov.in/extra-ordinary-gazette-date-31082026", publishedOn: "2026-08-31", closesOn: "2026-10-07" });
  assert.throws(() => parseKeralaIndex("<html>Maintenance</html>"), /no gazette/);
});

test("Kerala HTML categories deduplicate; shared PDFs need exact-document expansion", () => {
  const html = fixture("kerala-august-2026");
  const parsed = parseKeralaGazette(html + html);
  assert.equal(parsed.notices.length, 12);
  assert.equal(new Set(parsed.notices.map((notice) => notice.id)).size, 12);
  assert.ok(parsed.warnings.some((warning) => warning.includes("139-142")));
  assert.ok(parsed.warnings.some((warning) => warning.includes("146-150")));
  assert.ok(parsed.notices.every((notice) => notice.url.startsWith("https://www.keralapsc.gov.in/")));
  assert.doesNotThrow(() => checkKeralaGazetteDocuments(html));
  assert.throws(() => checkKeralaGazetteDocuments(html.replace("noti-139-142-26.pdf", "noti-139-143-26.pdf")), /PDF set changed/);
  assert.throws(() => parseKeralaGazette('<a href="https://evil.example/file.pdf">Artist (Cat.No.130/2026)</a>'), /no unambiguous/);
});

test("Kerala General Conditions link must identify the exact PDF", () => {
  assert.doesNotThrow(() => checkKeralaGeneralConditionsLink(fixture("kerala-general-conditions")));
  assert.throws(() => checkKeralaGeneralConditionsLink('<a href="/sites/default/files/inline-files/other.pdf">General Conditions</a>'), /PDF link changed/);
});

const source = registry.find((item) => item.id === "in-kl-recruitment")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType, bytes: bytes.length,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => {
    const text = fixture(url.endsWith("/notifications") ? "kerala-index" : url === KERALA_GENERAL_CONDITIONS.pageUrl ? "kerala-general-conditions" : "kerala-august-2026");
    return { text, evidence: evidence(url, Buffer.from(text), "text/html") };
  },
  fetchBytes: async (url) => {
    assert.ok(KERALA_PDFS.includes(url) || url === KERALA_GENERAL_CONDITIONS.pdfUrl);
    const key = /noti-([\d-]+)-26\.pdf/.exec(url)?.[1];
    const bytes = readFileSync(new URL(`../data/evidence/research/${key ? `kerala-${key}-2026.pdf` : "kerala-general-conditions-current.pdf"}`, import.meta.url));
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  },
  ...override,
});

test("Kerala 21 category drafts retain PDF evidence and never infer venue, language or cutoff time", async () => {
  assert.equal(source.reviewRequired, true);
  const result = await keralaPsc(context());
  assert.equal(result.cycles.length, 21);
  assert.equal(result.evidence.length, 18);
  assert.equal(new Set(result.cycles.map((cycle) => cycle.id)).size, 21);
  for (const cycle of result.cycles) {
    assert.equal(cycle.applicationWindow.opensOn, null);
    assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
    assert.equal(cycle.applicationWindow.officialTimeZone, null);
    assert.equal(cycle.applicationWindow.precision, "date");
    assert.equal(cycle.sources[0].lastValidatedAt, null);
    assert.equal(cycle.sources[0].verificationStatus, "pending-review");
    assert.equal(cycle.sources[1].format, "PDF");
    assert.equal(cycle.sources[1].fetchStatus, "fetched");
    assert.equal(cycle.sources[2].url, KERALA_GENERAL_CONDITIONS.pdfUrl);
    assert.equal(cycle.sources[2].fetchStatus, "fetched");
    assert.equal(cycle.applicationUrl, "https://www.keralapsc.gov.in");
    assert.equal(cycle.venues[0].kind, "unknown");
    assert.equal(cycle.rules?.complete, false);
    assert.equal(cycle.rules?.languages, undefined);
    assert.match(cycle.citizenshipRule, /subjects of Nepal or Bhutan/);
    assert.match(cycle.citizenshipRule, /appointment remains provisional/);
  }
  const fire = result.cycles.find((cycle) => cycle.id === "kerala-psc-2026-139")!;
  const forest = result.cycles.find((cycle) => cycle.id === "kerala-psc-2026-148")!;
  assert.match(fire.title, /Scheduled Caste Converts/);
  assert.match(forest.outcome, /2 Beat Forest Officer positions/);
  assert.match(forest.scopeLabel, /Idukki or Wayanad/);
  assert.equal(fire.rules?.education?.minLevel, "higher-secondary");
  assert.equal(fire.rules?.languages, undefined);
  assert.equal(evaluateEligibility(fire.rules, { nationality: "US", education: "higher-secondary", dateOfBirth: "1998-01-01" }).canApply.result, "needs-verification");
  const plumber = result.cycles.find((cycle) => cycle.id === "kerala-psc-2026-132")!;
  const society = result.cycles.find((cycle) => cycle.id === "kerala-psc-2026-134")!;
  const engineer = result.cycles.find((cycle) => cycle.id === "kerala-psc-2026-135")!;
  const lecturer = result.cycles.find((cycle) => cycle.id === "kerala-psc-2026-137")!;
  const electrician = result.cycles.find((cycle) => cycle.id === "kerala-psc-2026-145")!;
  assert.match(plumber.scopeLabel, /not an open-market application/);
  assert.match(society.scopeLabel, /not general open-market Part I/);
  assert.match(engineer.scopeLabel, /restricted to serving corporation personnel/);
  assert.match(engineer.qualifications, /three years.*four years/);
  assert.match(lecturer.qualifications, /Arabic Language and Literature/);
  assert.match(electrician.qualifications, /only in absence of diploma-qualified candidates/);
  assert.equal(evaluateEligibility(plumber.rules, { nationality: "US", education: "secondary", experienceYears: 3, dateOfBirth: "1990-01-01" }).canApply.result, "needs-verification");
});

test("Kerala changed shared or individual PDF blocks retained category details", async () => {
  for (const changedUrl of [KERALA_PDFS[0], KERALA_PDFS[9], KERALA_PDFS[13], KERALA_GENERAL_CONDITIONS.pdfUrl]) {
    await assert.rejects(() => keralaPsc(context({ fetchBytes: async (url) => {
      const key = /noti-([\d-]+)-26\.pdf/.exec(url)?.[1];
      const original = readFileSync(new URL(`../data/evidence/research/${key ? `kerala-${key}-2026.pdf` : "kerala-general-conditions-current.pdf"}`, import.meta.url));
      const bytes = Buffer.concat([original, Buffer.from(url === changedUrl ? "changed" : "")]);
      return { bytes, evidence: evidence(url, bytes, "application/pdf") };
    } })), /PDF changed/);
  }
});
