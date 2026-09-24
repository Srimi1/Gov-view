/**
 * Viewport filtering against country scope. Boxes come from simplified Natural
 * Earth polygons (see scripts/build-geo.mjs) — one per island or exclave, so a
 * view of Hawaii or Corsica still matches its country. Scope only, never venues.
 */
import { jurisdictionScopeBoxes, regionCenters } from "./geo-data.generated.ts";

export { jurisdictionScopeBoxes, regionCenters };
export type ScopeBox = readonly [west: number, south: number, east: number, north: number];

export interface ViewportBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

function validBounds(bounds: ViewportBounds): boolean {
  return [bounds.west, bounds.south, bounds.east, bounds.north].every(Number.isFinite) &&
    bounds.west >= -180 && bounds.west <= 180 && bounds.east >= -180 && bounds.east <= 180 &&
    bounds.south >= -90 && bounds.north <= 90 && bounds.south <= bounds.north;
}

function longitudeSegments(west: number, east: number): readonly (readonly [number, number])[] {
  return west <= east ? [[west, east]] : [[west, 180], [-180, east]];
}

/** Bounds intersect if viewport touches any polygon box; crossing ±180° works. */
export function jurisdictionIntersectsBounds(code: string, viewportBounds: ViewportBounds): boolean {
  if (!validBounds(viewportBounds)) return false;
  const boxes = jurisdictionScopeBoxes[code];
  if (!boxes) return false;
  const viewportLongitude = longitudeSegments(viewportBounds.west, viewportBounds.east);
  return boxes.some(([west, south, east, north]) => {
    if (south > viewportBounds.north || north < viewportBounds.south) return false;
    return longitudeSegments(west, east).some(([boxWest, boxEast]) =>
      viewportLongitude.some(([viewWest, viewEast]) => boxWest <= viewEast && viewWest <= boxEast),
    );
  });
}
