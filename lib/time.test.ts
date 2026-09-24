import assert from "node:assert/strict";
import test from "node:test";

import { ageOn, civilDateIn, daysBetween, isIsoDate } from "./time.ts";

test("civil date follows the authority's timezone near midnight", () => {
  const instant = new Date("2026-09-24T20:00:00Z"); // 01:30 on 25 Sep in India, 05:00 in Tokyo
  assert.equal(civilDateIn("Asia/Kolkata", instant), "2026-09-25");
  assert.equal(civilDateIn("Asia/Tokyo", instant), "2026-09-25");
  assert.equal(civilDateIn("America/New_York", instant), "2026-09-24");
  assert.equal(civilDateIn("Not/AZone", instant), "2026-09-24");
});

test("date helpers", () => {
  assert.equal(daysBetween("2026-09-24", "2026-10-01"), 7);
  assert.equal(daysBetween("2026-10-01", "2026-09-24"), -7);
  assert.equal(isIsoDate("2028-02-29"), true);
  assert.equal(isIsoDate("2027-02-29"), false);
  assert.equal(ageOn("2000-09-24", "2026-09-23"), 25);
  assert.equal(ageOn("2000-09-24", "2026-09-24"), 26);
});
