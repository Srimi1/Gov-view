import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { GOA_PSC_ADVERTISEMENTS, checkGoaTable, goaPsc, goaTableUrl } from "./goa-psc.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const read = (name: string) => readFileSync(new URL(`../data/evidence/research/${name}`, import.meta.url));
const page = read("goa-psc-advertisements-2026.html").toString();
const table = read("goa-psc-advertisements-table-2026.json").toString();
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/goa-psc-09-2026.json", import.meta.url), "utf8")) as { advertisementUrl: string; instructionsUrl: string };
const pdfs = new Map([[extraction.advertisementUrl, read("goa-psc-advt-09-2026.pdf")], [extraction.instructionsUrl, read("goa-psc-instructions-2026.pdf")]]);
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-ga-recruitment")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T04:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => {
    const text = url === GOA_PSC_ADVERTISEMENTS ? page : url === goaTableUrl(page) ? table : null;
    assert.ok(text, `unexpected Goa PSC text URL ${url}`);
    return { text, evidence: evidence(url, Buffer.from(text), url === GOA_PSC_ADVERTISEMENTS ? "text/html" : "application/json") };
  },
  fetchBytes: async (url) => { const bytes = pdfs.get(url); assert.ok(bytes, `unexpected Goa PSC PDF ${url}`); return { bytes, evidence: evidence(url, bytes, "application/pdf") }; },
  ...override,
});

test("Goa PSC public table binds one exact 09/2026 advertisement and detects later changes", () => {
  assert.match(goaTableUrl(page), /^https:\/\/gpsc\.goa\.gov\.in\/wp-admin\/admin-ajax\.php\?/);
  assert.doesNotThrow(() => checkGoaTable(table));
  assert.throws(() => checkGoaTable(table.replace("ADVT092026.pdf", "ADVT092026-revised.pdf")), /PDF link changed/);
  const rows = JSON.parse(table) as unknown[];
  rows.push({ value: { description: "Corrigendum to Advt. No. 09 Year 2026", advt_no: "09", year: "2026", action: "" } });
  assert.throws(() => checkGoaTable(JSON.stringify(rows)), /row missing, duplicated or amended/);
});

test("Goa PSC makes seven separate cycles and preserves different application dates", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await goaPsc(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 7);
  assert.equal(new Set(result.cycles.map((cycle) => cycle.id)).size, 7);
  assert.equal(result.cycles.filter((cycle) => cycle.applicationWindow.closesOn === "2026-09-25").length, 4);
  assert.equal(result.cycles.filter((cycle) => cycle.applicationWindow.closesOn === "2026-10-25").length, 3);
  assert.equal(result.cycles.reduce((total, cycle) => total + Number(cycle.outcome.match(/^\d+/)?.[0] ?? 0), 0), 16);
  for (const cycle of result.cycles) {
    assert.equal(cycle.applicationWindow.opensOn, null);
    assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
    assert.equal(cycle.applicationWindow.precision, "date");
    assert.equal(cycle.venues[0].kind, "unknown");
    assert.equal(cycle.rules?.nationality, undefined);
    assert.equal(evaluateEligibility(cycle.rules, { nationality: "US" }).canApply.result, "needs-verification");
  }
  assert.match(result.cycles.find((cycle) => cycle.id.endsWith("lecturer-general-medicine"))!.rules!.manualChecks![2]!.text, /working knowledge/);
  assert.match(result.cycles.find((cycle) => cycle.id.endsWith("assistant-engineer-electrical-transfer"))!.qualifications, /three years' maintenance/);
  assert.equal((await goaPsc(context({ now: new Date("2026-09-26T00:00:00+05:30") }))).cycles.filter((cycle) => cycle.status === "closed").length, 4);
});

test("Goa PSC changed advertisement scan withholds extracted fields", async () => {
  await assert.rejects(() => goaPsc(context({ fetchBytes: async (url) => {
    const original = pdfs.get(url)!;
    const bytes = url === extraction.advertisementUrl ? Buffer.concat([original, Buffer.from("changed")]) : original;
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /PDF changed/);
});
