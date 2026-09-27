#!/usr/bin/env node
/** Refresh the dated worldwide inventory from UN M49's English full view. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { isoCountryCodes } from "../lib/places.ts";

const SOURCE_URL = "https://unstats.un.org/unsd/methodology/m49/overview/";
const response = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`UN M49: HTTP ${response.status}`);
const html = await response.text();
const byCode = new Map();
const plain = (value) => value.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number))).replace(/&amp;/g, "&").trim();
for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
  const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => plain(match[1]));
  if (cells.length < 12 || !/^\d{3}$/.test(cells[9]) || !/^[A-Z]{2}$/.test(cells[10])) continue;
  const code = cells[10];
  // Page repeats same table in several languages. Its first occurrence is English.
  if (!byCode.has(code)) byCode.set(code, { code, name: cells[8], m49: cells[9], iso3: cells[11], region: cells[3], subregion: cells[5] || null, source: "UN M49" });
}
if (byCode.size < 240 || byCode.size > 260) throw new Error(`Unexpected UN M49 inventory size: ${byCode.size}`);
const unmatched = isoCountryCodes.filter((code) => !byCode.has(code));
if (unmatched.join(",") !== "TW") throw new Error(`Existing country codes need manual reconciliation: ${unmatched.join(",")}`);
byCode.set("TW", { code: "TW", name: "Taiwan", m49: null, iso3: "TWN", region: "Asia", subregion: "Eastern Asia", source: "supplemental: separately administered" });
byCode.set("XK", { code: "XK", name: "Kosovo", m49: null, iso3: null, region: "Europe", subregion: "Southern Europe", source: "supplemental: separately administered; XK is local, not ISO" });
const world = JSON.parse(readFileSync(new URL("../public/geo/world.geojson", import.meta.url), "utf8"));
const geometryByCode = new Map(world.features.map((feature) => [feature.properties.jurisdictionId, feature.geometry]));
const pilotCenters = { IN: [22.5, 79], US: [39, -98], GB: [54, -2], BR: [-10, -55], FR: [46.5, 2.5], JP: [36, 138] };
function representativeCenter(geometry) {
  if (!geometry) return null;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  const polygon = polygons.sort((a, b) => Math.abs(area(b[0])) - Math.abs(area(a[0])))[0];
  if (!polygon?.[0]?.length) return null;
  const ring = polygon[0];
  const box = ring.reduce((bounds, [lon, lat]) => [Math.min(bounds[0], lon), Math.min(bounds[1], lat), Math.max(bounds[2], lon), Math.max(bounds[3], lat)], [180, 90, -180, -90]);
  return { latitude: Number(((box[1] + box[3]) / 2).toFixed(3)), longitude: Number(((box[0] + box[2]) / 2).toFixed(3)) };
}
function area(ring) {
  let twice = 0;
  for (let i = 0; i < ring.length - 1; i++) twice += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return twice / 2;
}
for (const entry of byCode.values()) {
  const geometry = geometryByCode.get(entry.code);
  const pilot = pilotCenters[entry.code];
  entry.center = pilot ? { latitude: pilot[0], longitude: pilot[1] } : representativeCenter(geometry);
  entry.geometryCode = geometry ? entry.code : null;
}
const inventory = {
  inventoryAsOf: new Date().toISOString().slice(0, 10),
  unM49Source: SOURCE_URL,
  unM49Sha256: createHash("sha256").update(html).digest("hex"),
  jurisdictions: [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name, "en")),
};
const output = new URL("../data/reference/jurisdictions.json", import.meta.url);
writeFileSync(output, `${JSON.stringify(inventory, null, 2)}\n`);
console.log(`${byCode.size} jurisdictions; ${isoCountryCodes.length} existing ISO codes, 2 documented supplements`);
