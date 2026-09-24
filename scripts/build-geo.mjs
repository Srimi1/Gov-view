#!/usr/bin/env node
/**
 * Builds the map and place data from public-domain / open sources. No dependencies.
 *
 *   node scripts/build-geo.mjs <source-dir>
 *
 * <source-dir> must contain (download once, they are not committed):
 *   ne_10m_admin_0_countries_ind.geojson   Natural Earth 1:10m countries, India point of view
 *   ne_10m_admin_1_states_provinces.geojson Natural Earth 1:10m states and provinces
 *   cities15000.txt                        GeoNames cities with population > 15,000
 *
 * Outputs:
 *   public/geo/world.geojson            simplified country polygons (India's official boundary view)
 *   public/geo/regions/<CC>.geojson      state/province polygons for each pilot country
 *   lib/geo-data.generated.ts            scope boxes and region label points for filters and markers
 *   data/reference/cities.json           city → coordinates + ISO 3166-2 region, for offline geocoding
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const source = process.argv[2];
if (!source) {
  console.error("Usage: node scripts/build-geo.mjs <source-dir>");
  process.exit(1);
}

const PILOT = ["IN", "US", "GB", "BR", "FR", "JP"];
const WORLD_TOLERANCE = 0.04; // degrees ≈ 4 km — the state layer supplies close-zoom detail
const REGION_TOLERANCE = 0.004; // ≈ 400 m

const readJson = (name) => JSON.parse(readFileSync(join(source, name), "utf8"));

// Douglas–Peucker on one ring, iterative to avoid deep recursion on long coastlines.
function simplifyRing(points, tolerance) {
  if (points.length <= 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const tol2 = tolerance * tolerance;
  while (stack.length) {
    const [first, last] = stack.pop();
    const [ax, ay] = points[first];
    const [bx, by] = points[last];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxDist = 0;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const [px, py] = points[i];
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px;
      const ey = ay + t * dy - py;
      const dist = ex * ex + ey * ey;
      if (dist > maxDist) { maxDist = dist; index = i; }
    }
    if (maxDist > tol2 && index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const round = (value, places) => Number(value.toFixed(places));

function ringBox(ring) {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const [x, y] of ring) {
    if (x < west) west = x;
    if (x > east) east = x;
    if (y < south) south = y;
    if (y > north) north = y;
  }
  return [west, south, east, north];
}

function polygonsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

/** Simplify and round; drop islands smaller than a few tolerance cells unless nothing else is left. */
function simplifyGeometry(geometry, tolerance, places) {
  const polygons = polygonsOf(geometry);
  const minSpan = tolerance * 2;
  const output = [];
  for (const polygon of polygons) {
    const [outer, ...holes] = polygon;
    const [w, s, e, n] = ringBox(outer);
    if (polygons.length > 1 && e - w < minSpan && n - s < minSpan) continue;
    const clean = (ring) => {
      const simplified = simplifyRing(ring, tolerance).map(([x, y]) => [round(x, places), round(y, places)]);
      const deduped = simplified.filter((point, i) => i === 0 || point[0] !== simplified[i - 1][0] || point[1] !== simplified[i - 1][1]);
      // Cesium drops a whole batch of fills if one ring is degenerate, so reject zero-area rings.
      let area = 0;
      for (let i = 0; i < deduped.length - 1; i += 1) area += deduped[i][0] * deduped[i + 1][1] - deduped[i + 1][0] * deduped[i][1];
      return deduped.length >= 4 && Math.abs(area) > 1e-7 ? deduped : null;
    };
    const shell = clean(outer);
    if (!shell) continue;
    output.push([shell, ...holes.map(clean).filter(Boolean)]);
  }
  if (!output.length && polygons.length) {
    // Tiny territory: keep its largest ring unsimplified so it still exists on the map.
    const [outer] = polygons[0];
    output.push([outer.map(([x, y]) => [round(x, places), round(y, places)])]);
  }
  return output.length === 1 ? { type: "Polygon", coordinates: output[0] } : { type: "MultiPolygon", coordinates: output };
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInGeometry(point, geometry) {
  return polygonsOf(geometry).some(([outer, ...holes]) => pointInRing(point, outer) && !holes.some((hole) => pointInRing(point, hole)));
}

// ── Countries ────────────────────────────────────────────────────────────────
const countries = readJson("ne_10m_admin_0_countries_ind.geojson");
const world = { type: "FeatureCollection", features: [] };
const scopeBoxes = {};
for (const feature of countries.features) {
  const p = feature.properties;
  const iso = [p.ISO_A2_EH, p.ISO_A2].find((code) => /^[A-Z]{2}$/.test(code ?? ""));
  const id = iso ?? p.ADM0_A3;
  // Antarctica wraps the pole, which Cesium cannot fill, and has no recruitment authorities.
  if (id === "AQ") continue;
  const geometry = simplifyGeometry(feature.geometry, WORLD_TOLERANCE, 3);
  world.features.push({ type: "Feature", properties: { jurisdictionId: id, name: p.NAME }, geometry });
  if (PILOT.includes(id)) {
    // Several features can share a code (e.g. France and Clipperton Island).
    scopeBoxes[id] = (scopeBoxes[id] ?? []).concat(polygonsOf(geometry).map(([outer]) => ringBox(outer).map((value, i) => round(i < 2 ? Math.floor(value * 1000) / 1000 : Math.ceil(value * 1000) / 1000, 3))));
  }
}
mkdirSync("public/geo/regions", { recursive: true });
writeFileSync("public/geo/world.geojson", JSON.stringify(world));

// ── States and provinces ─────────────────────────────────────────────────────
const provinces = readJson("ne_10m_admin_1_states_provinces.geojson");
const regionCenters = {};
const regionGeometry = {};
for (const country of PILOT) {
  const collection = { type: "FeatureCollection", features: [] };
  for (const feature of provinces.features) {
    const p = feature.properties;
    if (p.iso_a2 !== country || !/^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(p.iso_3166_2 ?? "")) continue;
    const geometry = simplifyGeometry(feature.geometry, REGION_TOLERANCE, 4);
    const name = p.name_en || p.name;
    collection.features.push({ type: "Feature", properties: { regionId: p.iso_3166_2, name }, geometry });
    regionCenters[p.iso_3166_2] = [round(p.latitude, 3), round(p.longitude, 3), name];
    regionGeometry[p.iso_3166_2] = { country, geometry };
  }
  writeFileSync(`public/geo/regions/${country}.geojson`, JSON.stringify(collection));
  console.log(`${country}: ${collection.features.length} regions`);
}

// ── Cities (for offline geocoding of exam venues) ────────────────────────────
const cities = [];
const regionEntries = Object.entries(regionGeometry);
for (const line of readFileSync(join(source, "cities15000.txt"), "utf8").split("\n")) {
  const cols = line.split("\t");
  if (cols.length < 15 || !PILOT.includes(cols[8])) continue;
  const lat = Number(cols[4]);
  const lon = Number(cols[5]);
  const country = cols[8];
  const region = regionEntries.find(([, value]) => value.country === country && pointInGeometry([lon, lat], value.geometry))?.[0] ?? null;
  const alternates = cols[3].split(",").filter((name) => name.length > 3 && /^[\p{Script=Latin}\s'.-]+$/u.test(name) && name !== cols[1] && name !== cols[2]).slice(0, 4);
  cities.push({ name: cols[1], ascii: cols[2], alt: alternates, lat: round(lat, 4), lon: round(lon, 4), country, region, population: Number(cols[14]), admin1: cols[10] });
}
// Coastal towns can fall just outside simplified coastlines. Use the region most
// often matched by other cities sharing the same GeoNames admin-1 code.
const votes = new Map();
for (const city of cities) {
  if (!city.region) continue;
  const key = `${city.country}.${city.admin1}`;
  const tally = votes.get(key) ?? new Map();
  tally.set(city.region, (tally.get(city.region) ?? 0) + 1);
  votes.set(key, tally);
}
for (const city of cities) {
  if (!city.region) {
    const tally = votes.get(`${city.country}.${city.admin1}`);
    if (tally) city.region = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  delete city.admin1;
}
cities.sort((a, b) => b.population - a.population);
mkdirSync("data/reference", { recursive: true });
writeFileSync("data/reference/cities.json", JSON.stringify(cities));
console.log(`cities: ${cities.length} (${cities.filter((city) => city.region).length} matched to a region)`);

// ── Generated TypeScript ─────────────────────────────────────────────────────
const header = `/* Generated by scripts/build-geo.mjs from Natural Earth (public domain). Do not edit by hand. */\n`;
writeFileSync("lib/geo-data.generated.ts", `${header}
/** One outward-rounded [west, south, east, north] box per country polygon. Scope only — never a venue. */
export const jurisdictionScopeBoxes: Readonly<Record<string, readonly (readonly [number, number, number, number])[]>> = ${JSON.stringify(scopeBoxes)};

/** Label point [lat, lon, name] for each state or province in the pilot countries. */
export const regionCenters: Readonly<Record<string, readonly [number, number, string]>> = ${JSON.stringify(regionCenters)};
`);
console.log("world features:", world.features.length);
