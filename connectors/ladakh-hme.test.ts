import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { checkLadakhAdmissionIndex, checkLadakhAdmissionPortal, LADAKH_HME_INDEX, LADAKH_HME_PORTAL, ladakhHme } from "./ladakh-hme.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const read = (name: string) => readFileSync(new URL(`../data/evidence/research/${name}`, import.meta.url));
const index = read("ladakh-notification-index-2026.html").toString();
const portal = read("ladakh-hme-portal-2026.html").toString();
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/ladakh-central-pool-2026.json", import.meta.url), "utf8")) as { documents: { key: string; url: string }[] };
const files: Record<string, string> = {
  "application-notice": "ladakh-central-pool-758-2026.pdf",
  "portal-guidelines": "ladakh-hme-guidelines-2026.pdf",
};
const pdfs = new Map(extraction.documents.map((document) => [document.url, read(files[document.key])]));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-la-hme-admission")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType, bytes: bytes.length,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => {
    const text = url === LADAKH_HME_INDEX ? index : url === LADAKH_HME_PORTAL ? portal : null;
    assert.ok(text, `unexpected Ladakh source ${url}`);
    return { text, evidence: evidence(url, Buffer.from(text), "text/html") };
  },
  fetchBytes: async (url) => {
    const bytes = pdfs.get(url);
    assert.ok(bytes, `unexpected Ladakh PDF ${url}`);
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  },
  ...override,
});

test("Ladakh HME index and portal bind exact notice, dates and guideline link", () => {
  assert.doesNotThrow(() => checkLadakhAdmissionIndex(index));
  assert.doesNotThrow(() => checkLadakhAdmissionPortal(portal));
  assert.throws(() => checkLadakhAdmissionIndex(index.replace("202609231438871085.pdf", "changed.pdf")), /PDF link changed/);
  assert.throws(() => checkLadakhAdmissionPortal(portal.replaceAll("29th September 2026", "30th September 2026")), /dates changed/);
  assert.throws(() => checkLadakhAdmissionPortal(`${portal}<p>The application process for Ladakh Central Pool Medical Seats for the academic year 2026-27 will be open from 23rd September 2026 to 30th September 2026.</p>`), /dates changed/);
  assert.throws(() => checkLadakhAdmissionPortal(`${portal}<a href="uploads/notifications/new-guidelines.pdf">Updated guide</a>`), /PDF link changed/);
  assert.throws(() => checkLadakhAdmissionPortal(portal.replace("Guidelines for Ladakh Central Pool Medical Seats", "Central Pool Medical Seats extended. Guidelines for Ladakh Central Pool Medical Seats")), /material update/);
});

test("Ladakh stages one medical admission cycle; nationality and language remain uncertain", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await ladakhHme(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 4);
  const cycle = result.cycles[0];
  assert.equal(cycle.pathway, "admission");
  assert.equal(cycle.status, "open");
  assert.equal(cycle.applicationWindow.opensOn, "2026-09-23");
  assert.equal(cycle.applicationWindow.closesOn, "2026-09-29");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.match(cycle.outcome, /7 MBBS or 2 BDS/);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", residenceSubdivision: "IN-LA" }).canApply.result, "needs-verification");
  assert.equal((await ladakhHme(context({ now: new Date("2026-09-30T00:00:00+05:30") }))).cycles[0].status, "closed");
});

test("Ladakh changed scan cannot reuse 2026 dates or eligibility", async () => {
  const target = extraction.documents[0].url;
  await assert.rejects(() => ladakhHme(context({ fetchBytes: async (url) => {
    const original = pdfs.get(url)!;
    const bytes = url === target ? Buffer.concat([original, Buffer.from("changed")]) : original;
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /PDF changed/);
});
