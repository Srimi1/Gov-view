import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { ANDAMAN_RECRUITMENT_INDEX, andamanAgriculture, checkAndamanAgricultureIndex } from "./andaman-agriculture.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const html = readFileSync(new URL("../data/evidence/research/andaman-erecruitment-home-2026.html", import.meta.url), "utf8");
const pdf = readFileSync(new URL("../data/evidence/research/andaman-agriculture-1055-2026.pdf", import.meta.url));
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/andaman-agriculture-1055-2026.json", import.meta.url), "utf8")) as { document: { url: string } };
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-an-recruitment")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType, bytes: bytes.length,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => {
    assert.equal(url, ANDAMAN_RECRUITMENT_INDEX);
    return { text: html, evidence: evidence(url, Buffer.from(html), "text/html") };
  },
  fetchBytes: async (url) => {
    assert.equal(url, extraction.document.url);
    return { bytes: pdf, evidence: evidence(url, pdf, "application/pdf") };
  },
  ...override,
});

test("Andaman live card binds exact agriculture PDF and application dates", () => {
  assert.doesNotThrow(() => checkAndamanAgricultureIndex(html));
  assert.throws(() => checkAndamanAgricultureIndex(html.replace("23-10-2026", "24-10-2026")), /dates changed/);
  assert.throws(() => checkAndamanAgricultureIndex(html.replace("1055_29a155c9-680d-4586-8924-8ab13996bba7.pdf", "changed.pdf")), /link changed/);
  assert.throws(() => checkAndamanAgricultureIndex(html.replace("<hr/>", "<a href='Advertisement/new.pdf'>New Agriculture notice</a><hr/>")), /new live notice added/);
});

test("Andaman draft counts one live intake and excludes foreign citizens by notice", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await andamanAgriculture(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 2);
  const cycle = result.cycles[0];
  assert.equal(cycle.pathway, "recruitment");
  assert.equal(cycle.status, "open");
  assert.equal(cycle.applicationWindow.opensOn, "2026-09-24");
  assert.equal(cycle.applicationWindow.closesOn, "2026-10-23");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.match(cycle.outcome, /Agriculture Officer/);
  assert.match(cycle.outcome, /Agriculture Engineering Assistants/);
  assert.match(cycle.outcome, /Agriculture Assistants/);
  assert.deepEqual(cycle.rules?.nationality?.allowed, ["IN"]);
  assert.equal(cycle.rules?.languages?.find((item) => item.language === "hi")?.mandatory, false);
  assert.equal(cycle.rules?.languages?.find((item) => item.language === "en")?.minimumLevel, undefined);
  assert.equal(cycle.venues[0].kind, "unknown");
  const foreign = evaluateEligibility(cycle.rules, { nationality: "US", education: "master" });
  for (const result of Object.values(foreign)) assert.equal(result.result, "does-not-match");
  assert.equal((await andamanAgriculture(context({ now: new Date("2026-10-24T00:00:00+05:30") }))).cycles[0].status, "closed");
});

test("Andaman changed scanned notice cannot reuse citizenship or deadlines", async () => {
  await assert.rejects(() => andamanAgriculture(context({ fetchBytes: async (url) => {
    const bytes = Buffer.concat([pdf, Buffer.from("changed")]);
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /PDF changed/);
});
