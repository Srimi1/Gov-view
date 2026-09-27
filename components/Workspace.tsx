"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { ArrowLeft, Globe2, List, MapPin, Search, X } from "lucide-react";
import type { GlobeViewProps } from "@/components/GlobeView";
import JobArticle, { ResultIcon } from "@/components/JobArticle";
import ProfileDialog from "@/components/ProfileDialog";
import SiteHeader from "@/components/SiteHeader";
import { useProfile } from "@/components/useProfile";
import { withBase } from "@/lib/base-path";
import { evaluateEligibility, profileIsEmpty } from "@/lib/eligibility/evaluate";
import type { EligibilityResult } from "@/lib/eligibility/types";
import { appointmentTypeLabels, deadlineText, deadlineUrgent, pathwayDescriptions, pathwayLabels, shortResultLabels, statusLabels } from "@/lib/format";
import { jurisdictionIntersectsBounds, regionCenters } from "@/lib/geography";
import { AmbiguousCycleIdError, loadData, loadDetail, loadDetailById, refreshLoadedStatuses, unsubscribeData, type LoadedData } from "@/lib/data-client";
import {
  FIXTURE_NOTICE,
  countByJurisdiction,
  countCycles,
  filterOpportunities,
  jurisdictions,
  liveStatus,
  type CycleSummary,
  type AppointmentType,
  type OpportunityCycle,
  type OpportunityStatus,
  type Pathway,
} from "@/lib/opportunities";
import { subdivisionName, subdivisionsByCountry } from "@/lib/places";
import {
  decodePublicView,
  encodePublicView,
  type PublicViewBounds as Bounds,
  type PublicViewCamera as Camera,
  type PublicViewShortcut as Shortcut,
} from "@/lib/public-view";

function GlobeUnavailable({ markers, onSelect }: GlobeViewProps) {
  return (
    <div className="map-message" role="status">
      <strong>Interactive map unavailable under current security policy.</strong>
      <p>Country search and full opportunity list remain available. Pick a country:</p>
      <div className="map-message-actions">
        {markers.map((marker) => (
          <button key={marker.id} type="button" onClick={() => onSelect(marker.id)}>{marker.label} · {marker.count}</button>
        ))}
      </div>
    </div>
  );
}

const GlobeView = process.env.NODE_ENV === "production"
  ? dynamic<GlobeViewProps>(() => import("@/components/CanvasGlobeView").catch(() => ({ default: GlobeUnavailable })), {
      ssr: false,
      loading: () => <div className="map-message" role="status">Loading map…</div>,
    })
  : dynamic<GlobeViewProps>(() => import("@/components/GlobeView").catch(() => ({ default: GlobeUnavailable })), {
      ssr: false,
      loading: () => <div className="map-message" role="status">Loading map…</div>,
    });

const regionName = (code: string) => regionCenters[code]?.[2] ?? subdivisionName(code);
const pathwayOrder: Pathway[] = ["recruitment", "licensing", "admission", "vocational"];
const appointmentTypeOrder: AppointmentType[] = ["permanent", "contract", "temporary", "deputation", "apprenticeship"];
const statusOrder: Record<OpportunityStatus, number> = { open: 0, extended: 1, upcoming: 2, stale: 3, uncertain: 4, closed: 5, cancelled: 6 };
const shortcutLabels: Record<Exclude<Shortcut, "all">, string> = {
  open: "Open now",
  closing: "Closing this week",
  changed: "Recently updated",
};

const PAGE_SIZE = 50;
const MAX_VENUE_PINS = 400;
const NO_ITEMS: CycleSummary[] = [];

function sortCycles(items: CycleSummary[]): CycleSummary[] {
  return [...items].sort((a, b) =>
    statusOrder[a.status] - statusOrder[b.status] ||
    (a.applicationWindow.closesOn ?? "9999").localeCompare(b.applicationWindow.closesOn ?? "9999") ||
    a.title.localeCompare(b.title));
}

