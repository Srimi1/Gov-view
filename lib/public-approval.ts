import type { OpportunityCycle } from "./opportunities.ts";

/** Only a decision for the exact current evidence revision can be syndicated. */
export function approvedRevision(item: OpportunityCycle): string | null {
  const record = item as OpportunityCycle & {
    publicationApproved?: boolean;
  };
  if (record.fixture || record.publicationApproved !== true || !record.evidenceRevision ||
      record.reviewDecision?.status !== "approved" ||
      record.reviewDecision.evidenceRevision !== record.evidenceRevision ||
      !record.reviewDecision.recordRevision || !record.reviewDecision.reviewer || !record.reviewDecision.reviewedAt) return null;
  return record.evidenceRevision;
}
