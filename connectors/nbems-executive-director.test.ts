import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { nbemsExecutiveDirector, verifyNbemsDirectorIndex } from "./nbems-executive-director.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const extract = JSON.parse(readFileSync(new URL("../data/extractions/nbems-executive-director-2026.json", import.meta.url), "utf8")) as { indexUrl: string; englishUrl: string; hindiUrl: string };
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-nbems-executive-director")!;
const read = (file: string) => readFileSync(new URL(`../data/evidence/research/${file}`, import.meta.url));
const index = read("nbems-vacancy-index-2026.html").toString();
const pdfs = new Map([
  [extract.englishUrl, read("nbems-executive-director-2026-en.pdf")],
  [extract.hindiUrl, read("nbems-executive-director-2026-hi.pdf")],
]);
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType, bytes: bytes.length,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => {
    assert.equal(url, extract.indexUrl);
    return { text: index, evidence: evidence(url, Buffer.from(index), "text/html") };
  },
  fetchBytes: async (url) => {
    const bytes = pdfs.get(url);
    assert.ok(bytes, `unexpected NBEMS PDF ${url}`);
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  },
  ...override,
});

test("NBEMS Executive Director binds both bilingual dated rows and exact notice hashes", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyNbemsDirectorIndex(index));
  assert.throws(() => verifyNbemsDirectorIndex(index.replace(`href="${extract.englishUrl}"`, "href=\"https://natboard.edu.in/changed.pdf\"")), /document link changed/);
  const changed = Buffer.concat([pdfs.get(extract.hindiUrl)!, Buffer.from("changed")]);
  await assert.rejects(() => nbemsExecutiveDirector(context({ fetchBytes: async (url) => {
    const bytes = url === extract.hindiUrl ? changed : pdfs.get(url)!;
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /Hindi notice changed/);
});

test("NBEMS Executive Director stages one open deputation job with uncertain foreign and language access", async () => {
  const result = await nbemsExecutiveDirector(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 3);
  const cycle = result.cycles[0];
  assert.equal(cycle.pathway, "recruitment");
  assert.equal(cycle.status, "open");
  assert.equal(cycle.applicationWindow.opensOn, null);
  assert.equal(cycle.applicationWindow.closesOn, "2026-10-30");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.equal(cycle.applicationMethod, "post");
  assert.match(cycle.outcome, /One Executive Director post on deputation/);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", dateOfBirth: "1980-01-01" }).canApply.result, "needs-verification");
  assert.equal((await nbemsExecutiveDirector(context({ now: new Date("2026-10-31T00:00:00+05:30") }))).cycles[0].status, "closed");
});
