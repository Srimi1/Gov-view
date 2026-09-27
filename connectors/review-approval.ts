import type { OpportunityCycle, ReviewDecision } from "../lib/opportunities.ts";
import { approvalRevisions } from "../lib/review.server.ts";

export interface ReviewAttestation {
  reviewer: string;
  reason: string;
  evidenceSummary: string;
  minutesSpent: number;
  evidenceRevision: string;
  recordRevision: string;
}

/** Builds a decision only for the exact staged candidate a human inspected. */
export function makeReviewDecision(cycle: OpportunityCycle, attestation: ReviewAttestation, now: Date): ReviewDecision {
  if (!attestation.reviewer.trim() || attestation.reviewer.trim().length < 2) throw new Error("Reviewer name required");
  if (attestation.reason.trim().length < 10) throw new Error("Review reason must describe the decision");
  if (attestation.evidenceSummary.trim().length < 10) throw new Error("Source and evidence summary required");
  if (!Number.isFinite(attestation.minutesSpent) || attestation.minutesSpent <= 0) throw new Error("Actual review minutes must be positive");
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid review time");
  if (!cycle.sources.some((source) => source.fetchStatus === "fetched" && !!source.fetchedUrl && /^[a-f0-9]{64}$/i.test(source.sha256 ?? ""))) {
    throw new Error("No exact-byte fetched evidence on staged candidate");
  }
  const revisions = approvalRevisions(cycle);
  if (attestation.evidenceRevision !== revisions.evidenceRevision || attestation.recordRevision !== revisions.recordRevision) {
    throw new Error("Staged candidate changed since review; inspect current evidence and record before approving");
  }
  return {
    status: "approved",
    reviewer: attestation.reviewer.trim(),
    reason: attestation.reason.trim(),
    evidenceSummary: attestation.evidenceSummary.trim(),
    minutesSpent: attestation.minutesSpent,
    reviewedAt: now.toISOString(),
    ...revisions,
  };
}
