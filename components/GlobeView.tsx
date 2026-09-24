"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJsonDataSource, ScreenSpaceEventHandler, Viewer } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { withBase } from "@/lib/base-path";
import styles from "./GlobeView.module.css";

export type JurisdictionMarker = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  count: number;
  selected?: boolean;
};

export type PublishedVenueMarker = {
  id: string;
  cycleId: string;
  label: string;
  latitude: number;
  longitude: number;
};

export type GlobeCamera = {
  latitude: number;
  longitude: number;
  height: number;
};

export type GlobeBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type GlobeViewProps = {
  markers: JurisdictionMarker[];
  venueMarkers?: PublishedVenueMarker[];
  onSelect: (id: string) => void;
  onVenueSelect?: (cycleId: string) => void;
  onBoundsChange?: (bounds: GlobeBounds) => void;
  onCameraChange?: (camera: GlobeCamera) => void;
  initialCamera?: GlobeCamera | null;
  focus?: { latitude: number; longitude: number } | null;
  selectedJurisdictionId?: string | null;
  resetViewToken?: number;
  /** Country whose states/provinces are drawn on close zoom. */
  regionCountryId?: string | null;
  selectedRegionId?: string | null;
  onRegionSelect?: (regionId: string) => void;
  className?: string;
};

const GEOGRAPHY_URL = withBase("/geo/world.geojson");
const REGION_COUNTRIES = new Set(["IN", "US", "GB", "BR", "FR", "JP"]);
const regionUrl = (country: string) => withBase(`/geo/regions/${country}.geojson`);
const DEFAULT_CAMERA: GlobeCamera = { latitude: 18, longitude: 10, height: 12_000_000 };
const FOCUS_HEIGHT = 3_000_000;
const DETAIL_HEIGHT = 4_500_000;
const EMPTY_VENUES: PublishedVenueMarker[] = [];
const LABEL_FONT = '"Public Sans", "Segoe UI", system-ui, sans-serif';
type C = typeof import("cesium");
const LAND = (Cesium: C) => Cesium.Color.fromBytes(247, 243, 234, 255);
const LAND_SELECTED = (Cesium: C) => Cesium.Color.fromBytes(214, 234, 230, 255);
const BORDER = (Cesium: C) => Cesium.Color.fromBytes(160, 150, 130, 220);
const ACCENT = (Cesium: C) => Cesium.Color.fromBytes(15, 92, 99);
const REGION_BORDER = (Cesium: C) => Cesium.Color.fromBytes(170, 160, 140, 255);
const REGION_FILL_HEIGHT = 800;
const REGION_LINE_HEIGHT = 1500;
/** Markers sit above state fills so they are never hidden by them. */
const MARKER_HEIGHT = 4000;
type CesiumModule = typeof import("cesium");
type CesiumWindow = Window & { CESIUM_BASE_URL?: string; Cesium?: CesiumModule };
let cesiumScriptPromise: Promise<CesiumModule> | null = null;
const VENUE_PIN = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 1C6.8 1 1 6.8 1 14c0 9 13 21 13 21s13-12 13-21C27 6.8 21.2 1 14 1Z" fill="#c2562b" stroke="#ffffff" stroke-width="2"/><circle cx="14" cy="14" r="4.5" fill="#ffffff"/></svg>',
)}`;

function loadLocalCesium(): Promise<CesiumModule> {
  const cesiumWindow = window as CesiumWindow;
  if (cesiumWindow.Cesium) return Promise.resolve(cesiumWindow.Cesium);
  if (cesiumScriptPromise) return cesiumScriptPromise;

  cesiumWindow.CESIUM_BASE_URL = withBase("/cesium/");
  cesiumScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = withBase("/cesium/Cesium.js");
    script.async = true;
    script.onload = () => {
      if (cesiumWindow.Cesium) {
        resolve(cesiumWindow.Cesium);
      } else {
        cesiumScriptPromise = null;
        script.remove();
        reject(new Error("Local Cesium browser bundle did not initialize."));
      }
    };
    script.onerror = () => {
      cesiumScriptPromise = null;
      script.remove();
      reject(new Error("Local Cesium browser bundle could not load."));
    };
    document.head.appendChild(script);
  });
  return cesiumScriptPromise;
}

function validPosition(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function usableCamera(camera: GlobeCamera | null | undefined): camera is GlobeCamera {
  return !!camera && validPosition(camera.latitude, camera.longitude) &&
    Number.isFinite(camera.height) && camera.height > 0;
}

function focusKey(focus: GlobeViewProps["focus"]) {
  return focus ? `${focus.latitude},${focus.longitude}` : null;
}

function rounded(value: number, places = 4) {
  return Number(value.toFixed(places));
}

function moveCamera(viewer: Viewer, Cesium: typeof import("cesium"), target: GlobeCamera) {
  const destination = Cesium.Cartesian3.fromDegrees(target.longitude, target.latitude, target.height);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    viewer.camera.cancelFlight();
    viewer.camera.setView({ destination });
  } else {
    viewer.camera.flyTo({ destination, duration: 1.1 });
  }
}

function anchorJurisdictionLabels(viewer: Viewer, Cesium: typeof import("cesium")) {
  const width = viewer.canvas.clientWidth;
  if (!width) return;
  const cameraDistance = Cesium.Cartesian3.magnitude(viewer.camera.positionWC);
  const horizonDot = viewer.scene.globe.ellipsoid.maximumRadius / cameraDistance;
  const cameraDirection = Cesium.Cartesian3.normalize(viewer.camera.positionWC, new Cesium.Cartesian3());
  for (const entity of viewer.entities.values) {
    if (!entity.id.startsWith("gov-jurisdiction:") || !entity.label) continue;
    const position = entity.position?.getValue(viewer.clock.currentTime);
    if (!position) continue;
    const screen = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, position);
    const markerDirection = Cesium.Cartesian3.normalize(position, new Cesium.Cartesian3());
    const nearSide = Cesium.Cartesian3.dot(cameraDirection, markerDirection) > horizonDot + 0.005;
    const onCanvas = !!screen && screen.x >= 0 && screen.x <= width && screen.y >= 0 && screen.y <= viewer.canvas.clientHeight;
    entity.label.show = new Cesium.ConstantProperty(nearSide && onCanvas);
    if (!screen) continue;
    const ratio = screen.x / width;
    const side = ratio < 0.36 ? -1 : ratio > 0.64 ? 1 : 0;
    entity.label.horizontalOrigin = new Cesium.ConstantProperty(
      side < 0 ? Cesium.HorizontalOrigin.LEFT : side > 0 ? Cesium.HorizontalOrigin.RIGHT : Cesium.HorizontalOrigin.CENTER,
    );
    entity.label.pixelOffset = new Cesium.ConstantProperty(new Cesium.Cartesian2(side < 0 ? 12 : side > 0 ? -12 : 0, -14));
  }
  viewer.scene.requestRender();
}

export default function GlobeView({
  markers,
  venueMarkers = EMPTY_VENUES,
  onSelect,
  onVenueSelect,
  onBoundsChange,
  onCameraChange,
  initialCamera,
  focus,
  selectedJurisdictionId,
  resetViewToken,
  regionCountryId,
  selectedRegionId,
  onRegionSelect,
  className,
}: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const creditRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const cesiumRef = useRef<typeof import("cesium") | null>(null);
  const geographyRef = useRef<GeoJsonDataSource | null>(null);
  const regionsRef = useRef<GeoJsonDataSource | null>(null);
  const onRegionSelectRef = useRef(onRegionSelect);
  const hoverRef = useRef<HTMLDivElement>(null);
  const venueCycleByEntityIdRef = useRef(new Map<string, string>());
  const initialCameraRef = useRef(initialCamera);
  const initialFocusRef = useRef(focus);
  const lastFocusRef = useRef(focusKey(focus));
  const lastResetViewTokenRef = useRef(resetViewToken);
  const onSelectRef = useRef(onSelect);
  const onVenueSelectRef = useRef(onVenueSelect);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onCameraChangeRef = useRef(onCameraChange);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [zoomedIn, setZoomedIn] = useState(false);
  const [regionsUnavailable, setRegionsUnavailable] = useState(false);
  const [regionsLoaded, setRegionsLoaded] = useState<string | null>(null);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onVenueSelectRef.current = onVenueSelect; }, [onVenueSelect]);
  useEffect(() => { onBoundsChangeRef.current = onBoundsChange; }, [onBoundsChange]);
  useEffect(() => { onCameraChangeRef.current = onCameraChange; }, [onCameraChange]);
  useEffect(() => { onRegionSelectRef.current = onRegionSelect; }, [onRegionSelect]);

  useEffect(() => {
    const container = containerRef.current;
    const creditContainer = creditRef.current;
    if (!container || !creditContainer) return;

    let disposed = false;
    let viewer: Viewer | null = null;
    let inputHandler: ScreenSpaceEventHandler | null = null;
    let removeCameraListener: (() => void) | null = null;
    let removeRenderErrorListener: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const abortController = new AbortController();

    async function start() {
      try {
        // Use Cesium's prebuilt browser bundle so its embedded WASM stays intact.
        const Cesium = await loadLocalCesium();
        if (disposed) return;
        cesiumRef.current = Cesium;

        viewer = new Cesium.Viewer(container!, {
          animation: false,
          baseLayer: false,
          baseLayerPicker: false,
          creditContainer: creditContainer!,
          fullscreenButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          navigationHelpButton: false,
          scene3DOnly: true,
          sceneModePicker: false,
          selectionIndicator: false,
          shouldAnimate: false,
          skyAtmosphere: false,
          skyBox: false,
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          timeline: false,
          useBrowserRecommendedResolution: true,
          requestRenderMode: true,
          maximumRenderTimeChange: Infinity,
        });
        viewerRef.current = viewer;
        if (process.env.NODE_ENV !== "production") (window as Window & { __govViewer?: Viewer }).__govViewer = viewer;
        viewer.scene.backgroundColor = Cesium.Color.fromBytes(223, 232, 234);
        viewer.scene.globe.baseColor = Cesium.Color.fromBytes(196, 216, 223);
        viewer.scene.globe.showGroundAtmosphere = false;
        viewer.scene.globe.enableLighting = false;
        viewer.scene.screenSpaceCameraController.minimumZoomDistance = 150_000;
        viewer.scene.screenSpaceCameraController.maximumZoomDistance = 45_000_000;

        const openingCamera = usableCamera(initialCameraRef.current)
          ? initialCameraRef.current
          : initialFocusRef.current && validPosition(initialFocusRef.current.latitude, initialFocusRef.current.longitude)
            ? { ...initialFocusRef.current, height: FOCUS_HEIGHT }
            : DEFAULT_CAMERA;
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(
            openingCamera.longitude,
            openingCamera.latitude,
            openingCamera.height,
          ),
        });

        function reportCamera() {
          if (!viewer || disposed) return;
          const position = viewer.camera.positionCartographic;
          if (position && Number.isFinite(position.height)) {
            const detailVisible = position.height <= DETAIL_HEIGHT;
            setZoomedIn(detailVisible);
            if (regionsRef.current) regionsRef.current.show = detailVisible;
            onCameraChangeRef.current?.({
              latitude: rounded(Cesium.Math.toDegrees(position.latitude)),
              longitude: rounded(Cesium.Math.toDegrees(position.longitude)),
              height: Math.round(position.height),
            });
          }
          const rectangle = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
          if (rectangle) {
            onBoundsChangeRef.current?.({
              west: rounded(Cesium.Math.toDegrees(rectangle.west)),
              south: rounded(Cesium.Math.toDegrees(rectangle.south)),
              east: rounded(Cesium.Math.toDegrees(rectangle.east)),
              north: rounded(Cesium.Math.toDegrees(rectangle.north)),
            });
          } else {
            onBoundsChangeRef.current?.({ west: -180, south: -90, east: 180, north: 90 });
          }
          anchorJurisdictionLabels(viewer, Cesium);
        }

        const removeMoveEnd = viewer.camera.moveEnd.addEventListener(reportCamera);
        // Re-anchor labels while the globe turns so far-side labels never show through it.
        viewer.camera.percentageChanged = 0.01;
        const removeChanged = viewer.camera.changed.addEventListener(() => {
          if (viewer && !disposed) anchorJurisdictionLabels(viewer, Cesium);
        });
        removeCameraListener = () => { removeMoveEnd(); removeChanged(); };
        const removeRenderError = viewer.scene.renderError.addEventListener(() => {
          if (!disposed && viewer) {
            viewer.useDefaultRenderLoop = false;
            setState("failed");
          }
        });
        removeRenderErrorListener = removeRenderError;

        inputHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
        inputHandler.setInputAction((event: { position: import("cesium").Cartesian2 }) => {
          if (!viewer) return;
          const picked = viewer.scene.pick(event.position) as { id?: { id?: string } } | undefined;
          const entityId = picked?.id?.id;
          const venueCycleId = entityId ? venueCycleByEntityIdRef.current.get(entityId) : undefined;
          if (venueCycleId) {
            onVenueSelectRef.current?.(venueCycleId);
            return;
          }
          if (entityId?.startsWith("gov-jurisdiction:")) {
            onSelectRef.current(entityId.slice("gov-jurisdiction:".length));
            return;
          }
          const regionId = (picked?.id as { properties?: { regionId?: { getValue: () => unknown } } } | undefined)?.properties?.regionId?.getValue();
          if (typeof regionId === "string") onRegionSelectRef.current?.(regionId);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Hover names for states, markers and venues. Updates the DOM directly to avoid re-rendering on every mouse move.
        let hoverFrame = 0;
        inputHandler.setInputAction((event: { endPosition: import("cesium").Cartesian2 }) => {
          if (hoverFrame) return;
          hoverFrame = requestAnimationFrame(() => {
            hoverFrame = 0;
            const tooltip = hoverRef.current;
            if (!viewer || !tooltip) return;
            const picked = viewer.scene.pick(event.endPosition) as { id?: { id?: string; name?: string; properties?: { name?: { getValue: () => unknown } } } } | undefined;
            const entity = picked?.id;
            const text = entity?.id?.startsWith("gov-") ? entity.name : entity?.properties?.name?.getValue();
            if (typeof text === "string" && text) {
              tooltip.textContent = text;
              tooltip.style.transform = `translate(${Math.round(event.endPosition.x + 14)}px, ${Math.round(event.endPosition.y + 14)}px)`;
              tooltip.hidden = false;
              viewer.canvas.style.cursor = "pointer";
            } else {
              tooltip.hidden = true;
              viewer.canvas.style.cursor = "";
            }
          });
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => {
            if (viewer && !viewer.isDestroyed()) {
              viewer.resize();
              viewer.scene.requestRender();
            }
          });
          resizeObserver.observe(container!);
        }

        const response = await fetch(GEOGRAPHY_URL, { signal: abortController.signal });
        if (!response.ok) throw new Error(`Boundary request failed: ${response.status}`);
        const geoJson = await response.json();
        if (disposed) return;
        const geography = await Cesium.GeoJsonDataSource.load(geoJson, {
          clampToGround: false,
          fill: LAND(Cesium),
          stroke: BORDER(Cesium),
          strokeWidth: 1,
          credit: "Boundaries: Natural Earth",
        });
        if (disposed) return;
        geographyRef.current = geography;
        await viewer.dataSources.add(geography);
        if (disposed) return;


        viewer.scene.requestRender();
        reportCamera();
        setState("ready");
      } catch (error) {
        if (!disposed && !(error instanceof DOMException && error.name === "AbortError")) {
          console.error("GOV View globe could not start", error);
          setState("failed");
        }
      }
    }

    void start();

    return () => {
      disposed = true;
      abortController.abort();
      resizeObserver?.disconnect();
      removeCameraListener?.();
      removeRenderErrorListener?.();
      inputHandler?.destroy();
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
      cesiumRef.current = null;
      geographyRef.current = null;
      regionsRef.current = null;
      venueCycleByEntityIdRef.current.clear();
    };
  }, []);

  // Load state/province polygons for the focused country only.
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || state !== "ready") return;
    const country = regionCountryId && REGION_COUNTRIES.has(regionCountryId) ? regionCountryId : null;
    if (regionsRef.current && regionsLoaded === country) return;
    let cancelled = false;
    const controller = new AbortController();
    const previous = regionsRef.current;
    if (previous) {
      viewer.dataSources.remove(previous, true);
      regionsRef.current = null;
      setRegionsLoaded(null);
    }
    if (!country) {
      viewer.scene.requestRender();
      return;
    }
    (async () => {
      try {
        const response = await fetch(regionUrl(country), { signal: controller.signal });
        if (!response.ok) throw new Error(`Region request failed: ${response.status}`);
        const geoJson = await response.json();
        const regions = await Cesium.GeoJsonDataSource.load(geoJson, {
          clampToGround: false,
          fill: LAND(Cesium),
          stroke: REGION_BORDER(Cesium),
          strokeWidth: 1,
          credit: "States and provinces: Natural Earth",
        });
        if (cancelled || viewer.isDestroyed()) return;
        // Lift fills slightly above the country layer so the two never flicker, and draw
        // borders as separate lines above the fills (polygon outlines z-fight and look dashed).
        for (const entity of [...regions.entities.values]) {
          if (!entity.polygon) continue;
          entity.polygon.height = new Cesium.ConstantProperty(REGION_FILL_HEIGHT);
          entity.polygon.outline = new Cesium.ConstantProperty(false);
        }
        type Ring = [number, number][];
        const features = (geoJson as { features: { geometry: { type: string; coordinates: Ring[] | Ring[][] } }[] }).features;
        for (const feature of features) {
          const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates as Ring[]] : feature.geometry.coordinates as Ring[][];
          for (const polygon of polygons) {
            for (const ring of polygon) {
              regions.entities.add({
                polyline: {
                  positions: Cesium.Cartesian3.fromDegreesArrayHeights(ring.flatMap(([lon, lat]) => [lon, lat, REGION_LINE_HEIGHT])),
                  width: 1,
                  material: REGION_BORDER(Cesium),
                  arcType: Cesium.ArcType.RHUMB,
                },
              });
            }
          }
        }
        regions.show = zoomedIn;
        await viewer.dataSources.add(regions);
        if (cancelled) {
          viewer.dataSources.remove(regions, true);
          return;
        }
        regionsRef.current = regions;
        setRegionsUnavailable(false);
        setRegionsLoaded(country);
        viewer.scene.requestRender();
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("GOV View state boundaries unavailable", error);
          setRegionsUnavailable(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // zoomedIn is read once for the initial visibility; later changes are handled in reportCamera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionCountryId, state]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    const regions = regionsRef.current;
    if (!viewer || !Cesium || !regions) return;
    const now = Cesium.JulianDate.now();
    for (const entity of regions.entities.values) {
      if (!entity.polygon) continue;
      const selected = entity.properties?.regionId?.getValue(now) === selectedRegionId;
      entity.polygon.material = new Cesium.ColorMaterialProperty(selected ? LAND_SELECTED(Cesium) : LAND(Cesium));
    }
    viewer.scene.requestRender();
  }, [selectedRegionId, regionsLoaded]);

  const selectedMapJurisdiction = selectedJurisdictionId === undefined
    ? markers.find((marker) => marker.selected)?.id ?? null
    : selectedJurisdictionId;

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    const geography = geographyRef.current;
    if (!viewer || !Cesium || !geography || state !== "ready") return;
    const now = Cesium.JulianDate.now();
    const selectedId = selectedMapJurisdiction?.toUpperCase() ?? null;
    for (const entity of geography.entities.values) {
      if (!entity.polygon) continue;
      const jurisdictionId = entity.properties?.jurisdictionId?.getValue(now) as string | null | undefined;
      const selected = !!selectedId && jurisdictionId === selectedId;
      entity.polygon.material = new Cesium.ColorMaterialProperty(selected ? LAND_SELECTED(Cesium) : LAND(Cesium));
      entity.polygon.outlineColor = new Cesium.ConstantProperty(selected ? ACCENT(Cesium) : BORDER(Cesium));
    }
    viewer.scene.requestRender();
  }, [selectedMapJurisdiction, state]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || state !== "ready") return;
    viewer.entities.removeAll();
    const venueCycles = new Map<string, string>();
    for (const marker of markers) {
      if (!validPosition(marker.latitude, marker.longitude)) continue;
      const selected = !!marker.selected;
      const color = selected ? Cesium.Color.fromBytes(10, 71, 77) : ACCENT(Cesium);
      viewer.entities.add({
        id: `gov-jurisdiction:${marker.id}`,
        name: `${marker.label}: ${marker.count} application cycles`,
        position: Cesium.Cartesian3.fromDegrees(marker.longitude, marker.latitude, MARKER_HEIGHT),
        point: {
          pixelSize: selected ? 15 : 11,
          color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: 3_000_000,
        },
        label: {
          text: `${marker.label}  ${marker.count}`,
          font: `600 13px ${LABEL_FONT}`,
          fillColor: Cesium.Color.fromBytes(27, 31, 35),
          showBackground: true,
          backgroundColor: Cesium.Color.fromBytes(255, 255, 255, 235),
          backgroundPadding: new Cesium.Cartesian2(7, 5),
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    }
    if (zoomedIn) {
      for (const venue of venueMarkers) {
        if (!validPosition(venue.latitude, venue.longitude)) continue;
        const entityId = `gov-venue:${venue.id}`;
        if (venueCycles.has(entityId)) continue;
        venueCycles.set(entityId, venue.cycleId);
        viewer.entities.add({
          id: entityId,
          name: `Published venue: ${venue.label}`,
          position: Cesium.Cartesian3.fromDegrees(venue.longitude, venue.latitude, MARKER_HEIGHT),
          billboard: {
            image: VENUE_PIN,
            width: 25,
            height: 32,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            // Venue pins only show on close zoom; keep them above state fills there.
            disableDepthTestDistance: 3_000_000,
          },
          label: {
            text: venue.label,
            font: `500 12px ${LABEL_FONT}`,
            fillColor: Cesium.Color.fromBytes(27, 31, 35),
            showBackground: true,
            backgroundColor: Cesium.Color.fromBytes(255, 255, 255, 235),
            backgroundPadding: new Cesium.Cartesian2(6, 4),
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -36),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1_700_000),
          },
        });
      }
    }
    venueCycleByEntityIdRef.current = venueCycles;
    anchorJurisdictionLabels(viewer, Cesium);
    viewer.scene.requestRender();
  }, [markers, venueMarkers, zoomedIn, state]);

  useEffect(() => {
    if (resetViewToken !== lastResetViewTokenRef.current) return;
    const key = focusKey(focus);
    if (key === lastFocusRef.current) return;
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || state !== "ready") return;
    if (focus && !validPosition(focus.latitude, focus.longitude)) return;
    lastFocusRef.current = key;
    const target = focus ? { ...focus, height: FOCUS_HEIGHT } : DEFAULT_CAMERA;
    moveCamera(viewer, Cesium, target);
  }, [focus, resetViewToken, state]);

  useEffect(() => {
    if (resetViewToken === lastResetViewTokenRef.current) return;
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || state !== "ready") return;
    lastResetViewTokenRef.current = resetViewToken;
    lastFocusRef.current = focusKey(focus);
    moveCamera(viewer, Cesium, DEFAULT_CAMERA);
  }, [focus, resetViewToken, state]);

  const wrapperClassName = [styles.shell, className].filter(Boolean).join(" ");

  return (
    <section className={wrapperClassName} aria-label="Jurisdiction globe">
      <div ref={containerRef} className={styles.viewport} aria-hidden="true" />
      {state === "loading" && <div className={styles.notice} role="status">Loading map…</div>}
      {state === "failed" && (
        <div className={styles.fallback} role="status">
          <strong>The map couldn't start on this device.</strong>
          <span>Everything else still works. Pick a country:</span>
          {markers.length > 0 && (
            <ul>
              {markers.map((marker) => (
                <li key={marker.id}>
                  <button type="button" onClick={() => onSelect(marker.id)}>
                    {marker.label}<span>{marker.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {venueMarkers.length > 0 && (
            <>
              <p className={styles.menuSectionTitle}>Exam venues</p>
              <ul>
                {venueMarkers.map((venue) => (
                  <li key={venue.id}>
                    <button className={styles.venueButton} type="button" onClick={() => onVenueSelect?.(venue.cycleId)} disabled={!onVenueSelect}>
                      <span>{venue.label}</span><span>Venue</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {state === "ready" && regionsUnavailable && zoomedIn && (
        <div className={styles.layerWarning} role="status">State boundaries could not load</div>
      )}
      <div ref={hoverRef} className={styles.hover} hidden aria-hidden="true" />
      {state === "ready" && markers.length === 0 && venueMarkers.length === 0 && (
        <div className={styles.notice} role="status">Nothing to show on the map for these filters.</div>
      )}
      {state === "ready" && (markers.length > 0 || (zoomedIn && venueMarkers.length > 0)) && (
        <details className={styles.markerMenu}>
          <summary>List of places on the map ({markers.length + (zoomedIn ? venueMarkers.length : 0)})</summary>
          {markers.length > 0 && (
            <ul>
              {markers.map((marker) => (
                <li key={marker.id}>
                  <button type="button" onClick={() => onSelect(marker.id)} aria-current={marker.selected ? "true" : undefined}>
                    <span>{marker.label}</span><span>{marker.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {zoomedIn && venueMarkers.length > 0 && (
            <>
              <p className={styles.menuSectionTitle}>Exam venues</p>
              <ul>
                {venueMarkers.map((venue) => (
                  <li key={venue.id}>
                    <button className={styles.venueButton} type="button" onClick={() => onVenueSelect?.(venue.cycleId)} disabled={!onVenueSelect}>
                      <span>{venue.label}</span><span>Venue</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </details>
      )}
      <div ref={creditRef} className={styles.credits} />
    </section>
  );
}
