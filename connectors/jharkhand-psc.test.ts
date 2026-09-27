import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { checkJharkhandDetail, checkJharkhandIndex, JPSC_DETAIL, JPSC_INDEX, jharkhandPsc } from "./jharkhand-psc.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const read = (name: string) => readFileSync(new URL(`../data/evidence/research/${name}`, import.meta.url));
const index = read("jh-home-2026-09-25.html").toString();
const detail = read("jpsc-exam-13045-2026.html").toString();
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/jpsc-assistant-professor-07-2026.json", import.meta.url), "utf8")) as { documents: { key: string; url: string }[] };
const pdfs = new Map(extraction.documents.map((document) => [document.url, read(`jpsc-assistant-professor-07-2026-${document.key === "press-note" ? "press" : document.key}.pdf`)]));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-jh-recruitment")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType, bytes: bytes.length,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => {
    const text = url === JPSC_INDEX ? index : url === JPSC_DETAIL ? detail : null;
    assert.ok(text, `unexpected JPSC page ${url}`);
    return { text, evidence: evidence(url, Buffer.from(text), "text/html") };
  },
  fetchBytes: async (url) => {
    const bytes = pdfs.get(url);
    assert.ok(bytes, `unexpected JPSC PDF ${url}`);
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  },
  ...override,
});

test("JPSC 07/2026 homepage and detail bind one exact original notice set", () => {
  assert.doesNotThrow(() => checkJharkhandIndex(index));
  assert.doesNotThrow(() => checkJharkhandDetail(detail));
  assert.throws(() => checkJharkhandIndex(index.replace("exam_files.php?id=13045", "exam_files.php?id=changed")), /identity changed/);
  assert.throws(() => checkJharkhandDetail(detail.replace("Advertisement_07_26_dated_15_04_2026.pdf", "changed.pdf")), /document set changed/);
  assert.throws(() => checkJharkhandDetail(detail.replace("Advertisement dtd.15-04-2026</a>", "Advertisement dtd.15-04-2026</a><a href='data/new-amendment.pdf'>Amendment</a>")), /document set changed/);
});

test("JPSC stages one closed medical faculty draft with foreign and language uncertainty", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await jharkhandPsc(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 4);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "closed");
  assert.equal(cycle.pathway, "recruitment");
  assert.equal(cycle.applicationWindow.opensOn, "2026-04-28");
  assert.equal(cycle.applicationWindow.closesOn, "2026-05-12");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "17:00");
  assert.equal(cycle.rules?.age?.min, 30);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.match(cycle.outcome, /90 posts total/);
  assert.equal(cycle.venues[0].kind, "unknown");
  for (const stage of Object.values(evaluateEligibility(cycle.rules, { nationality: "US", education: "doctorate" }))) assert.equal(stage.result, "needs-verification");
});

test("JPSC changed PDF blocks retained dates and applicant terms", async () => {
  const target = extraction.documents[0].url;
  await assert.rejects(() => jharkhandPsc(context({ fetchBytes: async (url) => {
    const original = pdfs.get(url)!;
    const bytes = url === target ? Buffer.concat([original, Buffer.from("changed")]) : original;
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /PDF changed/);
});
