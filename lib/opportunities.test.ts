import assert from "node:assert/strict";
import test from "node:test";

import {
  FIXTURE_NOTICE,
  countByJurisdiction,
  countCycles,
  demoCoverage as coverage,
  daysUntilDeadline,
  filterOpportunities,
  getCoverage,
  jurisdictions,
  demoOpportunities as opportunities,
} from "./opportunities.ts";

const today = "2026-09-24";

test("fixtures span every pathway, pilot jurisdiction, and prototype state", () => {
  assert.equal(opportunities.length, 16);
  assert.equal(countCycles(opportunities), 16);
  assert.deepEqual(new Set(opportunities.map((item) => item.pathway)), new Set(["recruitment", "licensing", "admission", "vocational"]));
  assert.deepEqual(new Set(opportunities.map((item) => item.status)), new Set(["open", "closed", "extended", "cancelled", "stale", "uncertain"]));
  assert.deepEqual(new Set(opportunities.map((item) => item.jurisdictionCode)), new Set(jurisdictions.map((item) => item.code)));
  assert.equal(coverage.length, jurisdictions.length);
});

test("prototype data never claims a verified notice or official application URL", () => {
  assert.match(FIXTURE_NOTICE, /demo records/);
  for (const item of opportunities) {
    assert.equal(item.fixture, true);
    assert.equal(item.applicationUrl, null);
    assert.equal(item.lastVerifiedAt, null);
    assert.equal(item.sources.length > 0, true);
    assert.equal(item.sources.every((source) => source.url === null && source.verificationStatus === "fixture"), true);
    assert.equal(item.rules === null || typeof item.rules === "object", true);
    assert.equal(item.venues.length > 0, true);
    for (const venue of item.venues) {
      if (venue.kind === "published") {
        assert.equal(Number.isFinite(venue.latitude) && Number.isFinite(venue.longitude), true);
      } else {
        assert.equal("latitude" in venue, false);
        assert.equal("longitude" in venue, false);
      }
    }
  }
});

test("map counts one application cycle even with several venues or repeated notices", () => {
  const multiVenue = opportunities.find((item) => item.id === "jp-engineering-admission-2026");
  assert.ok(multiVenue);
  assert.equal(multiVenue.venues.length, 2);
  assert.equal(countCycles([multiVenue, multiVenue]), 1);
  assert.deepEqual(countByJurisdiction([multiVenue, multiVenue]), { JP: 1 });
  assert.equal(filterOpportunities([multiVenue, multiVenue], {}, today).length, 1);
  assert.deepEqual(countByJurisdiction(opportunities), { IN: 3, US: 3, GB: 3, BR: 2, FR: 2, JP: 3 });
});

test("a nonmatching duplicate cannot hide a later matching cycle revision", () => {
  const current = opportunities.find((item) => item.id === "in-nursing-license-2026");
  assert.ok(current);
  const oldRevision = { ...current, status: "closed" as const };
  const result = filterOpportunities([oldRevision, current, current], { statuses: ["extended"] }, today);
  assert.deepEqual(result, [current]);
});

test("latest cycle revision wins when both versions match filters", () => {
  const current = opportunities.find((item) => item.id === "in-nursing-license-2026");
  assert.ok(current);
  const oldRevision = {
    ...current,
    status: "open" as const,
    changes: [{ at: "2026-09-18", kind: "created" as const, summary: "Earlier sample revision." }],
  };
  assert.deepEqual(filterOpportunities([oldRevision, current], { statuses: ["open", "extended"] }, today), [current]);
  assert.deepEqual(filterOpportunities([current, oldRevision], { statuses: ["open", "extended"] }, today), [current]);
  const equalDateRevision = { ...current, statusNote: "Later item wins date tie." };
  assert.deepEqual(filterOpportunities([current, equalDateRevision], {}, today), [equalDateRevision]);
});

