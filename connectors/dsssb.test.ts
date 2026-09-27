import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DSSSB_INDEX, dsssb, parseDsssbIndex } from "./dsssb.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";

const root = new URL("../data/evidence/research/", import.meta.url);
const index = readFileSync(new URL("dsssb-vacancies.html", root), "utf8");
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-dl-recruitment")!;
const files = new Map([
  ["https://dsssb.delhi.gov.in/sites/default/files/DSSSB/circulars-orders/final_advt-03-2026.pdf", "dsssb-03-2026.pdf"],
  ["https://dsssb.delhi.gov.in/sites/default/files/DSSSB/circulars-orders/corrigendum_28_26.pdf", "dsssb-28-26-corrigendum.pdf"],
  ["https://dsssb.delhi.gov.in/sites/default/files/DSSSB/circulars-orders/corrigendum_33_26.pdf", "dsssb-33-26-corrigendum.pdf"],
]);
const evidence = (url: string, bytes: Buffer): Evidence => ({ url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType: url.endsWith(".pdf") ? "application/pdf" : "text/html", bytes: bytes.length });
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => ({ text: index, evidence: evidence(url, Buffer.from(index)) }),
  fetchBytes: async (url) => {
    const file = files.get(url);
    if (!file) throw new Error("Unexpected document");
    const bytes = readFileSync(new URL(file, root));
    return { bytes, evidence: evidence(url, bytes) };
  },
  ...override,
});

test("Delhi archive identifies advertisement and both corrections without mistaking a deadline for an advertisement number", () => {
  const notices = parseDsssbIndex(index);
  assert.equal(notices.length, 3);
  assert.ok(notices.every((notice) => !/02-2026/.test(notice.url)));
  assert.throws(() => parseDsssbIndex(index.replace("corrigendum_28_26.pdf", "new-correction.pdf")), /archive changed/);
  assert.throws(() => parseDsssbIndex(index.replaceAll("/sites/default/files/DSSSB/circulars-orders/", "https://example.org/")), /outside official archive/);
});

test("Delhi draft counts one cycle per post code, retains corrections, and rejects foreign citizenship", async () => {
  const result = await dsssb(context());
  assert.equal(result.cycles.length, 25);
  assert.equal(new Set(result.cycles.map((cycle) => cycle.id)).size, 25);
  assert.ok(result.cycles.every((cycle) => cycle.sourceId === source.id && cycle.status === "closed"));
  assert.ok(result.cycles.every((cycle) => cycle.applicationWindow.cutoffLocalTime === "23:59"));
  assert.ok(result.cycles.every((cycle) => cycle.rules?.nationality?.allowed.join() === "IN"));
  const amended = result.cycles.find((cycle) => cycle.cycleLabel.endsWith("28/26"))!;
  assert.match(amended.changes[0].summary, /81 revised to 78/);
  assert.equal(amended.sources.filter((item) => item.format === "scanned PDF").length, 1);
  assert.equal(result.cycles.filter((cycle) => cycle.sources.some((item) => item.format === "scanned PDF")).length, 2);
  const foreign = evaluateEligibility(amended.rules, { nationality: "US" });
  assert.equal(foreign.canApply.result, "does-not-match");
  const indian = evaluateEligibility(amended.rules, { nationality: "IN" });
  assert.equal(indian.canApply.result, "needs-verification");
  assert.equal(source.reviewRequired, true);
  assert.equal(source.enabled, false);
});

test("Delhi critical extraction is withheld if any official PDF changes", async () => {
  const original = context();
  await assert.rejects(() => dsssb(context({ fetchBytes: async (url) => {
    const fetched = await original.fetchBytes!(url);
    if (url.endsWith("corrigendum_33_26.pdf")) {
      const bytes = Buffer.concat([fetched.bytes, Buffer.from("changed")]);
      return { bytes, evidence: evidence(url, bytes) };
    }
    return fetched;
  } })), /bytes changed/);
  assert.equal(DSSSB_INDEX, source.homepage);
});
