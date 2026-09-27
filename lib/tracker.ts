import type { OpportunityCycle, OpportunityStatus } from "./opportunities.ts";
import { approvedRevision } from "./public-approval.ts";
import { isIsoDate } from "./time.ts";

export const TRACKER_KEY = "govview.tracker.v1";
export const TRACKER_MAX_BYTES = 250_000;
export const TRACKER_MAX_ITEMS = 100;

export interface TrackedOpportunity {
  id: string;
  title: string;
  jurisdictionCode: string;
  status: OpportunityStatus;
  closesOn: string | null;
  revisionId: string | null;
  savedAt: string;
}

export interface TrackerDocument {
  version: 1;
  entries: TrackedOpportunity[];
}

const statuses = new Set<OpportunityStatus>(["open", "upcoming", "closed", "extended", "cancelled", "stale", "uncertain"]);
const idPattern = /^[a-z0-9][a-z0-9-]{0,119}$/;
const countryPattern = /^[A-Z]{2,8}$/;
const revisionPattern = /^[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validInstant(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

function parseEntry(value: unknown): TrackedOpportunity {
  if (!isRecord(value) ||
      typeof value.id !== "string" || !idPattern.test(value.id) ||
      typeof value.title !== "string" || !value.title.trim() || value.title.length > 250 ||
      typeof value.jurisdictionCode !== "string" || !countryPattern.test(value.jurisdictionCode) ||
      !statuses.has(value.status as OpportunityStatus) ||
      (value.closesOn !== null && !isIsoDate(value.closesOn)) ||
      (value.revisionId !== null && (typeof value.revisionId !== "string" || !revisionPattern.test(value.revisionId))) ||
      !validInstant(value.savedAt)) throw new Error("Tracker file contains an invalid entry.");
  return {
    id: value.id,
    title: value.title,
    jurisdictionCode: value.jurisdictionCode,
    status: value.status as OpportunityStatus,
    closesOn: value.closesOn,
    revisionId: value.revisionId,
    savedAt: new Date(value.savedAt).toISOString(),
  };
}

/** Strict schema: unknown versions and malformed fields cannot enter storage. */
export function parseTrackerDocument(json: string): TrackerDocument {
  if (new TextEncoder().encode(json).length > TRACKER_MAX_BYTES) throw new Error("Tracker file is too large.");
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new Error("Tracker file is not valid JSON."); }
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.entries) || value.entries.length > TRACKER_MAX_ITEMS) {
    throw new Error("Tracker file has an unsupported version or too many entries.");
  }
  const entries = value.entries.map(parseEntry);
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new Error("Tracker file contains duplicate opportunities.");
  return { version: 1, entries };
}

export function trackerDocument(entries: readonly TrackedOpportunity[]): TrackerDocument {
  if (entries.length > TRACKER_MAX_ITEMS) throw new Error("Tracker is full.");
  return parseTrackerDocument(JSON.stringify({ version: 1, entries }));
}

/** Import merges by id; newer saved snapshot wins. */
export function mergeTracker(existing: readonly TrackedOpportunity[], incoming: readonly TrackedOpportunity[]): TrackedOpportunity[] {
  const combined = new Map(existing.map((entry) => [entry.id, entry]));
  for (const entry of incoming) {
    const prior = combined.get(entry.id);
    if (!prior || entry.savedAt > prior.savedAt) combined.set(entry.id, entry);
  }
  return trackerDocument([...combined.values()]).entries;
}

export function snapshotOpportunity(item: OpportunityCycle, now: Date = new Date()): TrackedOpportunity {
  return parseEntry({
    id: item.id,
    title: item.title.slice(0, 250),
    jurisdictionCode: item.jurisdictionCode,
    status: item.status,
    closesOn: item.applicationWindow.closesOn,
    revisionId: approvedRevision(item),
    savedAt: now.toISOString(),
  });
}

export type TrackerComparison = "unchanged" | "verified-change" | "now-reviewed" | "awaiting-review" | "source-unavailable";

export function compareTracked(saved: TrackedOpportunity, current: OpportunityCycle | null): TrackerComparison {
  if (!current) return "source-unavailable";
  const currentRevision = approvedRevision(current);
  if (!currentRevision) return "awaiting-review";
  if (!saved.revisionId) return "now-reviewed";
  return currentRevision === saved.revisionId ? "unchanged" : "verified-change";
}

export function readTracker(storage: Pick<Storage, "getItem">): TrackerDocument {
  const value = storage.getItem(TRACKER_KEY);
  return value ? parseTrackerDocument(value) : { version: 1, entries: [] };
}

export function writeTracker(storage: Pick<Storage, "setItem">, entries: readonly TrackedOpportunity[]): void {
  const value = JSON.stringify(trackerDocument(entries));
  if (new TextEncoder().encode(value).length > TRACKER_MAX_BYTES) throw new Error("Tracker storage limit reached.");
  storage.setItem(TRACKER_KEY, value);
}
