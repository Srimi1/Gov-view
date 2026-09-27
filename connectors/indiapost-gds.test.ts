import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { indiaPostGds, verifyIndiaPostGdsPortal } from "./indiapost-gds.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const research = new URL("../data/evidence/research/", import.meta.url);
const page = readFileSync(new URL("indiapost-gds-2026.html", research), "utf8");
const script = readFileSync(new URL("indiapost-gds-site-2026.js", research), "utf8");
const documents: Record<string, Buffer> = {
  "descriptive-notification.pdf": readFileSync(new URL("indiapost-gds-2026-descriptive-notification.pdf", research)),
  "descriptive-notification-hindi.pdf": readFileSync(new URL("indiapost-gds-2026-descriptive-notification-hindi.pdf", research)),
  "Annexure-Ia.pdf": readFileSync(new URL("indiapost-gds-2026-Annexure-Ia.pdf", research)),
};
const registry = JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[];
const source = registry.find((entry) => entry.id === "in-indiapost-gds")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T05:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType, bytes: bytes.length,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T05:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => {
    const text = url.endsWith(".js") ? script : page;
    return { text, evidence: evidence(url, Buffer.from(text), url.endsWith(".js") ? "application/javascript" : "text/html") };
  },
  fetchBytes: async (url) => {
    const bytes = documents[url.split("/").pop()!]!;
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  },
  ...override,
});

test("India Post one national schedule keeps posts distinct from opportunity count and foreign eligibility unknown", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await indiaPostGds(context());
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 5);
  assert.equal(result.complete, false);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "closed");
  assert.match(cycle.outcome, /23,757 tentative posts/);
  assert.equal(cycle.applicationWindow.closesOn, "2026-09-21");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "17:00");
  assert.equal(cycle.applicationWindow.officialTimeZone, "Asia/Kolkata");
  assert.match(cycle.languageNote!, /Local language depends on chosen post/);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.equal(cycle.venues.length, 0);
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", education: "secondary" }).canApply.result, "needs-verification");
});

test("India Post portal drift and changed official PDF block stale draft", async () => {
  verifyIndiaPostGdsPortal(page, script);
  assert.throws(() => verifyIndiaPostGdsPortal(page, script.replace("2026-09-21T17:00:00+05:30", "2026-09-22T17:00:00+05:30")), /dates or PDF links changed/);
  const original = context().fetchBytes!;
  await assert.rejects(() => indiaPostGds(context({ fetchBytes: async (url, init) => {
    const result = await original(url, init);
    if (!url.endsWith("Annexure-Ia.pdf")) return result;
    const bytes = Buffer.concat([result.bytes, Buffer.from("changed")]);
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /PDF changed/);
});
