import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { checkKarnatakaApplyPage, checkKarnatakaIndex, KPSC_APPLY_PAGE, KPSC_INDEX, karnatakaPsc } from "./karnataka-psc.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const read = (name: string) => readFileSync(new URL(`../data/evidence/research/${name}`, import.meta.url));
const index = read("kpsc-page1a-2026.htm").toString();
const applyPage = read("kpsc-gp-2026-apply.html").toString();
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/kpsc-gp-2026.json", import.meta.url), "utf8")) as { documents: { key: string; url: string }[] };
const pdfs = new Map(extraction.documents.map((document) => [document.url, read(`kpsc-gp-2026-${document.key === "extension-pressnote" ? "pressnote" : document.key === "age-amendment" ? "age" : document.key}.pdf`)]));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-ka-recruitment")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType, bytes: bytes.length,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => {
    const value = url === KPSC_INDEX ? index : url === KPSC_APPLY_PAGE ? applyPage : null;
    assert.ok(value, `unexpected KPSC page ${url}`);
    return { text: value, evidence: evidence(url, Buffer.from(value), "text/html") };
  },
  fetchBytes: async (url) => {
    const bytes = pdfs.get(url);
    assert.ok(bytes, `unexpected KPSC PDF ${url}`);
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  },
  ...override,
});

test("KPSC index binds 319-post intake, extension and exact documents", () => {
  assert.doesNotThrow(() => checkKarnatakaIndex(index));
  assert.doesNotThrow(() => checkKarnatakaApplyPage(applyPage));
  assert.throws(() => checkKarnatakaIndex(index.replace("07-09-2026", "08-09-2026")), /extension changed/);
  assert.throws(() => checkKarnatakaIndex(index.replace("corrigendum notification GP-2026.pdf", "changed.pdf")), /PDF set changed/);
  assert.throws(() => checkKarnatakaApplyPage(applyPage.replace("/Login/Login", "/Login/Other")), /application link changed/);
});

test("KPSC stages one closed recruitment cycle; foreign eligibility uncertain and language threshold sourced", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await karnatakaPsc(context());
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 7);
  assert.equal(result.complete, false);
  const cycle = result.cycles[0];
  assert.equal(cycle.pathway, "recruitment");
  assert.equal(cycle.status, "closed");
  assert.equal(cycle.applicationWindow.opensOn, "2026-08-01");
  assert.equal(cycle.applicationWindow.closesOn, "2026-09-07");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.match(cycle.outcome, /319 Group A\/B/);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.deepEqual(cycle.rules?.languages?.map((item) => item.language), ["kn", "en"]);
  assert.ok(cycle.rules?.languages?.every((item) => item.minimumLevel === undefined && /35%/.test(item.requirement)));
  assert.equal(cycle.venues[0].kind, "unknown");
  const foreign = evaluateEligibility(cycle.rules, { nationality: "US", education: "bachelor" });
  assert.equal(foreign.canApply.result, "needs-verification");
  assert.equal(foreign.canEnterSelection.result, "needs-verification");
  assert.equal(foreign.canObtainOutcome.result, "needs-verification");
});

test("KPSC changed PDF blocks reuse of extracted terms", async () => {
  const target = extraction.documents[0].url;
  await assert.rejects(() => karnatakaPsc(context({ fetchBytes: async (url) => {
    const original = pdfs.get(url)!;
    const bytes = url === target ? Buffer.concat([original, Buffer.from("changed")]) : original;
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /PDF changed/);
});
