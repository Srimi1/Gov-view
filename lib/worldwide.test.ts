import assert from "node:assert/strict";
import test from "node:test";
import inventory from "../data/reference/jurisdictions.json" with { type: "json" };
import { jurisdictionIntersectsBounds, jurisdictionScopeBoxes } from "./geography.ts";
import { jurisdictions } from "./opportunities.ts";
import { countryCodes, countryName, sortedCountries } from "./places.ts";
import { publishedOverview } from "./published.server.ts";

test("selector, URLs, coverage and directory use one dated jurisdiction inventory", () => {
  const codes = inventory.jurisdictions.map((item) => item.code);
  assert.equal(codes.length, 250);
  assert.deepEqual(countryCodes, codes);
  assert.deepEqual(jurisdictions.map((item) => item.code), codes);
  assert.deepEqual(new Set(sortedCountries().map((item) => item.code)), new Set(codes));
  assert.deepEqual(new Set(publishedOverview().coverage.map((item) => item.jurisdictionCode)), new Set(codes));
  assert.ok(countryName("VA"));
  assert.ok(countryName("TW"));
  assert.ok(countryName("XK"));
});

test("worldwide scope uses polygons where present; tiny or supplemental places stay searchable", () => {
  assert.equal(jurisdictionIntersectsBounds("DE", { west: 13, south: 52, east: 14, north: 53 }), true);
  assert.ok(jurisdictionScopeBoxes.VA?.length);
  assert.ok(jurisdictionScopeBoxes.TW?.length);
  assert.equal(countryCodes.includes("XK"), true);
  assert.equal(jurisdictionScopeBoxes.XK, undefined);
});
