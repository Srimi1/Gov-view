import assert from "node:assert/strict";
import test from "node:test";

import { jurisdictionIntersectsBounds, jurisdictionScopeBoxes, regionCenters } from "./geography.ts";

test("scope boxes exist for every pilot jurisdiction, with separate island boxes", () => {
  for (const code of ["IN", "US", "GB", "BR", "FR", "JP"]) assert.ok((jurisdictionScopeBoxes[code]?.length ?? 0) >= 1, code);
  assert.ok(jurisdictionScopeBoxes.US.length > 10);
  assert.ok(jurisdictionScopeBoxes.JP.length > 5);
});

test("region label points use ISO 3166-2 codes", () => {
  assert.equal(regionCenters["IN-MH"]?.[2], "Maharashtra");
  assert.equal(regionCenters["IN-LA"]?.[2], "Ladakh");
  assert.ok(regionCenters["US-CA"]);
});

test("Mumbai viewport includes India even though India center lies outside view", () => {
  const mumbai = { west: 72.75, south: 18.95, east: 72.95, north: 19.2 };
  assert.equal(jurisdictionIntersectsBounds("IN", mumbai), true);
  assert.equal(jurisdictionIntersectsBounds("GB", mumbai), false);
  assert.equal(jurisdictionIntersectsBounds("US", mumbai), false);
});

test("multipart scope boxes cover separate national regions", () => {
  assert.equal(jurisdictionIntersectsBounds("US", { west: -158, south: 21, east: -157, north: 22 }), true); // Hawaii
  assert.equal(jurisdictionIntersectsBounds("GB", { west: -6.1, south: 54.5, east: -5.8, north: 54.7 }), true); // Northern Ireland
  assert.equal(jurisdictionIntersectsBounds("FR", { west: 8.8, south: 41.7, east: 9.2, north: 42.2 }), true); // Corsica
});

test("antimeridian viewport intersects Aleutians without matching unrelated jurisdictions", () => {
  const crossing = { west: 178, south: 51.3, east: -170, north: 52.3 };
  assert.equal(jurisdictionIntersectsBounds("US", crossing), true);
  assert.equal(jurisdictionIntersectsBounds("JP", crossing), false);
  assert.equal(jurisdictionIntersectsBounds("IN", crossing), false);
});

test("unrelated or malformed viewports do not match", () => {
  const midAtlantic = { west: -40, south: 10, east: -30, north: 20 };
  for (const code of Object.keys(jurisdictionScopeBoxes)) {
    assert.equal(jurisdictionIntersectsBounds(code, midAtlantic), false);
  }
  assert.equal(jurisdictionIntersectsBounds("ZZ", { west: -180, south: -90, east: 180, north: 90 }), false);
  assert.equal(jurisdictionIntersectsBounds("IN", { west: 90, south: 30, east: 70, north: 20 }), false);
  assert.equal(jurisdictionIntersectsBounds("IN", { west: NaN, south: 0, east: 180, north: 90 }), false);
});
