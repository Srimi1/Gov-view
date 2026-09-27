/**
 * Merging a fresh collection run into the published records for one source.
 *
 * Rules (from the product spec):
 * - Disappearing from a source never means "cancelled". Records that vanish
 *   before their deadline become "being checked" with a note, and are dropped
 *   only after 30 days.
 * - A failed or partial run keeps every existing record. Source health is
 *   reported separately and cannot alter an authoritative notice status.
 * - Every material change is appended to the record's history.
 * - Reviewer overrides (data/overrides/<id>.json) always win over collected fields.
 */
import type { OpportunityChange, OpportunityCycle } from "../lib/opportunities.ts";
import { daysBetween } from "../lib/time.ts";
import { isApprovedCycle } from "../lib/review.server.ts";

const KEEP_MISSING_DAYS = 30;
const KEEP_CLOSED_DAYS = 30;

function describeChanges(previous: OpportunityCycle, next: OpportunityCycle, at: string): OpportunityChange[] {
  const changes: OpportunityChange[] = [];
  const before = previous.applicationWindow.closesOn;
  const after = next.applicationWindow.closesOn;
  if (before !== after) {
    if (before && after && after > before) changes.push({ at, kind: "extended", summary: `Last date moved from ${before} to ${after}.` });
    else changes.push({ at, kind: "updated", summary: `Last date changed from ${before ?? "not given"} to ${after ?? "not given"}.` });
  }
  if (previous.applicationWindow.opensOn !== next.applicationWindow.opensOn) {
    changes.push({ at, kind: "updated", summary: `Opening date changed to ${next.applicationWindow.opensOn ?? "not given"}.` });
  }
  if (previous.status !== next.status && next.status === "cancelled") changes.push({ at, kind: "cancelled", summary: "The source marked this as cancelled." });
  if (JSON.stringify(previous.rules) !== JSON.stringify(next.rules)) changes.push({ at, kind: "eligibility", summary: "Eligibility criteria changed." });
  if (previous.title !== next.title) changes.push({ at, kind: "updated", summary: `Title changed from "${previous.title}".` });
  return changes;
}

export function applyOverride(cycle: OpportunityCycle, override: Partial<OpportunityCycle> | undefined): OpportunityCycle {
  if (!override) return cycle;
  if (override.id && override.id !== cycle.id) throw new Error(`Override cannot change opportunity id ${cycle.id}`);
  if (override.sourceId && override.sourceId !== cycle.sourceId) throw new Error(`Override cannot change source id ${cycle.sourceId}`);
  return {
    ...cycle,
    ...override,
    applicationWindow: { ...cycle.applicationWindow, ...(override.applicationWindow ?? {}) },
    changes: cycle.changes,
  };
}

/** Only an exact, recorded approval can advance a published opportunity. */
export function splitForPublication(raw: OpportunityCycle[], previous: OpportunityCycle[], sourceId: string, overrides: Map<string, Partial<OpportunityCycle>>) {
  const oldById = new Map(previous.map((item) => [item.id, item]));
  const approved: OpportunityCycle[] = [];
  const pending: OpportunityCycle[] = [];
  for (const item of raw) {
    const old = oldById.get(item.id);
    const candidate = applyOverride({ ...item, sourceId, reviewDecision: old?.reviewDecision }, overrides.get(item.id));
    if (isApprovedCycle(candidate)) {
      const reviewedAt = candidate.reviewDecision!.reviewedAt!;
      approved.push({
        ...candidate,
        lastVerifiedAt: reviewedAt,
        sources: candidate.sources.map((source) => source.fetchStatus === "fetched"
          ? { ...source, lastValidatedAt: reviewedAt, verificationStatus: "verified" }
          : source),
      });
    } else pending.push(candidate);
  }
  return { approved, pending };
}

export interface MergeInput {
  sourceId: string;
  previous: OpportunityCycle[];
  fresh: OpportunityCycle[];
  overrides: Map<string, Partial<OpportunityCycle>>;
  now: Date;
  today: (item: OpportunityCycle) => string;
  /** Only a complete source snapshot can establish that an older record vanished. */
  snapshotComplete?: boolean;
}

export function mergeSuccessfulRun({ sourceId, previous, fresh, overrides, now, today, snapshotComplete = true }: MergeInput): OpportunityCycle[] {
  const at = now.toISOString();
  const previousById = new Map(previous.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const merged: OpportunityCycle[] = [];

  for (const raw of fresh) {
    if (seen.has(raw.id)) continue;
    seen.add(raw.id);
    const next = applyOverride({ ...raw, sourceId, sourceMissingSince: null }, overrides.get(raw.id));
    const old = previousById.get(raw.id) ?? raw.legacyIds?.map((id) => previousById.get(id)).find(Boolean);
    if (old) seen.add(old.id);
    if (!old) {
      merged.push({ ...next, changes: [{ at, kind: "created", summary: "First seen at the official source." }] });
      continue;
    }
    const history = [...old.changes, ...describeChanges(old, next, at)].slice(-20);
    merged.push({ ...next, changes: history });
  }

  for (const old of previous) {
    if (seen.has(old.id)) continue;
    if (!snapshotComplete || old.status === "cancelled") { merged.push(old); continue; }
    const date = today(old);
    const closes = old.applicationWindow.closesOn;
    if (closes && closes < date) {
      // Closed normally: keep briefly so people can see it closed, then drop.
      if (daysBetween(closes, date) <= KEEP_CLOSED_DAYS) merged.push({ ...old, status: "closed" });
      continue;
    }
    const missingSince = old.sourceMissingSince ?? null;
    if (missingSince && daysBetween(missingSince.slice(0, 10), date) > KEEP_MISSING_DAYS) continue;
    merged.push({
      ...old,
      status: "uncertain",
      statusNote: `No longer listed at the source since ${(missingSince ?? at).slice(0, 10)}. It may have been filled, withdrawn or moved — check the official notice before relying on it.`,
      sourceMissingSince: missingSince ?? at,
    });
  }
  return merged.sort((a, b) => a.id.localeCompare(b.id));
}

export function markFailedRun(previous: OpportunityCycle[], consecutiveFailures: number, lastSuccess: string | null): OpportunityCycle[] {
  void consecutiveFailures;
  void lastSuccess;
  return previous;
}

/** Keep one exact approved revision per ID, independent of pending collection. */
export function retainApprovedSnapshots(existing: OpportunityCycle[], candidates: OpportunityCycle[]): OpportunityCycle[] {
  const retained = new Map<string, OpportunityCycle>();
  for (const cycle of [...existing, ...candidates]) {
    if (!isApprovedCycle(cycle)) continue;
    const prior = retained.get(cycle.id);
    // A repeated collection may update fetch metadata without a new review.
    // Keep the original snapshot bytes until a later human decision exists.
    if (!prior || Date.parse(cycle.reviewDecision!.reviewedAt!) > Date.parse(prior.reviewDecision!.reviewedAt!)) {
      retained.set(cycle.id, cycle);
    }
  }
  return [...retained.values()].sort((a, b) => a.id.localeCompare(b.id));
}
