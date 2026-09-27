import type { GlobeBounds, GlobeCamera } from "../components/GlobeView.tsx";

const rad = Math.PI / 180;
const deg = 180 / Math.PI;

export function wrapLongitude(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

/** Unit-disc coordinates. The positive hemisphere faces the camera. */
export function projectGlobe(latitude: number, longitude: number, camera: Pick<GlobeCamera, "latitude" | "longitude">) {
  const lat = latitude * rad;
  const center = camera.latitude * rad;
  const delta = wrapLongitude(longitude - camera.longitude) * rad;
  const x = Math.cos(lat) * Math.sin(delta);
  const y = Math.cos(center) * Math.sin(lat) - Math.sin(center) * Math.cos(lat) * Math.cos(delta);
  const depth = Math.sin(center) * Math.sin(lat) + Math.cos(center) * Math.cos(lat) * Math.cos(delta);
  return { x, y, visible: depth >= 0 };
}

export function unprojectGlobe(x: number, y: number, camera: Pick<GlobeCamera, "latitude" | "longitude">) {
  const radiusSquared = x * x + y * y;
  if (radiusSquared > 1) return null;
  const depth = Math.sqrt(Math.max(0, 1 - radiusSquared));
  const center = camera.latitude * rad;
  return {
    latitude: Math.asin(y * Math.cos(center) + depth * Math.sin(center)) * deg,
    longitude: wrapLongitude(camera.longitude + Math.atan2(x, depth * Math.cos(center) - y * Math.sin(center)) * deg),
  };
}

export function globeScale(height: number): number {
  return Math.max(0.65, Math.min(8, 12_000_000 / height));
}

/** Conservative search rectangle; wide views and polar views retain all jurisdictions. */
export function globeBounds(camera: GlobeCamera, width: number, height: number, radius: number): GlobeBounds {
  const scale = globeScale(camera.height);
  if (scale < 1.8 || Math.abs(camera.latitude) >= 65 || !width || !height || !radius) {
    return { west: -180, south: -90, east: 180, north: 90 };
  }
  const latitudeSpan = Math.asin(Math.min(1, height / (2 * radius * scale))) * deg * 1.2;
  const longitudeSpan = Math.asin(Math.min(1, width / (2 * radius * scale))) * deg * 1.4 / Math.max(0.35, Math.cos(camera.latitude * rad));
  if (longitudeSpan >= 180) return { west: -180, south: -90, east: 180, north: 90 };
  return {
    west: wrapLongitude(camera.longitude - longitudeSpan),
    south: Math.max(-90, camera.latitude - latitudeSpan),
    east: wrapLongitude(camera.longitude + longitudeSpan),
    north: Math.min(90, camera.latitude + latitudeSpan),
  };
}
