import type { OpportunityCycle } from "./opportunities.ts";
import { approvalRevisions, isApprovedCycle } from "./review.server.ts";

/** Public data contains only current approvals or exact, previously approved snapshots. */
export function selectPublicRecords(current: OpportunityCycle[], approvedSnapshots: OpportunityCycle[]): OpportunityCycle[] {
  const snapshots = new Map<string, OpportunityCycle>();
  for (const record of approvedSnapshots) {
    if (!isApprovedCycle(record)) throw new Error(`Invalid approved snapshot: ${record.id}`);
    if (snapshots.has(record.id)) throw new Error(`Duplicate approved snapshot: ${record.id}`);
    snapshots.set(record.id, record);
  }

  const result: OpportunityCycle[] = [];
  const seen = new Set<string>();
  const exported = (record: OpportunityCycle, reviewPending: boolean): OpportunityCycle => ({
    ...record,
    evidenceRevision: approvalRevisions(record).evidenceRevision,
    publicationApproved: !reviewPending,
    reviewPending,
  });
  for (const record of current) {
    if (seen.has(record.id)) throw new Error(`Duplicate current cycle: ${record.id}`);
    seen.add(record.id);
    if (isApprovedCycle(record)) result.push(exported(record, false));
    else {
      const snapshot = snapshots.get(record.id);
      if (snapshot) result.push(exported(snapshot, true));
    }
    snapshots.delete(record.id);
  }
  // Source disappearance or a partial fetch cannot erase an approved version.
  for (const snapshot of snapshots.values()) result.push(exported(snapshot, true));
  return result;
}
