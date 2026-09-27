import assert from "node:assert/strict";
import test from "node:test";

import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { ssc } from "./ssc.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const source: SourceConfig = {
  id: "in-ssc", name: "SSC calendar", country: "IN", authority: "Staff Selection Commission",
  homepage: "https://ssc.gov.in/", connector: "ssc", cadenceHours: 6,
  licence: "", enabled: true, reviewRequired: true,
};
const evidence: Evidence = {
  url: "https://ssc.gov.in/api/general-website/portal/ssc-calendar?page=1", fetchedAt: "2026-09-25T00:00:00Z",
  sha256: "a".repeat(64), contentType: "application/json", bytes: 1024,
};
const entry = { id: "cgl-2027", headline: "Combined Graduate Level Examination, 2027", examYear: "2027", startDate: "2027-02-01", endDate: "2027-03-01" };

test("SSC tentative calendar cannot establish foreign eligibility, fee or degree rule", async () => {
  const context: ConnectorContext = {
    source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
    fetchText: async () => ({ text: JSON.stringify({ statusCode: "200", data: [entry] }), evidence }),
  };
  const result = await ssc(context);
  assert.equal(result.cycles.length, 1);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "uncertain");
  assert.equal(cycle.applicationWindow.opensOn, null);
  assert.equal(cycle.applicationWindow.closesOn, null);
  assert.equal(cycle.rules?.education, undefined);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", education: "bachelor" }).canApply.result, "needs-verification");
  assert.match(cycle.fee, /does not state/);
  assert.match(cycle.languageNote ?? "", /does not establish/);
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(cycle.sources[0].url, evidence.url);
  assert.equal(cycle.sources[0].fetchStatus, "fetched");
  assert.equal(cycle.sources[1].fetchStatus, "linked");
});
