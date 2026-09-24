import { jurisdictions, type Pathway } from "./opportunities.ts";

export type PublicViewBounds = { west: number; south: number; east: number; north: number };
export type PublicViewCamera = { latitude: number; longitude: number; height: number };
export type PublicViewShortcut = "all" | "open" | "closing" | "changed";
export type PublicViewTab = "explore" | "coverage";

/** Only display state belongs in a public share URL. */
export type PublicViewState = {
  query: string;
  pathways: readonly Pathway[];
  country: string;
  /** ISO 3166-2 state or region within `country`. */
  region?: string;
  shortcut: PublicViewShortcut;
  deadlineFrom: string;
  deadlineTo: string;
  cycleId: string;
  activeTab: PublicViewTab;
  mobileView: "list" | "map";
  searchArea: boolean;
  bounds: PublicViewBounds | null;
  camera: PublicViewCamera | null;
};

const knownPathways = new Set<Pathway>(["recruitment", "licensing", "admission", "vocational"]);
const knownCountries = new Set(jurisdictions.map((item) => item.code));
/** Cycle ids are lowercase slugs; real ids are only known after data loads, so check the shape. */
const cyclePattern = /^[a-z0-9][a-z0-9-]{0,119}$/;
const regionPattern = /^[A-Z]{2}-[A-Z0-9]{1,3}$/;
const shortcuts = new Set<PublicViewShortcut>(["all", "open", "closing", "changed"]);
const maximumQueryLength = 200;
const maximumCameraHeight = 100_000_000;

function pathway(value: unknown): value is Pathway {
  return typeof value === "string" && knownPathways.has(value as Pathway);
}

function cleanPathways(value: unknown): Pathway[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(pathway))];
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

function numberInRange(value: unknown, minimum: number, maximum: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(maximum, Math.max(minimum, value));
}

function parseNumber(value: string): number | null {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function parseTuple(value: string | null, size: number): number[] | null {
  if (value === null) return null;
  const parts = value.split(",");
  if (parts.length !== size) return null;
  const numbers = parts.map(parseNumber);
  return numbers.every((number): number is number => number !== null) ? numbers : null;
}

function cleanBounds(value: unknown): PublicViewBounds | null {
  if (!value || typeof value !== "object") return null;
  const bounds = value as Partial<PublicViewBounds>;
  const west = numberInRange(bounds.west, -180, 180);
  const south = numberInRange(bounds.south, -90, 90);
  const east = numberInRange(bounds.east, -180, 180);
  const north = numberInRange(bounds.north, -90, 90);
  if (west === null || south === null || east === null || north === null || south > north) return null;
  // West may exceed east when a rectangle crosses the antimeridian.
  return { west, south, east, north };
}

function cleanCamera(value: unknown): PublicViewCamera | null {
  if (!value || typeof value !== "object") return null;
  const camera = value as Partial<PublicViewCamera>;
  const latitude = numberInRange(camera.latitude, -90, 90);
  const longitude = numberInRange(camera.longitude, -180, 180);
  const height = numberInRange(camera.height, 1, maximumCameraHeight);
  if (latitude === null || longitude === null || height === null) return null;
  return { latitude, longitude, height };
}

function fromTuple(value: string | null): PublicViewBounds | null {
  const tuple = parseTuple(value, 4);
  return tuple ? cleanBounds({ west: tuple[0], south: tuple[1], east: tuple[2], north: tuple[3] }) : null;
}

function cameraFromTuple(value: string | null): PublicViewCamera | null {
  const tuple = parseTuple(value, 3);
  return tuple ? cleanCamera({ latitude: tuple[0], longitude: tuple[1], height: tuple[2] }) : null;
}

function fixedCoordinate(value: number): string {
  return value.toFixed(2);
}

/** Stable query string, with only approved public display fields. No leading '?' or hash. */
export function encodePublicView(state: PublicViewState): string {
  const params = new URLSearchParams();
  if (typeof state.query === "string" && state.query.length > 0) params.set("q", state.query.slice(0, maximumQueryLength));

  const pathways = cleanPathways(state.pathways);
  if (pathways.length) params.set("pathways", pathways.join(","));
  if (knownCountries.has(state.country)) {
    params.set("country", state.country);
    if (typeof state.region === "string" && regionPattern.test(state.region) && state.region.startsWith(`${state.country}-`)) params.set("region", state.region);
  }
  if (shortcuts.has(state.shortcut) && state.shortcut !== "all") params.set("shortcut", state.shortcut);
  if (validDate(state.deadlineFrom)) params.set("from", state.deadlineFrom);
  if (validDate(state.deadlineTo)) params.set("to", state.deadlineTo);
  if (typeof state.cycleId === "string" && cyclePattern.test(state.cycleId)) params.set("cycle", state.cycleId);
  if (state.activeTab === "coverage") params.set("tab", "coverage");
  if (state.mobileView === "map") params.set("view", "map");
  if (state.searchArea === true) {
    params.set("area", "1");
    const bounds = cleanBounds(state.bounds);
    if (bounds) params.set("bbox", [bounds.west, bounds.south, bounds.east, bounds.north].map(fixedCoordinate).join(","));
  }
  const camera = cleanCamera(state.camera);
  if (camera) params.set("camera", `${fixedCoordinate(camera.latitude)},${fixedCoordinate(camera.longitude)},${Math.round(camera.height)}`);
  return params.toString();
}

/** Read valid public fields only. Missing fields leave caller's defaults intact. */
export function decodePublicView(search: string): Partial<PublicViewState> {
  const query = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(query.split("#", 1)[0]);
  const state: Partial<PublicViewState> = {};

  const text = params.get("q");
  if (text !== null) state.query = text.slice(0, maximumQueryLength);

  const pathwayParam = params.get("pathways");
  if (pathwayParam !== null) state.pathways = cleanPathways(pathwayParam.split(","));

  const country = params.get("country");
  if (country !== null && knownCountries.has(country)) {
    state.country = country;
    const region = params.get("region");
    if (region !== null && regionPattern.test(region) && region.startsWith(`${country}-`)) state.region = region;
  }

  const shortcut = params.get("shortcut");
  if (shortcut !== null && shortcuts.has(shortcut as PublicViewShortcut)) state.shortcut = shortcut as PublicViewShortcut;

  const from = params.get("from");
  if (validDate(from)) state.deadlineFrom = from;
  const to = params.get("to");
  if (validDate(to)) state.deadlineTo = to;

  const cycleId = params.get("cycle");
  if (cycleId !== null && cyclePattern.test(cycleId)) state.cycleId = cycleId;

  const tab = params.get("tab");
  if (tab === "coverage" || tab === "explore") state.activeTab = tab;
  const view = params.get("view");
  if (view === "map" || view === "list") state.mobileView = view;

  const area = params.get("area");
  if (area === "1" || area === "0") state.searchArea = area === "1";
  if (state.searchArea) {
    const bounds = fromTuple(params.get("bbox"));
    if (bounds) state.bounds = bounds;
  }

  const camera = cameraFromTuple(params.get("camera"));
  if (camera) state.camera = camera;
  return state;
}
