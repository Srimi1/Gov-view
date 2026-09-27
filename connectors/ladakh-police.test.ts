import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { LADAKH_POLICE_INDEX, checkLadakhPoliceIndex, ladakhPolice } from "./ladakh-police.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const read = (name: string) => readFileSync(new URL(`../data/evidence/research/${name}`, import.meta.url));
const index = read("ladakh-police-recruitment-2026.html").toString();
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/ladakh-police-constable-02-2026.json", import.meta.url), "utf8")) as { documents: { key: string; url: string; linkedOnly?: boolean }[] };
const files: Record<string, string> = {
  advertisement: "ladakh-police-constable-board-2026.pdf",
  "no-extension": "ladakh-police-no-extension-2026.pdf",
  "pst-postponement": "ladakh-police-pst-postponement-2026.pdf",
  "standing-order": "ladakh-police-standing-order-2026.pdf",
};
const pdfs = new Map(extraction.documents.filter((item) => !item.linkedOnly).map((item) => [item.url, read(files[item.key])]));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-la-police")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => { assert.equal(url, LADAKH_POLICE_INDEX); return { text: index, evidence: evidence(url, Buffer.from(index), "text/html") }; },
  fetchBytes: async (url) => { const bytes = pdfs.get(url); assert.ok(bytes, `unexpected Ladakh Police PDF ${url}`); return { bytes, evidence: evidence(url, bytes, "application/pdf") }; },
  ...override,
});

test("Ladakh Police register binds original, no-extension, test change and standing order", () => {
  assert.doesNotThrow(() => checkLadakhPoliceIndex(index));
  assert.throws(() => checkLadakhPoliceIndex(index.replace("pdf/No-extension.pdf", "pdf/No-extension-v2.pdf")), /notice changed|notice set changed/);
  const newRow = '<tr><td>Notice LPSSRB/Ct/2026/700</td><td>Constable 2026 Ladakh Police revised deadline</td><td><a href="pdf/new.pdf">25-09-2026</a></td></tr>';
  assert.throws(() => checkLadakhPoliceIndex(index.replace("<tbody>", `<tbody>${newRow}`)), /notice set changed/);
});

test("Ladakh Police stages one closed cycle, keeps domicile and international status distinct", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await ladakhPolice(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 5);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "closed");
  assert.equal(cycle.applicationWindow.opensOn, "2026-08-29");
  assert.equal(cycle.applicationWindow.closesOn, "2026-09-15");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.match(cycle.outcome, /331 Constable posts/);
  assert.match(cycle.residenceRule, /domicile certificate/);
  assert.match(cycle.statusNote, /does not reopen applications/);
  assert.match(cycle.selectionStages.join(" "), /English\/Hindi bilingual/);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US" }).canApply.result, "needs-verification");
  assert.equal((await ladakhPolice(context({ now: new Date("2026-09-15T09:00:00+05:30") }))).cycles[0].status, "uncertain");
});

test("Ladakh Police changed scan cannot reuse extracted eligibility", async () => {
  const target = extraction.documents[0].url;
  await assert.rejects(() => ladakhPolice(context({ fetchBytes: async (url) => {
    const original = pdfs.get(url)!;
    const bytes = url === target ? Buffer.concat([original, Buffer.from("changed")]) : original;
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /PDF changed/);
});
