import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { assamPsc12, assertNoAssamCorrigendum, parseAssamAdvertisementRow } from "./assam-psc-12-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const index = readFileSync(new URL("../data/evidence/research/apsc-advertisements-2026-09-25.html", import.meta.url), "utf8");
const corrigenda = readFileSync(new URL("../data/evidence/research/apsc-corrigenda-2026-09-25.html", import.meta.url), "utf8");
const pdf = readFileSync(new URL("../data/evidence/research/apsc-12-2026.pdf", import.meta.url));
const registry = JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[];
const source = registry.find((item) => item.id === "in-as-recruitment")!;
const INDEX = "https://apsc.nic.in/advt_2026.php";
const CORRIGENDA = "https://apsc.nic.in/corig_2026.php";
const PDF = "https://apsc.nic.in/advt_2026/Advt_no_12-2026_website.pdf";
const evidence = (url: string, bytes: Buffer, type: string): Evidence => ({
  url, fetchedAt: "2026-09-25T13:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"),
  contentType: type, bytes: bytes.length,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T13:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => ({ text: url === INDEX ? index : corrigenda, evidence: evidence(url, Buffer.from(url === INDEX ? index : corrigenda), "text/html") }),
  fetchBytes: async (url) => ({ bytes: pdf, evidence: evidence(url, pdf, "application/pdf") }),
  ...override,
});

test("Assam register binds one exact 12/2026 row and later corrigenda need review", () => {
  assert.equal(parseAssamAdvertisementRow(index).totalRows, 12);
  assertNoAssamCorrigendum(corrigenda);
  assert.throws(() => parseAssamAdvertisementRow(index.replace("10-09-2026", "11-09-2026")), /link or dates changed/);
  assert.throws(() => parseAssamAdvertisementRow(index + index), /missing or duplicated/);
  assert.throws(() => assertNoAssamCorrigendum(corrigenda.replace("Advt No. 03/2026", "Advt No. 12/2026")), /corrigendum/);
});

test("Assam PDF draft separates foreign exclusion, residence proof and unknown language level", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await assamPsc12(context());
  assert.equal(result.cycles.length, 1);
  assert.equal(result.totalAvailable, 12);
  assert.equal(result.complete, false);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "closed");
  assert.equal(cycle.applicationWindow.closesOn, "2026-09-10");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.equal(cycle.applicationWindow.officialTimeZone, null);
  assert.equal(cycle.appointmentType, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.match(cycle.languageNote ?? "", /no mandatory language/);
  assert.match(cycle.residenceRule, /Permanent Assam residence/);
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(cycle.sources[2].sha256, evidence(PDF, pdf, "application/pdf").sha256);
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", education: "bachelor" }).canApply.result, "does-not-match");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN", education: "bachelor" }).canApply.result, "needs-verification");
});

test("Assam connector withholds extracted fields when original PDF changes", async () => {
  await assert.rejects(() => assamPsc12(context({ fetchBytes: async (url) => {
    const changed = Buffer.concat([pdf, Buffer.from("changed")]);
    return { bytes: changed, evidence: evidence(url, changed, "application/pdf") };
  } })), /PDF changed/);
});
