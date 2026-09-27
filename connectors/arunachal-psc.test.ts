import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { ARUNACHAL_INDEX, ARUNACHAL_NOTICES, arunachalPsc, checkArunachalIndex, checkArunachalNotices } from "./arunachal-psc.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const read = (name: string) => readFileSync(new URL(`../data/evidence/research/${name}`, import.meta.url));
const index = read("arunachal-psc-advertisements-2026.html").toString();
const notices = read("arunachal-psc-notifications-2026.html").toString();
const pdf = read("arunachal-appscce-2026.pdf");
const documentUrl = "https://appsc.gov.in/upload/RECINS001/APPSCCE_2026_ADVERTISEMENT.pdf";
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-ar-recruitment")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => {
    const text = url === ARUNACHAL_INDEX ? index : url === ARUNACHAL_NOTICES ? notices : null;
    assert.ok(text, `unexpected APPSC index ${url}`);
    return { text, evidence: evidence(url, Buffer.from(text), "text/html") };
  },
  fetchBytes: async (url) => {
    assert.equal(url, documentUrl);
    return { bytes: pdf, evidence: evidence(url, pdf, "application/pdf") };
  },
  ...override,
});

test("APPSC 2026 notice identity and later changes require review", () => {
  assert.doesNotThrow(() => checkArunachalIndex(index));
  assert.doesNotThrow(() => checkArunachalNotices(notices));
  assert.throws(() => checkArunachalIndex(index.replace("APPSCCE_2026_ADVERTISEMENT.pdf", "APPSCCE_2026_REVISED.pdf")), /changed or duplicated/);
  assert.throws(() => checkArunachalIndex(index.replace("</tbody>", '<tr><td><a href="new.pdf">Corrigendum APPSCCE-2026</a></td></tr></tbody>')), /related advertisement or corrigendum/);
  assert.throws(() => checkArunachalNotices(notices.replace("</tbody>", '<tr><td><a href="new.pdf">Corrigendum APPSCCE-2026 deadline extension</a></td></tr></tbody>')), /later notification/);
});

test("APPSCCE stays one draft cycle with explicit foreign-citizen exclusion and notice-specific language", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await arunachalPsc(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 3);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "open");
  assert.match(cycle.scopeLabel, /135 posts across 13/);
  assert.equal(cycle.applicationWindow.opensOn, "2026-09-16");
  assert.equal(cycle.applicationWindow.closesOn, "2026-10-20");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "17:00");
  assert.match(cycle.residenceRule, /Permanent Residence Certificate/);
  assert.deepEqual(cycle.rules?.languages?.map((rule) => rule.language), ["mul", "en"]);
  assert.equal(cycle.rules?.languages?.[0].minimumLevel, undefined);
  assert.match(cycle.rules?.manualChecks?.[1].text ?? "", /indigenous tribal language/);
  assert.ok(cycle.venues.length >= 19);
  for (const stage of Object.values(evaluateEligibility(cycle.rules, { nationality: "US", education: "bachelor" }))) assert.equal(stage.result, "does-not-match");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN", education: "bachelor" }).canApply.result, "needs-verification");
  assert.equal((await arunachalPsc(context({ now: new Date("2026-10-20T16:59:00+05:30") }))).cycles[0].status, "open");
  assert.equal((await arunachalPsc(context({ now: new Date("2026-10-20T17:00:00+05:30") }))).cycles[0].status, "closed");
});

test("APPSCCE changed scan cannot reuse extracted critical fields", async () => {
  await assert.rejects(() => arunachalPsc(context({ fetchBytes: async (url) => {
    const bytes = Buffer.concat([pdf, Buffer.from("changed")]);
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /PDF changed/);
});
