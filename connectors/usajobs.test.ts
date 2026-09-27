import assert from "node:assert/strict";
import test from "node:test";

import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { toCycle, type UsaJob } from "./usajobs.ts";
import type { Evidence, SourceConfig } from "./types.ts";

const source: SourceConfig = {
  id: "us-usajobs", name: "USAJOBS", country: "US", authority: "U.S. Office of Personnel Management",
  homepage: "https://www.usajobs.gov", connector: "usajobs", cadenceHours: 1,
  licence: "", enabled: true, reviewRequired: true,
};
const evidence: Evidence = {
  url: "https://data.usajobs.gov/api/search", fetchedAt: "2026-09-25T00:00:00Z",
  sha256: "a".repeat(64), contentType: "application/json", bytes: 1024,
};
const job: UsaJob = {
  PositionID: "TEST-123", PositionTitle: "Analyst", PositionURI: "https://www.usajobs.gov/job/123",
  PublicationStartDate: "2026-09-01T00:00:00Z", PositionStartDate: "2026-09-03T00:00:00Z",
  ApplicationCloseDate: "2026-09-30T00:00:00Z",
  PositionOfferingType: [{ Code: "15317", Name: "Permanent" }],
  PositionLocation: [{ LocationName: "Washington, DC", CityName: "Washington", CountrySubDivisionCode: "DC", Latitude: 38.9, Longitude: -77.0 }],
  UserArea: { Details: { WhoMayApply: { Name: "Open to the public" } } },
};

test("USAJOBS separates work location from exam venue and uses application start date", () => {
  const cycle = toCycle(job, source, evidence);
  assert.equal(cycle.appointmentType, "permanent");
  assert.equal(cycle.applicationWindow.opensOn, "2026-09-03");
  assert.equal(cycle.applicationWindow.closesOn, "2026-09-30");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "23:59");
  assert.equal(cycle.applicationWindow.officialTimeZone, "America/New_York");
  assert.equal(cycle.applicationWindow.cutoffInclusive, true);
  assert.match(cycle.scopeLabel, /Published duty locations: Washington, DC/);
  assert.equal(cycle.venues.length, 1);
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.ok(!cycle.subdivisionCodes?.length);
  assert.match(cycle.residenceRule, /not verified/);
  assert.match(cycle.languageNote ?? "", /No job-specific language level has been verified/);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN" }).canApply.result, "needs-verification");
});

test("USAJOBS does not infer permanent appointment without exact work type", () => {
  assert.equal(toCycle({ ...job, PositionOfferingType: [{ Code: "00000", Name: "Temporary" }] }, source, evidence).appointmentType, undefined);
  assert.equal(toCycle({ ...job, PositionOfferingType: undefined }, source, evidence).appointmentType, undefined);
});
