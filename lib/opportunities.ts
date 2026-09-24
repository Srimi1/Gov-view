import type { EligibilityRules } from "./eligibility/types.ts";
import { fixtureCoverage, fixtureOpportunities } from "./fixtures.ts";
import { civilDateIn, civilDay, clockIn, daysBetween } from "./time.ts";

export const FIXTURE_NOTICE =
  "You're looking at demo records. Dates, rules and places are made up so the site can be tried out — don't use them to apply.";

export type Pathway = "recruitment" | "licensing" | "admission" | "vocational";
/** "upcoming" = announced in an official calendar but not yet open. */
export type OpportunityStatus = "open" | "upcoming" | "closed" | "extended" | "cancelled" | "stale" | "uncertain";
export type CoverageStatus = "verified-listings" | "sources-checked-no-current" | "no-verified-listings";

export interface Jurisdiction {
  code: string;
  name: string;
  /** Camera navigation only. Never use center as an examination venue. */
  center: { latitude: number; longitude: number };
  region: string;
  timeZone: string;
}

export interface ApplicationWindow {
  opensOn: string | null;
  closesOn: string | null;
  officialTimeZone: string;
  cutoffLocalTime: string | null;
  precision: "date" | "minute" | "unknown";
  note?: string;
}

export type Venue =
  | {
      kind: "published";
      name: string;
      city: string;
      latitude: number;
      longitude: number;
      /** "exact" = address/coordinates from the notice; "city" = geocoded city centre. */
      precision?: "exact" | "city";
      /** ISO 3166-2 code, e.g. IN-MH. */
      subdivision?: string;
    }
  | { kind: "online"; name: string }
  | { kind: "unknown"; name: string };

export interface SourceEvidence {
  id: string;
  title: string;
  authority: string;
  language: string;
  format: "HTML" | "PDF" | "scanned PDF" | "JSON" | "XML" | "CSV";
  url: string | null;
  sha256?: string;
  lastSuccessfulFetchAt: string | null;
  lastValidatedAt: string | null;
  verificationStatus: "fixture" | "pending-review" | "verified";
}

export interface OpportunityChange {
  at: string;
  kind: "created" | "extended" | "cancelled" | "eligibility" | "source-failure" | "updated";
  summary: string;
}

export interface OpportunityCycle {
  id: string;
  fixture: boolean;
  /** Registry id of the source that produced this record. */
  sourceId?: string;
  title: string;
  cycleLabel: string;
  programme: string;
  authority: string;
  pathway: Pathway;
  status: OpportunityStatus;
  statusNote: string;
  jurisdictionCode: string;
  jurisdictionName: string;
  /** ISO 3166-2 codes when hiring is limited to specific states or regions. */
  subdivisionCodes?: string[];
  scopeLabel: string;
  outcome: string;
  applicationWindow: ApplicationWindow;
  qualifications: string;
  citizenshipRule: string;
  residenceRule: string;
  selectionStages: string[];
  fee: string;
  salary?: string;
  /** Machine-checkable criteria read from the notice; null until entered. */
  rules: EligibilityRules | null;
  venues: Venue[];
  sources: SourceEvidence[];
  lastVerifiedAt: string | null;
  applicationUrl: string | null;
  changes: OpportunityChange[];
}

export interface CoverageRecord {
  jurisdictionCode: string;
  fixture: boolean;
  status: CoverageStatus;
  researchedAuthorities: string[];
  connectedSourceCount: number;
  unresolvedGaps: string[];
  lastSuccessfulFetchAt: string | null;
  lastValidatedAt: string | null;
}

export interface OpportunityFilters {
  search?: string;
  pathways?: readonly Pathway[];
  statuses?: readonly OpportunityStatus[];
  jurisdictionCodes?: readonly string[];
  subdivisionCodes?: readonly string[];
  closingWithinDays?: number;
  deadlineFrom?: string;
  deadlineTo?: string;
  changedWithinDays?: number;
}

export const jurisdictions: Jurisdiction[] = [
  { code: "IN", name: "India", center: { latitude: 22.5, longitude: 79 }, region: "Asia", timeZone: "Asia/Kolkata" },
  { code: "US", name: "United States", center: { latitude: 39, longitude: -98 }, region: "North America", timeZone: "America/New_York" },
  { code: "GB", name: "United Kingdom", center: { latitude: 54, longitude: -2 }, region: "Europe", timeZone: "Europe/London" },
  { code: "BR", name: "Brazil", center: { latitude: -10, longitude: -55 }, region: "South America", timeZone: "America/Sao_Paulo" },
  { code: "FR", name: "France", center: { latitude: 46.5, longitude: 2.5 }, region: "Europe", timeZone: "Europe/Paris" },
  { code: "JP", name: "Japan", center: { latitude: 36, longitude: 138 }, region: "Asia", timeZone: "Asia/Tokyo" },
];

/** Forces demo records even when real data exists (useful for UI work). */
export const forceDemo = process.env.NEXT_PUBLIC_DEMO === "1";
/** Illustrative records, shown only in demo mode or until real data is published. */
export const demoOpportunities: OpportunityCycle[] = fixtureOpportunities;
export const demoCoverage: CoverageRecord[] = fixtureCoverage;

/**
 * What the list, map and filters need. Built by scripts/build-data.ts from the
 * published records; the full record is fetched from its shard on demand.
 */
export type CycleSummary = Pick<OpportunityCycle,
  "id" | "fixture" | "title" | "authority" | "programme" | "pathway" | "status" | "jurisdictionCode" | "jurisdictionName" |
  "subdivisionCodes" | "scopeLabel" | "outcome" | "applicationWindow" | "rules" | "venues" | "changes"> & {
  qualifications?: string;
  /** Detail shard file number; absent for demo records, which are complete. */
  shard?: number;
};

