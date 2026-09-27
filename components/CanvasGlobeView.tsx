"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import type { GlobeCamera, GlobeViewProps } from "./GlobeView";
import { withBase } from "@/lib/base-path";
import { globeBounds, globeScale, projectGlobe, unprojectGlobe, wrapLongitude } from "@/lib/orthographic";
import styles from "./CanvasGlobeView.module.css";

type Point = [number, number];
type Geometry = { type: "Polygon" | "MultiPolygon"; coordinates: Point[][] | Point[][][] };
type Feature = { properties: { jurisdictionId?: string; regionId?: string; name?: string }; geometry: Geometry };
type Geography = { type: "FeatureCollection"; features: Feature[] };
type Size = { width: number; height: number };
const DEFAULT_CAMERA: GlobeCamera = { latitude: 18, longitude: 10, height: 12_000_000 };
const REGION_COUNTRIES = new Set(["IN", "US", "GB", "BR", "FR", "JP"]);
const EMPTY_VENUES: NonNullable<GlobeViewProps["venueMarkers"]> = [];
const clampHeight = (height: number) => Math.max(180_000, Math.min(45_000_000, height));
const radiusFor = ({ width, height }: Size) => Math.max(0, Math.min(width, height) * 0.43);
const polygonsOf = (geometry: Geometry): Point[][][] => geometry.type === "Polygon"
  ? [geometry.coordinates as Point[][]] : geometry.coordinates as Point[][][];

/** Geographic hit testing uses original polygons, never screen-centre guesses. */
function ringContains(ring: Point[], longitude: number, latitude: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    const ax = longitude + wrapLongitude(a[0] - longitude);
    const bx = longitude + wrapLongitude(b[0] - longitude);
    if ((a[1] > latitude) !== (b[1] > latitude) && longitude < (bx - ax) * (latitude - a[1]) / (b[1] - a[1]) + ax) inside = !inside;
  }
  return inside;
}

function featureContains(feature: Feature, longitude: number, latitude: number): boolean {
  return polygonsOf(feature.geometry).some((polygon) =>
    !!polygon[0] && ringContains(polygon[0], longitude, latitude) &&
    !polygon.slice(1).some((hole) => ringContains(hole, longitude, latitude)));
}

function drawGraticule(ctx: CanvasRenderingContext2D, camera: GlobeCamera, cx: number, cy: number, radius: number) {
  ctx.strokeStyle = "rgba(141, 190, 202, .27)";
  ctx.lineWidth = 0.8;
  const drawLine = (points: Point[]) => {
    ctx.beginPath();
    let active = false;
    for (const [longitude, latitude] of points) {
      const point = projectGlobe(latitude, longitude, camera);
      if (!point.visible) { active = false; continue; }
      const x = cx + point.x * radius;
      const y = cy - point.y * radius;
      if (active) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      active = true;
    }
    ctx.stroke();
  };
  for (let latitude = -60; latitude <= 60; latitude += 30) {
    drawLine(Array.from({ length: 181 }, (_, index) => [-180 + index * 2, latitude]));
  }
  for (let longitude = -180; longitude < 180; longitude += 30) {
    drawLine(Array.from({ length: 91 }, (_, index) => [longitude, -90 + index * 2]));
  }
}

function drawFeatures(ctx: CanvasRenderingContext2D, features: Feature[], camera: GlobeCamera, cx: number, cy: number, radius: number, selectedId: string | null, region = false) {
  for (const feature of features) {
    const id = feature.properties.regionId ?? feature.properties.jurisdictionId;
    const selected = id === selectedId;
    ctx.fillStyle = selected ? "#42d1d5" : region ? "rgba(150, 202, 203, .28)" : "#7195a0";
    ctx.strokeStyle = selected ? "#e8ffff" : region ? "rgba(189, 230, 226, .65)" : "rgba(197, 222, 225, .72)";
    ctx.lineWidth = selected ? 1.7 : region ? 0.65 : 0.8;
    for (const polygon of polygonsOf(feature.geometry)) {
      for (const [ringIndex, ring] of polygon.entries()) {
        let allVisible = true;
        const projected: { x: number; y: number; visible: boolean }[] = [];
        for (const [longitude, latitude] of ring) {
          const point = projectGlobe(latitude, longitude, camera);
          if (!point.visible) allVisible = false;
          projected.push({ x: cx + point.x * radius, y: cy - point.y * radius, visible: point.visible });
        }
        if (allVisible && projected.length >= 3) {
          ctx.beginPath();
          projected.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
          ctx.closePath();
          if (ringIndex === 0) ctx.fill();
        }
        ctx.beginPath();
        let active = false;
        for (const point of projected) {
          if (!point.visible) { active = false; continue; }
          if (active) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y);
          active = true;
        }
        ctx.stroke();
      }
    }
  }
}

