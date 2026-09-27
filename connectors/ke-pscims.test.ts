import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import type { ConnectorContext, SourceConfig } from "./types.ts";
import { kePscims, parsePscDetail, parsePscIndex, pscDetailUrl } from "./ke-pscims.ts";

const index = readFileSync(new URL("../data/evidence/research/ke-psc-active-adverts-2026.html", import.meta.url), "utf8");
const serving = readFileSync(new URL("../data/evidence/research/ke-psc-d111-2026.html", import.meta.url), "utf8");
const open = readFileSync(new URL("../data/evidence/research/ke-psc-172-2026.html", import.meta.url), "utf8");
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "ke-pscims")!;

test("PSCIMS source distinguishes public applications from foreign-citizen eligibility", async () => {
  const adverts = parsePscIndex(index);
  assert.equal(adverts.length, 42);
  assert.equal(adverts.filter((advert) => advert.servingOnly).length, 26);
  assert.equal(adverts.filter((advert) => !advert.servingOnly).length, 16);
  const publicAdvert = adverts.find((advert) => advert.number === "172/2026")!;
  const servingAdvert = adverts.find((advert) => advert.number === "D111/2026")!;
  assert.equal(publicAdvert.closesOn, "2026-10-13");
  assert.equal(servingAdvert.closesOn, "2026-10-05");
  assert.match(parsePscDetail(open, publicAdvert).requirements, /Bachelors degree/);
  assert.match(parsePscDetail(serving, servingAdvert).requirements, /senior Labour Migration officer/);
  assert.throws(() => parsePscDetail(open, servingAdvert), /conflicts/);
  assert.throws(() => parsePscDetail(open.replace('value="2" required="required" disabled="disabled"', 'value="3" required="required" disabled="disabled"'), publicAdvert), /conflicts/);
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
});

test("PSCIMS draft keeps stage eligibility, cutoff zone and selection venue uncertain", async () => {
  const first = parsePscIndex(index)[0];
  const detailUrl = pscDetailUrl(first.number);
  const context: ConnectorContext = {
    source: { ...source, maxRecords: 1 }, now: new Date("2026-09-25T08:00:00Z"), env: {}, log: () => {},
    fetchText: async (url) => {
      assert.ok(url === source.homepage || url === detailUrl);
      const text = url === detailUrl ? serving : index;
      return { text, evidence: { url, fetchedAt: "2026-09-25T08:00:00Z", sha256: "fixture-hash", contentType: "text/html", bytes: text.length } };
    },
  };
  const result = await kePscims(context);
  assert.equal(result.cycles.length, 1);
  assert.equal(result.totalAvailable, 42);
  assert.equal(result.complete, false);
  assert.ok(result.continuation);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "open");
  assert.equal(cycle.appointmentType, undefined);
  assert.equal(cycle.applicationWindow.opensOn, null);
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.equal(cycle.applicationWindow.officialTimeZone, null);
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN" }).canApply.result, "needs-verification");
  assert.match(cycle.rules?.manualChecks?.[0].text ?? "", /serving officers/i);
  assert.equal(cycle.rules?.languages, undefined);
});
