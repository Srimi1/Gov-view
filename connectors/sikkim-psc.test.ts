import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { SIKKIM_INDEX, SIKKIM_NOTICES, checkSikkimNotices, parseSikkimIndex, sikkimPsc } from "./sikkim-psc.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const read = (name: string) => readFileSync(new URL(`../data/evidence/research/${name}`, import.meta.url));
const index = read("spsc-advertisements.html").toString();
const notices = read("spsc-notices.html").toString();
const urls = parseSikkimIndex(index);
const files = new Map([...urls].map(([key, url]) => [url, read(`spsc-vlw-2026-${key}.pdf`)]));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-sk-recruitment")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => { const text = url === SIKKIM_INDEX ? index : url === SIKKIM_NOTICES ? notices : null; assert.ok(text); return { text, evidence: evidence(url, Buffer.from(text), "text/html") }; },
  fetchBytes: async (url) => { const bytes = files.get(url); assert.ok(bytes); return { bytes, evidence: evidence(url, bytes, "application/pdf") }; },
  ...override,
});

test("Sikkim advertisement binds one VLW cycle and three exact official PDFs", () => {
  assert.equal(urls.size, 3);
  checkSikkimNotices(notices);
  assert.throws(() => parseSikkimIndex(index.replace("Village_Level_Worker_Adv_09_07_2026.pdf", "Village_Level_Worker_Changed.pdf")), /missing or replaced/);
  assert.throws(() => checkSikkimNotices(notices.replace("Latest Notices Issued By the Commission.", "Latest Notices Issued By the Commission. <a href='Notices/new-vlw.pdf'>Village Level Worker corrigendum</a>")), /later notice/);
});

test("Sikkim draft preserves local certificate, foreign-applicant and language uncertainty", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await sikkimPsc(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 5);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "closed");
  assert.equal(cycle.applicationWindow.opensOn, null);
  assert.equal(cycle.applicationWindow.closesOn, "2026-08-31");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.match(cycle.qualifications, /B\.Sc\. Agriculture or Horticulture/);
  assert.match(cycle.residenceRule, /Local Employment Card/);
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", education: "bachelor", residenceCountry: "IN" }).canApply.result, "needs-verification");
  assert.equal((await sikkimPsc(context({ now: new Date("2026-08-31T18:29:00+05:30") }))).cycles[0].status, "uncertain");
});

test("Sikkim changed scan blocks old eligibility and deadline fields", async () => {
  const original = urls.get("advertisement")!;
  await assert.rejects(() => sikkimPsc(context({ fetchBytes: async (url) => {
    const bytes = url === original ? Buffer.concat([files.get(url)!, Buffer.from("changed")]) : files.get(url)!;
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /PDF changed/);
});