export default function CanvasGlobeView({
  markers, venueMarkers = EMPTY_VENUES, onSelect, onVenueSelect, onBoundsChange, onCameraChange,
  initialCamera, focus, selectedJurisdictionId, resetViewToken, regionCountryId, selectedRegionId,
  onRegionSelect, className,
}: GlobeViewProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number; camera: GlobeCamera; moved: boolean } | null>(null);
  const callbacksRef = useRef({ onSelect, onVenueSelect, onBoundsChange, onCameraChange, onRegionSelect });
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [camera, setCamera] = useState<GlobeCamera>(() => initialCamera ?? DEFAULT_CAMERA);
  const [world, setWorld] = useState<Feature[]>([]);
  const [regions, setRegions] = useState<Feature[]>([]);
  const [error, setError] = useState("");
  callbacksRef.current = { onSelect, onVenueSelect, onBoundsChange, onCameraChange, onRegionSelect };

  useEffect(() => {
    if (!shellRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setSize((current) => current.width === width && current.height === height ? current : { width, height });
    });
    observer.observe(shellRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(withBase("/geo/world.geojson"), { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error(`Boundary request failed: ${response.status}`);
      return response.json() as Promise<Geography>;
    }).then((data) => setWorld(data.features)).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setRegions([]);
    if (!regionCountryId || !REGION_COUNTRIES.has(regionCountryId)) return;
    const controller = new AbortController();
    fetch(withBase(`/geo/regions/${regionCountryId}.geojson`), { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error(`Region request failed: ${response.status}`);
      return response.json() as Promise<Geography>;
    }).then((data) => setRegions(data.features)).catch(() => { /* Country globe remains usable. */ });
    return () => controller.abort();
  }, [regionCountryId]);

  useEffect(() => {
    if (focus && Number.isFinite(focus.latitude) && Number.isFinite(focus.longitude)) {
      setCamera({ latitude: focus.latitude, longitude: focus.longitude, height: 3_000_000 });
    }
  }, [focus?.latitude, focus?.longitude]);
  useEffect(() => { if (resetViewToken) setCamera(DEFAULT_CAMERA); }, [resetViewToken]);

  const radius = radiusFor(size);
  const scaledRadius = radius * globeScale(camera.height);
  useEffect(() => {
    if (!size.width || !size.height) return;
    callbacksRef.current.onCameraChange?.({
      latitude: Number(camera.latitude.toFixed(4)), longitude: Number(camera.longitude.toFixed(4)), height: Math.round(camera.height),
    });
    callbacksRef.current.onBoundsChange?.(globeBounds(camera, size.width, size.height, radius));
  }, [camera, size, radius]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.width || !size.height) return;
    const frame = requestAnimationFrame(() => {
      const ctx = canvas.getContext("2d");
      if (!ctx) { setError("Canvas drawing is unavailable."); return; }
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(size.width * pixelRatio);
      canvas.height = Math.round(size.height * pixelRatio);
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.clearRect(0, 0, size.width, size.height);
      const cx = size.width / 2;
      const cy = size.height / 2;
      const fill = ctx.createRadialGradient(cx - scaledRadius * .27, cy - scaledRadius * .3, scaledRadius * .08, cx, cy, scaledRadius);
      fill.addColorStop(0, "#254c5e");
      fill.addColorStop(.7, "#15374b");
      fill.addColorStop(1, "#071c2c");
      ctx.shadowColor = "rgba(22, 95, 113, .35)";
      ctx.shadowBlur = 30;
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.arc(cx, cy, scaledRadius, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, scaledRadius, 0, Math.PI * 2); ctx.clip();
      drawGraticule(ctx, camera, cx, cy, scaledRadius);
      drawFeatures(ctx, world, camera, cx, cy, scaledRadius, selectedJurisdictionId ?? null);
      if (camera.height <= 4_500_000) drawFeatures(ctx, regions, camera, cx, cy, scaledRadius, selectedRegionId ?? null, true);
      ctx.restore();
      ctx.strokeStyle = "rgba(125, 191, 209, .75)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, scaledRadius, 0, Math.PI * 2); ctx.stroke();
    });
    return () => cancelAnimationFrame(frame);
  }, [camera, size, scaledRadius, world, regions, selectedJurisdictionId, selectedRegionId]);

  const locate = (latitude: number, longitude: number) => {
    const point = projectGlobe(latitude, longitude, camera);
    const x = size.width / 2 + point.x * scaledRadius;
    const y = size.height / 2 - point.y * scaledRadius;
    return { x, y, visible: point.visible && x >= 0 && x <= size.width && y >= 0 && y <= size.height };
  };
  const visibleMarkers = useMemo(() => markers.map((marker) => ({ marker, point: locate(marker.latitude, marker.longitude) }))
    .filter((entry) => entry.point.visible), [markers, camera, size, scaledRadius]);
  const visibleVenues = useMemo(() => venueMarkers.map((marker) => ({ marker, point: locate(marker.latitude, marker.longitude) }))
    .filter((entry) => entry.point.visible), [venueMarkers, camera, size, scaledRadius]);

  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, camera, moved: false };
  }
  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    const degreesPerPixel = 0.3 / globeScale(drag.camera.height);
    setCamera({ ...drag.camera, longitude: wrapLongitude(drag.camera.longitude - dx * degreesPerPixel),
      latitude: Math.max(-85, Math.min(85, drag.camera.latitude + dy * degreesPerPixel)) });
  }
  function pointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.moved) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = unprojectGlobe((event.clientX - rect.left - size.width / 2) / scaledRadius,
      (size.height / 2 - (event.clientY - rect.top)) / scaledRadius, camera);
    if (!point) return;
    if (camera.height <= 4_500_000) {
      const region = regions.find((feature) => featureContains(feature, point.longitude, point.latitude));
      if (region?.properties.regionId) { callbacksRef.current.onRegionSelect?.(region.properties.regionId); return; }
    }
    const country = world.find((feature) => featureContains(feature, point.longitude, point.latitude));
    if (country?.properties.jurisdictionId) callbacksRef.current.onSelect(country.properties.jurisdictionId);
  }
  function wheel(event: WheelEvent<HTMLCanvasElement>) {
    event.preventDefault();
    setCamera((current) => ({ ...current, height: clampHeight(current.height * Math.exp(event.deltaY * .001)) }));
  }
  function zoom(factor: number) { setCamera((current) => ({ ...current, height: clampHeight(current.height * factor) })); }

  return <div ref={shellRef} className={`${styles.shell} ${className ?? ""}`}>
    <canvas ref={canvasRef} className={styles.canvas} aria-label="Interactive globe; drag to rotate, scroll or use zoom buttons" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onWheel={wheel} />
    {!world.length && !error && <p className={styles.message} role="status">Loading geographic boundaries…</p>}
    {error && <div className={styles.message} role="status"><strong>Map unavailable.</strong><p>Use country search or the list of opportunities.</p></div>}
    {visibleMarkers.map(({ marker, point }) => <button key={marker.id} type="button" className={styles.marker}
      style={{ left: point.x, top: point.y }} onClick={() => onSelect(marker.id)} aria-label={`${marker.label}: ${marker.count} opportunities`} aria-current={marker.selected ? "true" : undefined} title={`${marker.label} · ${marker.count}`}>
      <span>{marker.count}</span><span className={styles.markerLabel}>{marker.label}</span>
    </button>)}
    {visibleVenues.map(({ marker, point }) => <button key={marker.id} type="button" className={styles.venue}
      style={{ left: point.x, top: point.y }} onClick={() => onVenueSelect?.(marker.cycleId)} aria-label={`Published venue: ${marker.label}`} title={marker.label}>●</button>)}
    <div className={styles.controls} aria-label="Globe controls">
      <button type="button" onClick={() => zoom(.6)} aria-label="Zoom in">+</button>
      <button type="button" onClick={() => zoom(1.7)} aria-label="Zoom out">−</button>
    </div>
    <details className={styles.markerMenu}><summary>Places on globe</summary><ul>
      {markers.map((marker) => <li key={marker.id}><button type="button" onClick={() => onSelect(marker.id)}>{marker.label} <span>{marker.count}</span></button></li>)}
      {venueMarkers.map((marker) => <li key={marker.id}><button type="button" onClick={() => onVenueSelect?.(marker.cycleId)}>Venue: {marker.label}</button></li>)}
    </ul></details>
    <p className={styles.credit}>Boundaries: Natural Earth · geographic scope, not exam venue</p>
  </div>;
}
