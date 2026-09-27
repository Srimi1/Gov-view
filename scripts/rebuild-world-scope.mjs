#!/usr/bin/env node
/** Expand committed scope boxes from the committed Natural Earth world layer. */
import { readFileSync, writeFileSync } from "node:fs";
import { jurisdictionScopeBoxes, regionCenters } from "../lib/geo-data.generated.ts";

const world = JSON.parse(readFileSync(new URL("../public/geo/world.geojson", import.meta.url), "utf8"));
const scopeBoxes = { ...jurisdictionScopeBoxes };
const polygonsOf = (geometry) => geometry?.type === "Polygon" ? [geometry.coordinates] : geometry?.type === "MultiPolygon" ? geometry.coordinates : [];
for (const feature of world.features) {
  const id = feature.properties.jurisdictionId;
  if (!/^[A-Z]{2}$/.test(id) || scopeBoxes[id]) continue;
  const boxes = [];
  for (const [ring] of polygonsOf(feature.geometry)) {
    if (!ring?.length) continue;
    const west = Math.min(...ring.map(([x]) => x));
    const south = Math.min(...ring.map(([, y]) => y));
    const east = Math.max(...ring.map(([x]) => x));
    const north = Math.max(...ring.map(([, y]) => y));
    boxes.push([west, south, east, north]);
  }
  if (boxes.length) scopeBoxes[id] = boxes;
}
const header = "/* Generated from public/geo/world.geojson and scripts/build-geo.mjs. Do not edit by hand. */";
writeFileSync(new URL("../lib/geo-data.generated.ts", import.meta.url), `${header}\n/** One outward-rounded [west, south, east, north] box per country polygon. Scope only. */\nexport const jurisdictionScopeBoxes: Readonly<Record<string, readonly (readonly [number, number, number, number])[]>> = ${JSON.stringify(scopeBoxes)};\n\n/** Label point [lat, lon, name] for piloted subdivisions. */\nexport const regionCenters: Readonly<Record<string, readonly [number, number, string]>> = ${JSON.stringify(regionCenters)};\n`);
console.log(`${Object.keys(scopeBoxes).length} jurisdictions have scope boxes`);
