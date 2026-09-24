import assert from "node:assert/strict";
import test from "node:test";

import { decodePublicView, encodePublicView, type PublicViewState } from "./public-view.ts";

const displayState: PublicViewState = {
  query: "nursing exam",
  pathways: ["licensing", "recruitment"],
  country: "IN",
  region: "IN-MH",
  shortcut: "closing",
  deadlineFrom: "2026-09-24",
  deadlineTo: "2026-10-01",
  cycleId: "in-nursing-license-2026",
  activeTab: "coverage",
  mobileView: "map",
  searchArea: true,
  bounds: { west: 72.871, south: 18.945, east: 73.215, north: 19.338 },
  camera: { latitude: 19.076, longitude: 72.8777, height: 13_000.4 },
};

test("public view roundtrips all display fields with map precision", () => {
  const encoded = encodePublicView(displayState);
  assert.equal(encoded.startsWith("?"), false);
  assert.equal(encoded.includes("#"), false);
  assert.deepEqual(decodePublicView(`?${encoded}`), {
    ...displayState,
    bounds: { west: 72.87, south: 18.95, east: 73.22, north: 19.34 },
    camera: { latitude: 19.08, longitude: 72.88, height: 13_000 },
  });
  assert.deepEqual(decodePublicView(encoded), decodePublicView(`?${encoded}`));
});

test("malformed fields are ignored or clamped to safe ranges", () => {
  assert.deepEqual(decodePublicView("?pathways=unknown,licensing,licensing&country=ZZ&shortcut=next&from=2026-02-30&to=2028-02-29&cycle=..%2Fsecret%20id&tab=admin&view=map&area=1&bbox=-500,-120,500,120&camera=120,-300,9999999999"), {
    pathways: ["licensing"],
    deadlineTo: "2028-02-29",
    mobileView: "map",
    searchArea: true,
    bounds: { west: -180, south: -90, east: 180, north: 90 },
    camera: { latitude: 90, longitude: -180, height: 100_000_000 },
  });
  assert.deepEqual(decodePublicView("?area=1&bbox=0,20,10,10&camera=,0,100&from=2026-13-01&view=globe#profile=private"), {
    searchArea: true,
  });
});

test("public URLs allowlist display keys and never serialize account or profile fields", () => {
  const input = {
    ...displayState,
    searchArea: false,
    profile: { name: "Private Person", citizenship: "IN", residence: "US" },
    savedSearchId: "personal-saved-search",
    email: "private@example.com",
    hash: "#profile=private",
  };
  const encoded = encodePublicView(input);
  const params = new URLSearchParams(encoded);
  assert.deepEqual([...params.keys()], ["q", "pathways", "country", "region", "shortcut", "from", "to", "cycle", "tab", "view", "camera"]);
  assert.equal(encoded.includes("bbox"), false);
  assert.equal(encoded.includes("Private Person"), false);
  assert.equal(encoded.includes("private@example.com"), false);
  assert.equal(encoded.includes("#"), false);
  assert.deepEqual(decodePublicView(`${encoded}&email=private%40example.com&citizenship=US&savedSearchId=secret#profile=private`), {
    query: displayState.query,
    pathways: displayState.pathways,
    country: displayState.country,
    region: displayState.region,
    shortcut: displayState.shortcut,
    deadlineFrom: displayState.deadlineFrom,
    deadlineTo: displayState.deadlineTo,
    cycleId: displayState.cycleId,
    activeTab: displayState.activeTab,
    mobileView: displayState.mobileView,
    camera: { latitude: 19.08, longitude: 72.88, height: 13_000 },
  });
});

test("encoder drops invalid runtime data and default values", () => {
  const invalid = {
    ...displayState,
    query: "x".repeat(205),
    pathways: ["invalid", "vocational", "vocational"],
    country: "ZZ",
    shortcut: "invalid",
    deadlineFrom: "2026-02-30",
    deadlineTo: "2026-00-01",
    cycleId: "../Private identifier",
    activeTab: "explore",
    mobileView: "list",
    searchArea: false,
    bounds: { west: 0, south: 10, east: 10, north: 5 },
    camera: { latitude: Number.NaN, longitude: 200, height: 0 },
  } as unknown as PublicViewState;
  const params = new URLSearchParams(encodePublicView(invalid));
  assert.deepEqual([...params.keys()], ["q", "pathways"]);
  assert.equal(params.get("q"), "x".repeat(200));
  assert.equal(params.get("pathways"), "vocational");
});