test("search, pathway, jurisdiction, and state filters share one selector", () => {
  const result = filterOpportunities(opportunities, {
    search: "nursING",
    pathways: ["licensing"],
    jurisdictionCodes: ["IN"],
    statuses: ["extended"],
  }, today);
  assert.deepEqual(result.map((item) => item.id), ["in-nursing-license-2026"]);
  assert.deepEqual(filterOpportunities(opportunities, { search: "sao paulo" }, today).map((item) => item.id), ["br-public-health-2026"]);
  assert.deepEqual(filterOpportunities(opportunities, { search: "france", pathways: ["admission"] }, today).map((item) => item.id), ["fr-health-admission-2026"]);
});

test("deadline shortcuts use source civil date and exclude cancelled or closed cycles", () => {
  const result = filterOpportunities(opportunities, { closingWithinDays: 7 }, today);
  assert.deepEqual(result.map((item) => item.id), ["in-nursing-license-2026", "jp-municipal-recruitment-2026"]);
  assert.equal(daysUntilDeadline(opportunities.find((item) => item.id === "in-nursing-license-2026")!, today), 7);
  assert.equal(daysUntilDeadline(opportunities.find((item) => item.id === "jp-skills-test-2026")!, today), null);
  assert.deepEqual(filterOpportunities(opportunities, { deadlineFrom: "2026-10-01", deadlineTo: "2026-10-05" }, today).map((item) => item.id), ["in-nursing-license-2026", "us-federal-analyst-2026", "fr-health-admission-2026"]);
});

test("recent changes and coverage states stay distinct", () => {
  const changed = filterOpportunities(opportunities, { changedWithinDays: 2 }, today);
  assert.equal(changed.some((item) => item.status === "cancelled"), true);
  assert.equal(changed.some((item) => item.status === "stale"), true);
  assert.equal(changed.some((item) => item.status === "uncertain"), true);
  assert.equal(getCoverage("IN")?.status, "no-verified-listings");
  assert.equal(getCoverage("US")?.status, "sources-checked-no-current");
  assert.equal(getCoverage("GB")?.status, "verified-listings");
  assert.equal(getCoverage("ZZ"), undefined);
});

test("live status closes records whose deadline or cutoff time has passed", async () => {
  const { liveStatus } = await import("./opportunities.ts");
  const base = { ...opportunities[0], fixture: false, status: "open" as const };
  const at = (iso: string) => new Date(iso);
  const window = (closesOn: string, cutoffLocalTime: string | null) => ({ ...base.applicationWindow, closesOn, cutoffLocalTime, officialTimeZone: "Asia/Kolkata" });
  assert.equal(liveStatus({ ...base, applicationWindow: window("2026-10-06", null) }, at("2026-10-06T17:00:00Z")), "open");
  assert.equal(liveStatus({ ...base, applicationWindow: window("2026-10-06", null) }, at("2026-10-06T19:00:00Z")), "closed", "past midnight IST");
  assert.equal(liveStatus({ ...base, applicationWindow: window("2026-10-06", "18:00") }, at("2026-10-06T12:00:00Z")), "open", "17:30 IST is before the 18:00 cutoff");
  assert.equal(liveStatus({ ...base, applicationWindow: window("2026-10-06", "18:00") }, at("2026-10-06T12:40:00Z")), "closed");
  assert.equal(liveStatus({ ...base, applicationWindow: window("2026-10-06", "18:00") }, at("2026-10-06T12:20:00Z")), "open");
  const upcoming = { ...base, status: "upcoming" as const, applicationWindow: { ...window("2026-10-31", null), opensOn: "2026-09-30" } };
  assert.equal(liveStatus(upcoming, at("2026-09-29T00:00:00Z")), "upcoming");
  assert.equal(liveStatus(upcoming, at("2026-09-30T00:00:00Z")), "open");
  assert.equal(liveStatus({ ...base, fixture: true, status: "open" }, at("2030-01-01T00:00:00Z")), "open", "demo records keep their scenario");
});
