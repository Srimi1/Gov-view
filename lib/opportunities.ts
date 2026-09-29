import type { EligibilityRules } from "./eligibility/types.ts";
import { fixtureCoverage, fixtureOpportunities } from "./fixtures.ts";
import { civilDateIn, civilDay, clockIn, clockSecondIn, daysBetween } from "./time.ts";
import jurisdictionInventory from "../data/reference/jurisdictions.json" with { type: "json" };

export const FIXTURE_NOTICE =
  "You're looking at demo records. Dates, rules and places are made up so the site can be tried out — don't use them to apply.";

export type Pathway = "recruitment" | "licensing" | "admission" | "vocational";
/** Use only when an official notice establishes the appointment arrangement. */
export type AppointmentType = "permanent" | "contract" | "temporary" | "deputation" | "apprenticeship";
/** "upcoming" = announced in an official calendar but not yet open. */
export type OpportunityStatus = "open" | "upcoming" | "closed" | "extended" | "cancelled" | "stale" | "uncertain";
export type CoverageStatus = "verified-listings" | "sources-checked-no-current" | "no-verified-listings" | "unresearched" | "partial" | "blocked" | "stale";

export interface Jurisdiction {
  code: string;
  name: string;
  /** Camera navigation only. Never use center as an examination venue. */
  center?: { latitude: number; longitude: number };
  region: string;
  /** Authority-specific deadlines still carry their own timezone. */
  timeZone?: string;
  aliases?: string[];
  parentCode?: string;
  inventorySource?: string;
  geometryCode?: string;
}

