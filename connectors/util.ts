import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { OpportunityCycle, SourceEvidence, Venue } from "../lib/opportunities.ts";
import type { Evidence, SourceConfig } from "./types.ts";

// ── Text ──────────────────────────────────────────────────────────────────────

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#039": "'", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", hellip: "…" };

export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z#0-9]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match);
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

export function slug(text: string, max = 60): string {
  return text.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, max).replace(/-$/, "");
}

export function shortHash(text: string, length = 8): string {
  return createHash("sha256").update(text).digest("hex").slice(0, length);
}

/** Stable source-item digest; bulk feed changes elsewhere do not revoke this item's review. */
export function itemHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

// ── Dates ─────────────────────────────────────────────────────────────────────

/** "06/10/2026", "6.10.2026" or "06-10-2026" (day first) → "2026-10-06". */
export function dayFirstDate(text: string | null | undefined): string | null {
  const match = /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(text ?? "");
  if (!match) return null;
  const [, d, m, y] = match;
  const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : iso;
}

/** "6:00pm" / "18:00" → "18:00". */
export function clockTime(text: string | null | undefined): string | null {
  const match = /(?:^|[^\d])(\d{1,2})[:.](\d{2})\s*(am|pm)?\b/i.exec(text ?? "");
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();
  if (minutes > 59 || (meridiem && (hours < 1 || hours > 12))) return null;
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return hours < 24 ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}` : null;
}

/** Local civil date of an ISO timestamp with offset, e.g. "2026-10-09T09:00:00+01:00" → "2026-10-09". */
export function localDatePart(timestamp: string | null | undefined): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(timestamp ?? "");
  return match ? match[1] : null;
}

export function localTimePart(timestamp: string | null | undefined): string | null {
  const match = /T(\d{2}:\d{2})/.exec(timestamp ?? "");
  return match ? match[1] : null;
}

// ── Places ────────────────────────────────────────────────────────────────────

interface City { name: string; ascii: string; alt: string[]; lat: number; lon: number; country: string; region: string | null; population: number }
let cityIndex: Map<string, City[]> | null = null;

const placeKey = (text: string) => text.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function cities(): Map<string, City[]> {
  if (cityIndex) return cityIndex;
  const list = JSON.parse(readFileSync(new URL("../data/reference/cities.json", import.meta.url), "utf8")) as City[];
  cityIndex = new Map();
  for (const city of list) {
    for (const name of new Set([city.name, city.ascii, ...city.alt])) {
      const key = `${city.country}:${placeKey(name)}`;
      const bucket = cityIndex.get(key) ?? [];
      bucket.push(city);
      cityIndex.set(key, bucket);
    }
  }
  return cityIndex;
}

/** City centre from GeoNames, preferring the biggest match (and the given region, if any). No network calls. */
export function geocodeCity(name: string, country: string, region?: string | null): { latitude: number; longitude: number; subdivision: string | null } | null {
  const candidates = cities().get(`${country}:${placeKey(name)}`);
  if (!candidates?.length) return null;
  const best = (region && candidates.find((city) => city.region === region)) || candidates[0];
  return { latitude: best.lat, longitude: best.lon, subdivision: best.region };
}

type Ring = [number, number][];
type RegionShape = { id: string; polygons: Ring[][] };
const regionShapes = new Map<string, RegionShape[]>();

function shapesFor(country: string): RegionShape[] {
  let shapes = regionShapes.get(country);
  if (shapes) return shapes;
  shapes = [];
  try {
    const geo = JSON.parse(readFileSync(new URL(`../public/geo/regions/${country}.geojson`, import.meta.url), "utf8")) as { features: { properties: { regionId: string }; geometry: { type: string; coordinates: Ring[] | Ring[][] } }[] };
    shapes = geo.features.map((feature) => ({
      id: feature.properties.regionId,
      polygons: feature.geometry.type === "Polygon" ? [feature.geometry.coordinates as Ring[]] : feature.geometry.coordinates as Ring[][],
    }));
  } catch {
    // No regions for this country.
  }
  regionShapes.set(country, shapes);
  return shapes;
}

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** ISO 3166-2 region containing a point, from the same shapes the map draws. */
export function regionAt(country: string, latitude: number, longitude: number): string | null {
  for (const shape of shapesFor(country)) {
    if (shape.polygons.some(([outer, ...holes]) => inRing(longitude, latitude, outer) && !holes.some((hole) => inRing(longitude, latitude, hole)))) return shape.id;
  }
  return null;
}

export function cityVenue(name: string, city: string, country: string, region?: string | null): Venue {
  const place = geocodeCity(city, country, region);
  if (!place) return { kind: "unknown", name: `${name}${city ? ` (${city}; location not matched)` : ""}` };
  return { kind: "published", name, city, latitude: place.latitude, longitude: place.longitude, precision: "city", subdivision: place.subdivision ?? undefined };
}

// ── Records ───────────────────────────────────────────────────────────────────

export function evidenceSource(source: SourceConfig, evidence: Evidence, title: string, format: SourceEvidence["format"], language: string, url?: string): SourceEvidence {
  const publicUrl = url ?? evidence.url;
  const linkedDocument = publicUrl !== evidence.url && (
    format === "PDF" || format === "scanned PDF" || (format === "HTML" && !/html/i.test(evidence.contentType))
  );
  return {
    id: `${source.id}:${shortHash(`${format}:${publicUrl}:${title}`, 12)}`,
    title,
    authority: source.authority,
    language,
    format,
    url: publicUrl,
    ...(linkedDocument ? { fetchStatus: "linked" as const } : { fetchStatus: "fetched" as const, fetchedUrl: evidence.url, sha256: evidence.sha256 }),
    lastSuccessfulFetchAt: linkedDocument ? null : evidence.fetchedAt,
    lastValidatedAt: null,
    verificationStatus: "pending-review",
  };
}

type Required = "id" | "title" | "authority" | "pathway" | "jurisdictionCode" | "jurisdictionName" | "applicationWindow" | "sources";
export function makeCycle(fields: Pick<OpportunityCycle, Required> & Partial<OpportunityCycle>): OpportunityCycle {
  return {
    fixture: false,
    cycleLabel: "",
    programme: fields.title,
    status: "open",
    statusNote: "",
    scopeLabel: "",
    outcome: "",
    qualifications: "See the official notice.",
    citizenshipRule: "See the official notice.",
    residenceRule: "See the official notice.",
    selectionStages: [],
    fee: "See the official notice.",
    rules: null,
    venues: [{ kind: "unknown", name: "Venue not announced" }],
    lastVerifiedAt: null,
    applicationUrl: null,
    changes: [],
    ...fields,
  };
}