/**
 * Status as of today. Collection runs a few times a day, so a record saved as
 * "open" may have passed its deadline since; never show it as open.
 */
export function liveStatus<T extends CycleSummary>(item: T, now: Date = new Date()): OpportunityStatus {
  if (item.fixture) return item.status;
  const today = civilDateIn(item.applicationWindow.officialTimeZone, now);
  const { opensOn, closesOn, cutoffLocalTime, officialTimeZone } = item.applicationWindow;
  const live = item.status === "open" || item.status === "extended" || item.status === "upcoming" || item.status === "stale";
  if (live && closesOn && closesOn < today) return "closed";
  // Closing today at a published time that has already passed.
  if (live && closesOn === today && cutoffLocalTime && clockIn(officialTimeZone, now) >= cutoffLocalTime) return "closed";
  if (item.status === "upcoming" && opensOn && opensOn <= today) return "open";
  return item.status;
}

/** Today's date where the notice was issued — deadlines are civil dates in that zone. */
export function todayFor(item: CycleSummary, now: Date = new Date()): string {
  return civilDateIn(item.applicationWindow.officialTimeZone, now);
}

/** Demo records use a fixed "today" so their scenarios stay reproducible. */
export const DEMO_REFERENCE_DATE = "2026-09-24";

export function referenceDateFor(item: CycleSummary, now?: Date): string {
  return item.fixture ? DEMO_REFERENCE_DATE : todayFor(item, now);
}

export function daysUntilDeadline(item: CycleSummary, referenceDate?: string): number | null {
  const close = item.applicationWindow.closesOn;
  return close ? daysBetween(referenceDate ?? referenceDateFor(item), close) : null;
}

const normalize = (text: string) => text.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();

/**
 * One selector for list, globe, and counts. Deduplicates repeated notices of the
 * same cycle, keeping the latest revision. Without `referenceDate`, each record
 * is judged against today in its own official timezone.
 */
export function filterOpportunities<T extends CycleSummary>(
  items: readonly T[],
  filters: OpportunityFilters = {},
  referenceDate?: string,
): T[] {
  const query = filters.search ? normalize(filters.search).trim() : "";
  const terms = query.split(/\s+/).filter(Boolean);
  const latestChangeTime = (item: T): number =>
    item.changes.reduce((latest, change) => {
      const time = Date.parse(change.at);
      return Number.isFinite(time) ? Math.max(latest, time) : latest;
    }, Number.NEGATIVE_INFINITY);
  const latestById = new Map<string, T>();
  for (const item of items) {
    const current = latestById.get(item.id);
    if (!current || latestChangeTime(item) >= latestChangeTime(current)) latestById.set(item.id, item);
  }
  return [...latestById.values()].filter((item) => {
    if (filters.pathways?.length && !filters.pathways.includes(item.pathway)) return false;
    if (filters.statuses?.length && !filters.statuses.includes(item.status)) return false;
    if (filters.jurisdictionCodes?.length && !filters.jurisdictionCodes.includes(item.jurisdictionCode)) return false;
    if (filters.subdivisionCodes?.length) {
      const regions = new Set([
        ...(item.subdivisionCodes ?? []),
        ...item.venues.flatMap((venue) => (venue.kind === "published" && venue.subdivision ? [venue.subdivision] : [])),
      ]);
      // Nationwide cycles (no listed regions) stay visible in every state of their country.
      if (regions.size && !filters.subdivisionCodes.some((code) => regions.has(code))) return false;
    }
    if (terms.length) {
      const haystack = normalize([
        item.title,
        item.programme,
        item.authority,
        item.jurisdictionName,
        item.scopeLabel,
        item.outcome,
        item.qualifications ?? "",
        ...item.venues.flatMap((venue) => (venue.kind === "published" ? [venue.name, venue.city] : [venue.name])),
      ].join(" "));
      // Every word must appear somewhere, in any order.
      if (!terms.every((term) => haystack.includes(term))) return false;
    }
    const deadline = item.applicationWindow.closesOn;
    if (filters.deadlineFrom && (!deadline || deadline < filters.deadlineFrom)) return false;
    if (filters.deadlineTo && (!deadline || deadline > filters.deadlineTo)) return false;
    const today = referenceDate ?? referenceDateFor(item);
    if (filters.closingWithinDays !== undefined) {
      const days = daysUntilDeadline(item, today);
      if (days === null || days < 0 || days > filters.closingWithinDays) return false;
      if (item.status === "cancelled" || item.status === "closed") return false;
    }
    if (filters.changedWithinDays !== undefined) {
      // A first sighting is "new", not "updated".
      const recent = item.changes.some((change) => {
        if (change.kind === "created" && !item.fixture) return false;
        const days = civilDay(today) - civilDay(change.at.slice(0, 10));
        return days >= 0 && days <= filters.changedWithinDays!;
      });
      if (!recent) return false;
    }
    return true;
  });
}

export function countCycles(items: readonly CycleSummary[]): number {
  return new Set(items.map((item) => item.id)).size;
}

export function countByJurisdiction(items: readonly CycleSummary[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    counts[item.jurisdictionCode] = (counts[item.jurisdictionCode] ?? 0) + 1;
  }
  return counts;
}

export function getCoverage(jurisdictionCode: string, records: readonly CoverageRecord[] = demoCoverage): CoverageRecord | undefined {
  return records.find((record) => record.jurisdictionCode === jurisdictionCode);
}