export interface ApplicationWindow {
  opensOn: string | null;
  closesOn: string | null;
  /** Null when source does not establish one official deadline zone. */
  officialTimeZone: string | null;
  cutoffLocalTime: string | null;
  /** True when the authority explicitly includes the printed cutoff second. */
  cutoffInclusive?: boolean;
  precision: "date" | "minute" | "second" | "unknown";
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
  | {
      /** Official street address is known, but coordinates have not been verified. No map pin. */
      kind: "published-address";
      name: string;
      city: string;
      subdivision?: string;
    }
  | { kind: "online"; name: string }
  | { kind: "unknown"; name: string };

export interface SourceEvidence {
  id: string;
  title: string;
  authority: string;
  language: string;
  format: "HTML" | "PDF" | "scanned PDF" | "image" | "JSON" | "XML" | "CSV";
  url: string | null;
  sha256?: string;
  /** Stable digest of this individual item in a bulk feed; parent sha256 still hashes retained response bytes. */
  itemSha256?: string;
  /** URL whose exact fetched bytes produced sha256; may differ from public notice URL. */
  fetchedUrl?: string;
  fetchStatus?: "fetched" | "linked";
  lastSuccessfulFetchAt: string | null;
  lastValidatedAt: string | null;
  verificationStatus: "fixture" | "pending-review" | "verified";
}

export interface OfficialCitation {
  sourceId: string;
  url: string;
  documentSha256: string | null;
  noticeDate?: string | null;
  page?: number | null;
  quote?: string;
}

export interface SyllabusVersion {
  edition: string;
  language: string;
  status: "verified" | "pending" | "unavailable" | "superseded" | "not-applicable";
  officialDocuments: OfficialCitation[];
  topics: { stage: string; subject: string; topic: string; citation: OfficialCitation }[];
}

export interface FeeRule {
  amount: number | null;
  currency: string;
  category: string;
  exemption: boolean;
  conditions: string;
  citation: OfficialCitation;
}

export interface RequiredDocument {
  name: string;
  stage: string;
  conditions: string;
  specifications?: string;
  citation: OfficialCitation;
}

export interface ImageRequirement {
  kind: "photo" | "signature";
  formats: string[];
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxBytes?: number;
  verified?: boolean;
  sourceUrl?: string;
  citation?: OfficialCitation;
}

export interface ExamEvent {
  id?: string;
  label: string;
  date: string;
  endDate?: string;
  localTime?: string;
  timezone?: string;
  verified?: boolean;
  sourceUrl?: string;
  citation?: OfficialCitation;
}

export interface ReviewDecision {
  status: "approved" | "pending" | "rejected";
  evidenceRevision: string;
  recordRevision?: string;
  reviewer?: string;
  reviewedAt?: string;
  reason?: string;
  evidenceSummary?: string;
  minutesSpent?: number;
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
  /** Collector observation; never a verified cancellation or material notice change. */
  sourceMissingSince?: string | null;
  programmeId?: string;
  legacyIds?: string[];
  evidenceRevision?: string;
  reviewDecision?: ReviewDecision;
  /** Build-derived flag; never trusted as input to approval or publication. */
  publicationApproved?: boolean;
  /** Exported prior approved snapshot while a newer revision awaits review. */
  reviewPending?: boolean;
  syllabus?: SyllabusVersion;
  structuredFees?: FeeRule[];
  requiredDocuments?: RequiredDocument[];
  imageRequirements?: ImageRequirement[];
  examEvents?: ExamEvent[];
  title: string;
  cycleLabel: string;
  programme: string;
  authority: string;
  pathway: Pathway;
  appointmentType?: AppointmentType;
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
  /** Published language rule when requirement varies by chosen post and cannot be one deterministic profile check. */
  languageNote?: string;
  citizenshipRule: string;
  residenceRule: string;
  selectionStages: string[];
  fee: string;
  salary?: string;
  /** Machine-checkable criteria read from the notice; null until entered. */
  rules: EligibilityRules | null;
  /** Published job or training sites; never interpreted as examination venues. */
  workLocations?: string[];
  venues: Venue[];
  sources: SourceEvidence[];
  lastVerifiedAt: string | null;
  /** How candidate submits application; official document URL may be a postal form. */
  applicationMethod?: "online" | "post" | "email" | "in-person";
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
  appointmentTypes?: readonly AppointmentType[];
  statuses?: readonly OpportunityStatus[];
  jurisdictionCodes?: readonly string[];
  subdivisionCodes?: readonly string[];
  closingWithinDays?: number;
  deadlineFrom?: string;
  deadlineTo?: string;
  changedWithinDays?: number;
}

const pilotTimeZones: Record<string, string> = {
  IN: "Asia/Kolkata", US: "America/New_York", GB: "Europe/London",
  BR: "America/Sao_Paulo", FR: "Europe/Paris", JP: "Asia/Tokyo",
};
const pilotNames: Record<string, string> = { US: "United States", GB: "United Kingdom" };

/** Dated UN M49 snapshot plus documented supplements. Listing coverage remains separate. */
export const jurisdictions: Jurisdiction[] = jurisdictionInventory.jurisdictions.map((entry) => ({
  code: entry.code,
  name: pilotNames[entry.code] ?? entry.name,
  center: entry.center ?? undefined,
  region: entry.region,
  timeZone: pilotTimeZones[entry.code],
  aliases: pilotNames[entry.code] ? [entry.name] : undefined,
  inventorySource: entry.source,
  geometryCode: entry.geometryCode ?? undefined,
}));

/** Forces demo records even when real data exists (useful for UI work). */
export const forceDemo = process.env.NEXT_PUBLIC_DEMO === "1";
/** Illustrative records, shown only in explicit demo mode. */
export const demoOpportunities: OpportunityCycle[] = fixtureOpportunities;
export const demoCoverage: CoverageRecord[] = fixtureCoverage;

/**
 * What the list, map and filters need. Built by scripts/build-data.ts from the
 * published records; the full record is fetched from its shard on demand.
 */
export type CycleSummary = Pick<OpportunityCycle,
  "id" | "fixture" | "title" | "authority" | "programme" | "pathway" | "appointmentType" | "status" | "jurisdictionCode" | "jurisdictionName" |
  "subdivisionCodes" | "scopeLabel" | "outcome" | "applicationWindow" | "rules" | "venues" | "changes"> & {
  publicationApproved?: boolean;
  reviewPending?: boolean;
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
  if (item.reviewPending) return "uncertain";
  const { opensOn, closesOn, cutoffLocalTime, cutoffInclusive, officialTimeZone } = item.applicationWindow;
  // Without an official zone, only a deadline past the last possible civil date
  // can safely be called closed. Active/opening status remains unverified.
  const today = civilDateIn(officialTimeZone ?? "Etc/GMT+12", now);
  const live = item.status === "open" || item.status === "extended" || item.status === "upcoming" || item.status === "stale";
  if (live && closesOn && closesOn < today) return "closed";
  if (!officialTimeZone) return item.status === "open" || item.status === "extended" || item.status === "upcoming" ? "uncertain" : item.status;
  // Closing today at a published time that has already passed.
  if (live && closesOn === today && cutoffLocalTime) {
    const clock = cutoffLocalTime.length === 8 ? clockSecondIn(officialTimeZone, now) : clockIn(officialTimeZone, now);
    if (cutoffInclusive ? clock > cutoffLocalTime : clock >= cutoffLocalTime) return "closed";
  }
  if (item.status === "upcoming" && opensOn && opensOn <= today) return "open";
  return item.status;
}

/** Today's date in the governing zone, or the earliest possible civil date when unknown. */
export function todayFor(item: CycleSummary, now: Date = new Date()): string {
  return civilDateIn(item.applicationWindow.officialTimeZone ?? "Etc/GMT+12", now);
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
    if (filters.appointmentTypes?.length && (!item.appointmentType || !filters.appointmentTypes.includes(item.appointmentType))) return false;
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
        ...item.venues.flatMap((venue) => (venue.kind === "published" || venue.kind === "published-address" ? [venue.name, venue.city] : [venue.name])),
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

export function getCoverage(jurisdictionCode: string, records: readonly CoverageRecord[]): CoverageRecord | undefined {
  return records.find((record) => record.jurisdictionCode === jurisdictionCode);
}