export default function Workspace() {
  const searchRef = useRef<HTMLInputElement>(null);
  const scopedLoadsStarted = useRef(new Set<string>());
  const { profile, update: saveProfile, clear: clearProfile } = useProfile();
  const hasProfile = !profileIsEmpty(profile);

  const [data, setData] = useState<LoadedData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loadingRemaining, setLoadingRemaining] = useState(false);
  const [detail, setDetail] = useState<OpportunityCycle | null>(null);
  const [detailError, setDetailError] = useState("");
  const [ambiguousIds, setAmbiguousIds] = useState<string[]>([]);
  const [detailRetry, setDetailRetry] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [activePathways, setActivePathways] = useState<Pathway[]>([]);
  const [appointmentType, setAppointmentType] = useState<AppointmentType | "">("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [focusedCode, setFocusedCode] = useState<string | null>(null);
  const [shortcut, setShortcut] = useState<Shortcut>("all");
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [deadlineFrom, setDeadlineFrom] = useState("");
  const [deadlineTo, setDeadlineTo] = useState("");
  const [moreFilters, setMoreFilters] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [readerOpen, setReaderOpen] = useState(false);
  const [compact, setCompact] = useState(true);
  const [searchArea, setSearchArea] = useState(false);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [initialCamera, setInitialCamera] = useState<Camera | null>(null);
  const [resetViewToken, setResetViewToken] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [bannerHidden, setBannerHidden] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;
    const onProgress = (loaded: LoadedData) => { if (active) { setData(loaded); setLoadError(""); } };
    loadData(onProgress, true).catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : String(error)); });
    return () => { active = false; unsubscribeData(onProgress); };
  }, []);
  const loadRecords = useCallback(async (scope?: string) => {
    setLoadingRemaining(true);
    setLoadError("");
    try {
      let loaded = await loadData(undefined, false, scope);
      // If initial four shards were already in flight, first await joined them.
      if (!(scope ? loaded.completeCountries.includes(scope) : loaded.complete) && !loaded.errors.length) loaded = await loadData(undefined, false, scope);
      setData(loaded);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingRemaining(false);
    }
  }, []);
  useEffect(() => {
    const refresh = () => {
      const next = refreshLoadedStatuses();
      if (next) setData(next);
      setDetail((current) => current ? { ...current, status: liveStatus(current) } : current);
    };
    const onFocus = () => { if (!document.hidden) refresh(); };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onFocus); window.removeEventListener("focus", refresh); };
  }, []);
  const opportunities = data?.items ?? NO_ITEMS;
  const isDemo = data?.demo ?? false;

  useEffect(() => {
    if (!hydrated || !data || data.complete || data.errors.length) return;
    if (!(query.trim().length >= 2 || country || region || activePathways.length || appointmentType || shortcut !== "all" || deadlineFrom || deadlineTo || searchArea || eligibleOnly)) return;
    const scope = country || undefined;
    if (scope && data.completeCountries.includes(scope)) return;
    const key = scope ?? "*";
    if (scopedLoadsStarted.current.has(key)) return;
    scopedLoadsStarted.current.add(key);
    void loadRecords(scope);
  }, [hydrated, data, query, country, region, activePathways, appointmentType, shortcut, deadlineFrom, deadlineTo, searchArea, eligibleOnly, loadRecords]);

  useEffect(() => {
    const state = decodePublicView(window.location.search);
    if (state.activeTab === "coverage") {
      window.location.replace(withBase("/coverage/"));
      return;
    }
    setQuery(state.query ?? "");
    setActivePathways([...(state.pathways ?? [])]);
    setAppointmentType(state.appointmentType ?? "");
    setCountry(state.country ?? "");
    setRegion(state.region ?? "");
    setShortcut(state.shortcut ?? "all");
    setDeadlineFrom(state.deadlineFrom ?? "");
    setDeadlineTo(state.deadlineTo ?? "");
    setMoreFilters(!!(state.appointmentType || state.deadlineFrom || state.deadlineTo));
    if (state.cycleId) {
      setSelectedId(state.cycleId);
      setReaderOpen(true);
    }
    setMobileView(state.mobileView ?? "list");
    setSearchArea(state.searchArea ?? false);
    setBounds(state.bounds ?? null);
    setCamera(state.camera ?? null);
    setInitialCamera(state.camera ?? null);
    try { setBannerHidden(window.sessionStorage.getItem("govview.banner") === "hidden"); } catch { /* storage blocked */ }
    setHydrated(true);
    const media = window.matchMedia("(max-width: 959px)");
    const onChange = () => setCompact(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // "/" jumps to search, Escape closes the mobile reader.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) setReaderOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const search = encodePublicView({
      query, pathways: activePathways, appointmentType, country, region, shortcut, deadlineFrom, deadlineTo,
      cycleId: readerOpen || !compact ? selectedId : "", activeTab: "explore", mobileView, searchArea, bounds, camera,
    });
    const params = new URLSearchParams(search);
    if (isDemo || new URLSearchParams(window.location.search).get("demo") === "1") params.set("demo", "1");
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }, [hydrated, isDemo, query, activePathways, appointmentType, country, region, shortcut, deadlineFrom, deadlineTo, selectedId, readerOpen, compact, mobileView, searchArea, bounds, camera]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const rangeInvalid = !!(deadlineFrom && deadlineTo && deadlineFrom > deadlineTo);
  const activeBounds = searchArea ? bounds : null;

  // Everything except the pathway filter, so pathway counts describe what a click would show.
  const beforePathway = useMemo(() => {
    const statuses: OpportunityStatus[] | undefined = shortcut === "open" ? ["open", "extended"] : undefined;
    const base = filterOpportunities(opportunities, {
      search: query,
      appointmentTypes: appointmentType ? [appointmentType] : undefined,
      jurisdictionCodes: country ? [country] : undefined,
      subdivisionCodes: region ? [region] : undefined,
      statuses,
      closingWithinDays: shortcut === "closing" ? 7 : undefined,
      changedWithinDays: shortcut === "changed" ? 14 : undefined,
      deadlineFrom: rangeInvalid ? undefined : deadlineFrom || undefined,
      deadlineTo: rangeInvalid ? undefined : deadlineTo || undefined,
    });
    return activeBounds ? base.filter((item) => jurisdictionIntersectsBounds(item.jurisdictionCode, activeBounds)) : base;
  }, [opportunities, query, appointmentType, country, region, shortcut, deadlineFrom, deadlineTo, rangeInvalid, activeBounds]);

  const eligibility = useMemo(() => {
    const results = new Map<string, EligibilityResult>();
    if (!hasProfile) return results;
    for (const item of opportunities) if (item.publicationApproved || item.fixture) results.set(item.id, evaluateEligibility(item.rules, profile).canApply.result);
    return results;
  }, [opportunities, profile, hasProfile]);

  const filtered = useMemo(() => {
    let items = activePathways.length ? beforePathway.filter((item) => activePathways.includes(item.pathway)) : beforePathway;
    if (eligibleOnly && hasProfile) items = items.filter((item) => eligibility.get(item.id) !== "does-not-match");
    return sortCycles(items);
  }, [beforePathway, activePathways, eligibleOnly, hasProfile, eligibility]);

  const pathwayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of beforePathway) counts[item.pathway] = (counts[item.pathway] ?? 0) + 1;
    return counts;
  }, [beforePathway]);

  const selected = filtered.find((item) => item.id === selectedId) ?? (compact || selectedId ? null : filtered[0] ?? null);
  const readerHasSelection = !!selected || (!!selectedId && detail?.id === selectedId);

  const markers = useMemo(() => {
    const counts = countByJurisdiction(filtered);
    return jurisdictions.flatMap((item) => item.center && counts[item.code] ? [{
      id: item.code, label: item.name, latitude: item.center.latitude, longitude: item.center.longitude,
      count: counts[item.code], selected: country === item.code,
    }] : []);
  }, [filtered, country]);

  // Pins only for the part of the world in view, and not too many at once.
  const venueMarkers = useMemo(() => {
    const inView = (lat: number, lon: number) => !bounds || (lat >= bounds.south && lat <= bounds.north && (bounds.west <= bounds.east ? lon >= bounds.west && lon <= bounds.east : lon >= bounds.west || lon <= bounds.east));
    const pins = [];
    for (const item of filtered) {
      for (const [index, venue] of item.venues.entries()) {
        if (venue.kind !== "published" || !inView(venue.latitude, venue.longitude)) continue;
        pins.push({ id: `${item.id}:${index}`, cycleId: item.id, label: `${item.title} · ${venue.city}`, latitude: venue.latitude, longitude: venue.longitude });
        if (pins.length >= MAX_VENUE_PINS) return pins;
      }
    }
    return pins;
  }, [filtered, bounds]);

  const focusCode = country || focusedCode;
  const focusedJurisdiction = focusCode ? jurisdictions.find((item) => item.code === focusCode) ?? null : null;
  const closingCount = useMemo(() => filterOpportunities(opportunities, { closingWithinDays: 7, jurisdictionCodes: country ? [country] : undefined }).length, [opportunities, country]);
  const changedCount = useMemo(() => filterOpportunities(opportunities, { changedWithinDays: 14, jurisdictionCodes: country ? [country] : undefined }).length, [opportunities, country]);

  // Start each new result set at the top page.
  useEffect(() => setVisibleCount(PAGE_SIZE), [filtered]);

  // Fetch the full record for whatever is selected.
  useEffect(() => {
    let active = true;
    const targetId = selectedId || selected?.id;
    if (!targetId) { setDetail(null); setDetailError(""); setAmbiguousIds([]); return; }
    if (detail?.id === targetId) return;
    setDetailError("");
    setAmbiguousIds([]);
    (selectedId ? loadDetailById(selectedId) : loadDetail(selected!))
      .then((record) => { if (active) { setDetail(record); if (!record) setDetailError("Details unavailable. Retry or use official source."); } })
      .catch((error) => { if (active) { setDetail(null); setDetailError(error instanceof Error ? error.message : String(error)); setAmbiguousIds(error instanceof AmbiguousCycleIdError ? error.candidates : []); } });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selectedId, detailRetry]);
  const filtersActive = !!(query || activePathways.length || appointmentType || country || shortcut !== "all" || deadlineFrom || deadlineTo || searchArea || eligibleOnly);

  const selectCycle = useCallback((id: string) => {
    setSelectedId(id);
    setReaderOpen(true);
  }, []);
  const handleBounds = useCallback((next: Bounds) => setBounds(next), []);
  const handleCamera = useCallback((next: Camera) => setCamera(next), []);
  const handleMarkerSelect = useCallback((code: string) => {
    setCountry(code);
    setRegion("");
    setFocusedCode(null);
  }, []);

  const handleRegionSelect = useCallback((code: string) => {
    setCountry(code.split("-")[0]);
    setFocusedCode(null);
    setRegion((current) => current === code ? "" : code);
  }, []);

  function togglePathway(pathway: Pathway) {
    setActivePathways((current) => current.includes(pathway) ? current.filter((item) => item !== pathway) : [...current, pathway]);
  }

  function resetFilters() {
    setQuery("");
    setActivePathways([]);
    setAppointmentType("");
    setCountry("");
    setRegion("");
    setFocusedCode(null);
    setShortcut("all");
    setEligibleOnly(false);
    setDeadlineFrom("");
    setDeadlineTo("");
    setSearchArea(false);
  }

  function openCard(event: MouseEvent<HTMLAnchorElement>, item: CycleSummary) {
    // Let new-tab clicks through to the job's own page.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    selectCycle(item.id);
    setFocusedCode(item.jurisdictionCode);
  }

  async function shareCycle(item: OpportunityCycle) {
    const url = item.fixture
      ? `${window.location.origin}${withBase(`/?demo=1&cycle=${encodeURIComponent(item.id)}`)}`
      : `${window.location.origin}${withBase(`/job/?id=${encodeURIComponent(item.id)}`)}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast("Link copied");
    } catch {
      setToast(url);
    }
  }

  function hideBanner() {
    setBannerHidden(true);
    try { window.sessionStorage.setItem("govview.banner", "hidden"); } catch { /* storage blocked */ }
  }

  const regions = country ? subdivisionsByCountry[country] : undefined;
  const count = countCycles(filtered);

  return (
    <div className="app">
      <SiteHeader current="explore" onProfile={() => setProfileOpen(true)} hasProfile={hasProfile} />
      {isDemo && !bannerHidden && (
        <div className="demo-banner" role="note">
          <p>{FIXTURE_NOTICE}</p>
          <button type="button" className="icon-button" onClick={hideBanner} aria-label="Hide this notice"><X size={16} /></button>
        </div>
      )}

      <main className="explore" data-mobile-view={mobileView} data-reader-open={readerOpen && (readerHasSelection || !!selectedId) ? "true" : "false"}>
        <aside className="finder" aria-label="Search and results">
          <div className="finder-controls">
            <h1>Find government jobs, exams and licences</h1>
            <label className="search-field">
              <span className="visually-hidden">Search</span>
              <Search size={17} aria-hidden="true" />
              <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Job title, exam or department" />
              {!query && <kbd aria-hidden="true">/</kbd>}
            </label>

            <div className="field-row">
              <label className="select-field">
                <span>Country</span>
                <select value={country} onChange={(event) => { setCountry(event.target.value); setRegion(""); setFocusedCode(null); }}>
                  <option value="">All countries</option>
                  {jurisdictions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                </select>
              </label>
              {regions && (
                <label className="select-field">
                  <span>State</span>
                  <select value={region} onChange={(event) => setRegion(event.target.value)}>
                    <option value="">All states</option>
                    {regions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                  </select>
                </label>
              )}
            </div>

            <fieldset className="chip-group">
              <legend className="visually-hidden">Type of opportunity</legend>
              {pathwayOrder.map((pathway) => (
                <button key={pathway} type="button" className="chip" aria-pressed={activePathways.includes(pathway)} onClick={() => togglePathway(pathway)} title={pathwayDescriptions[pathway]}>
                  {pathwayLabels[pathway]} <span className="chip-count">{pathwayCounts[pathway] ?? 0}</span>
                </button>
              ))}
            </fieldset>

            <fieldset className="chip-group">
              <legend className="visually-hidden">Quick filters</legend>
              {(Object.keys(shortcutLabels) as Exclude<Shortcut, "all">[]).map((key) => (
                <button key={key} type="button" className="chip chip-quiet" aria-pressed={shortcut === key} onClick={() => setShortcut(shortcut === key ? "all" : key)}>
                  {shortcutLabels[key]}
                </button>
              ))}
              <button type="button" className="chip chip-quiet" aria-pressed={eligibleOnly} onClick={() => hasProfile ? setEligibleOnly(!eligibleOnly) : setProfileOpen(true)}>
                {hasProfile ? "Hide ones I can't apply for" : "Match my details…"}
              </button>
            </fieldset>

            <details className="more-filters" open={moreFilters} onToggle={(event) => setMoreFilters(event.currentTarget.open)}>
              <summary>More filters</summary>
              <label className="select-field">
                <span>Appointment type</span>
                <select value={appointmentType} onChange={(event) => setAppointmentType(event.target.value as AppointmentType | "")}>
                  <option value="">Any verified or unknown type</option>
                  {appointmentTypeOrder.map((type) => <option key={type} value={type}>{appointmentTypeLabels[type]}</option>)}
                </select>
              </label>
              <p className="fine-print">Type appears only when official notice states it. Selecting one excludes notices with unknown type.</p>
              <p className="fine-print">Last date between</p>
              <div className="field-row">
                <label className="select-field"><span>From</span><input type="date" value={deadlineFrom} onChange={(event) => setDeadlineFrom(event.target.value)} /></label>
                <label className="select-field"><span>To</span><input type="date" value={deadlineTo} min={deadlineFrom || undefined} onChange={(event) => setDeadlineTo(event.target.value)} /></label>
              </div>
              {rangeInvalid && <p className="field-error" role="alert">The "from" date is after the "to" date, so this range is ignored.</p>}
            </details>
          </div>

          <div className="results-head">
            <p aria-live="polite"><strong>{count}</strong> {count === 1 ? "opportunity" : "opportunities"}{searchArea ? " in the map area" : ""}{data && !data.complete && !(country && data.completeCountries.includes(country)) ? " · partial results" : ""}</p>
            {filtersActive && <button type="button" className="link-button" onClick={resetFilters}>Clear filters</button>}
          </div>
          {data?.generatedAt && <p className="results-hint">Data built {new Date(data.generatedAt).toLocaleString()} · {data.loadedCount.toLocaleString()} of {data.total.toLocaleString()} records loaded. Not a government website—confirm on official site.</p>}
          {isDemo && <p className="results-hint"><strong>Demo examples only.</strong> Dates, rules and locations are invented. <a href={withBase("/")}>Return to reviewed opportunities</a>.</p>}
          {data?.errors.length ? <div className="field-error" role="alert"><p>{data.errors.length} data file{data.errors.length === 1 ? "" : "s"} failed. Healthy results remain visible.</p><button type="button" className="button-quiet" onClick={() => void loadRecords(country || undefined)}>Retry missing files</button></div> : null}
          {loadError && <div className="field-error" role="alert"><p>Could not load opportunity data: {loadError}</p><button type="button" className="button-quiet" onClick={() => void loadRecords(country || undefined)}>Retry</button></div>}
          {data && !data.complete && !data.errors.length && !country && <p className="results-hint">Worldwide results are still partial. <button type="button" className="link-button" disabled={loadingRemaining} onClick={() => void loadRecords()}>{loadingRemaining ? "Loading remaining records…" : "Load all records"}</button></p>}
          {shortcut === "all" && !filtersActive && (closingCount > 0 || changedCount > 0) && (
            <p className="results-hint">
              {closingCount > 0 && <button type="button" className="link-button" onClick={() => setShortcut("closing")}>{closingCount} closing this week</button>}
              {closingCount > 0 && changedCount > 0 && " · "}
              {changedCount > 0 && <button type="button" className="link-button" onClick={() => setShortcut("changed")}>{changedCount} updated recently</button>}
            </p>
          )}

          <ol className="results">
            {filtered.slice(0, visibleCount).map((item) => {
              const result = eligibility.get(item.id);
              return (
                <li key={item.id}>
                  <a
                    href={item.fixture ? withBase(`/?demo=1&cycle=${encodeURIComponent(item.id)}`) : withBase(`/job/?id=${encodeURIComponent(item.id)}`)}
                    className="result"
                    aria-current={selected?.id === item.id ? "true" : undefined}
                    onClick={(event) => openCard(event, item)}
                  >
                    <span className="result-meta">{item.jurisdictionName} · {pathwayLabels[item.pathway]}{item.appointmentType ? ` · ${appointmentTypeLabels[item.appointmentType]}` : ""}</span>
                    <span className="result-title">{item.title}</span>
                    <span className="result-authority">{item.authority}</span>
                    <span className="result-foot">
                      <span className={`status-dot status-${item.status}`}>{statusLabels[item.status]}</span>
                      <span className={deadlineUrgent(item) ? "deadline urgent" : "deadline"}>{deadlineText(item)}</span>
                    </span>
                    {result && <span className={`result-fit fit-${result}`}><ResultIcon result={result} size={14} />{shortResultLabels[result]}</span>}
                  </a>
                </li>
              );
            })}
          </ol>
          {filtered.length > visibleCount && (
            <div className="show-more">
              <button type="button" className="button-quiet" onClick={() => setVisibleCount((value) => value + PAGE_SIZE * 2)}>
                Show more ({filtered.length - visibleCount} left)
              </button>
            </div>
          )}
          {!data && <p className="loading-note" role="status">Loading opportunities…</p>}
          {data && (data.complete || !!country && data.completeCountries.includes(country)) && !filtered.length && (
            <div className="empty">
              {data.total === 0 ? <>
                <p><strong>No reviewed notices published yet.</strong></p>
                <p>Browse <a href={withBase("/coverage/")}>country coverage and official authority links</a> while source records await evidence review.</p>
                <p><a href={withBase("/?demo=1")}>Explore clearly labeled demo examples</a> to try filters, eligibility and opportunity details.</p>
              </> : <>
                <p><strong>Nothing matches.</strong></p>
                <p>Try fewer filters, or a different country. We only list notices from sources we check — see <a href={withBase("/coverage/")}>where we look</a>.</p>
                {filtersActive && <button type="button" className="button-quiet" onClick={resetFilters}>Clear filters</button>}
              </>}
            </div>
          )}
        </aside>

        <section className="map-pane" aria-label="Map">
          {(!compact || mobileView === "map") && (
            <GlobeView
              markers={markers}
              venueMarkers={venueMarkers}
              onSelect={handleMarkerSelect}
              onVenueSelect={selectCycle}
              selectedJurisdictionId={country || null}
              onBoundsChange={handleBounds}
              onCameraChange={handleCamera}
              focus={focusedJurisdiction?.center ?? null}
              initialCamera={initialCamera}
              resetViewToken={resetViewToken}
              regionCountryId={focusCode}
              selectedRegionId={region || null}
              onRegionSelect={handleRegionSelect}
            />
          )}
          <div className="map-toolbar">
            <p className="map-where">
              <MapPin size={14} aria-hidden="true" />
              {focusedJurisdiction ? focusedJurisdiction.name : "Whole world"}{region ? ` › ${regionName(region)}` : ""}
            </p>
            <div>
              {(country || focusedCode) && (
                <button type="button" className="map-button" onClick={() => { setCountry(""); setRegion(""); setFocusedCode(null); setSearchArea(false); setResetViewToken((value) => value + 1); }}>
                  <Globe2 size={14} aria-hidden="true" />Whole world
                </button>
              )}
              <button type="button" className="map-button" aria-pressed={searchArea} onClick={() => setSearchArea((value) => !value)}>
                <Search size={14} aria-hidden="true" />{searchArea ? "Searching this area" : "Search this area"}
              </button>
            </div>
          </div>
          <p className="map-caption">Map counts reflect loaded records. Use country selector for full geographic navigation.</p>
        </section>

        <aside className="reader" aria-label="Opportunity details">
          {readerHasSelection || selectedId ? (
            <>
              <button type="button" className="reader-back" onClick={() => setReaderOpen(false)}><ArrowLeft size={16} aria-hidden="true" />Back to results</button>
              {detail && detail.id === (selectedId || selected?.id)
                ? <JobArticle item={detail} profile={profile} onEditProfile={() => setProfileOpen(true)} onShare={() => shareCycle(detail)} />
                : detailError ? <div className="reader-empty" role="alert"><p>{detailError}</p>{ambiguousIds.length ? <ul>{ambiguousIds.map((id) => <li key={id}><button type="button" className="link-button" onClick={() => selectCycle(id)}>{id}</button></li>)}</ul> : <button type="button" className="button-quiet" onClick={() => setDetailRetry((value) => value + 1)}>Retry details</button>}</div>
                : <div className="reader-empty" role="status"><p>Loading details…</p></div>}
            </>
          ) : (
            <div className="reader-empty">
              <p>Pick an opportunity to see dates, rules and how to apply.</p>
            </div>
          )}
        </aside>

        <button type="button" className="view-switch" onClick={() => setMobileView(mobileView === "map" ? "list" : "map")}>
          {mobileView === "map" ? <><List size={16} aria-hidden="true" />List</> : <><Globe2 size={16} aria-hidden="true" />Map</>}
        </button>
      </main>

      <ProfileDialog open={profileOpen} profile={profile} onClose={() => setProfileOpen(false)} onSave={saveProfile} onClear={() => { clearProfile(); setEligibleOnly(false); setToast("Your details were deleted from this browser"); }} />
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
