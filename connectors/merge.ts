/**
 * Merging a fresh collection run into the published records for one source.
 *
 * Rules (from the product spec):
 * - Disappearing from a source never means "cancelled". Records that vanish
 *   before their deadline become "being checked" with a note, and are dropped
 *   only after 30 days.
 * - A failed run keeps every existing record; after two failures in a row
 *   open records are marked "not rechecked recently" (stale).
 * - Every material change is appended to the record's history.
 * - Reviewer overrides (data/overrides/<id>.json) always win over collected fields.
 */
import type { OpportunityChange, OpportunityCycle } from "../lib/opportunities.ts";
import { daysBetween } from "../lib/time.ts";

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
  return {
    ...cycle,
    ...override,
    applicationWindow: { ...cycle.applicationWindow, ...(override.applicationWindow ?? {}) },
    changes: cycle.changes,
  };
}

export interface MergeInput {
  sourceId: string;
  previous: OpportunityCycle[];
  fresh: OpportunityCycle[];
  overrides: Map<string, Partial<OpportunityCycle>>;
  now: Date;
  today: (item: OpportunityCycle) => string;
}

export function mergeSuccessfulRun({ sourceId, previous, fresh, overrides, now, today }: MergeInput): OpportunityCycle[] {
  const at = now.toISOString();
  const previousById = new Map(previous.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const merged: OpportunityCycle[] = [];

  for (const raw of fresh) {
    if (seen.has(raw.id)) continue;
    seen.add(raw.id);
    const next = applyOverride({ ...raw, sourceId }, overrides.get(raw.id));
    const old = previousById.get(raw.id);
    if (!old) {
      merged.push({ ...next, changes: [{ at, kind: "created", summary: "First seen at the official source." }] });
      continue;
    }
    const history = [...old.changes, ...describeChanges(old, next, at)].slice(-20);
    merged.push({ ...next, changes: history });
  }

  for (const old of previous) {
    if (seen.has(old.id)) continue;
    const date = today(old);
    const closes = old.applicationWindow.closesOn;
    if (closes && closes < date) {
      // Closed normally: keep briefly so people can see it closed, then drop.
      if (daysBetween(closes, date) <= KEEP_CLOSED_DAYS) merged.push({ ...old, status: old.status === "cancelled" ? "cancelled" : "closed" });
      continue;
    }
    const missingSince = old.changes.findLast((change) => change.summary.startsWith("No longer listed"))?.at;
    if (missingSince && daysBetween(missingSince.slice(0, 10), date) > KEEP_MISSING_DAYS) continue;
    merged.push({
      ...old,
      status: "uncertain",
      statusNote: `No longer listed at the source since ${(missingSince ?? at).slice(0, 10)}. It may have been filled, withdrawn or moved — check the official notice before relying on it.`,
      changes: missingSince ? old.changes : [...old.changes, { at, kind: "updated", summary: "No longer listed at the source." }],
    });
  }
  return merged.sort((a, b) => a.id.localeCompare(b.id));
}

export function markFailedRun(previous: OpportunityCycle[], consecutiveFailures: number, lastSuccess: string | null): OpportunityCycle[] {
  if (consecutiveFailures < 2) return previous;
  return previous.map((item) => (item.status === "open" || item.status === "extended" || item.status === "upcoming")
    ? { ...item, status: "stale", statusNote: `We couldn't recheck the source recently${lastSuccess ? ` (last successful check ${lastSuccess.slice(0, 10)})` : ""}. Confirm with the official notice.` }
    : item);
}
