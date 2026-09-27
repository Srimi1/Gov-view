import { createHash } from "node:crypto";
import type { OpportunityCycle } from "./opportunities.ts";

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** Stable input to approval: exclude fetch timestamps, derived open/closed status and source health. */
export function approvalRevisions(item: OpportunityCycle): { evidenceRevision: string; recordRevision: string } {
  const sourceDocuments = item.sources.map((source) => ({
    id: source.id,
    url: source.url,
    fetchedUrl: source.fetchedUrl ?? null,
    sha256: source.itemSha256 ?? source.sha256 ?? null,
    fetchStatus: source.fetchStatus ?? null,
  })).sort((a, b) => a.id.localeCompare(b.id));
  const evidenceRevision = digest(sourceDocuments);
  const materialChanges = item.changes.filter((change) =>
    change.kind === "created" || change.kind === "extended" || change.kind === "cancelled" || change.kind === "eligibility",
  ).map(({ at, kind, summary }) => ({ at, kind, summary }));
  const recordRevision = digest({
    title: item.title,
    cycleLabel: item.cycleLabel,
    programmeId: item.programmeId ?? null,
    programme: item.programme,
    authority: item.authority,
    pathway: item.pathway,
    ...(item.appointmentType ? { appointmentType: item.appointmentType } : {}),
    jurisdictionCode: item.jurisdictionCode,
    subdivisionCodes: item.subdivisionCodes ?? [],
    scopeLabel: item.scopeLabel,
    outcome: item.outcome,
    applicationWindow: item.applicationWindow,
    qualifications: item.qualifications,
    ...(item.languageNote !== undefined ? { languageNote: item.languageNote } : {}),
    citizenshipRule: item.citizenshipRule,
    residenceRule: item.residenceRule,
    selectionStages: item.selectionStages,
    fee: item.fee,
    structuredFees: item.structuredFees ?? [],
    requiredDocuments: item.requiredDocuments ?? [],
    imageRequirements: item.imageRequirements ?? [],
    examEvents: item.examEvents ?? [],
    syllabus: item.syllabus ?? null,
    salary: item.salary ?? null,
    rules: item.rules,
    ...(item.workLocations !== undefined ? { workLocations: item.workLocations } : {}),
    venues: item.venues,
    applicationUrl: item.applicationUrl,
    ...(item.applicationMethod ? { applicationMethod: item.applicationMethod } : {}),
    cancelled: item.status === "cancelled",
    // A notice-level status note can explain a cancellation or extension. Automatic
    // open -> closed date passage must not invalidate a previously approved notice.
    statusNote: item.status === "cancelled" || item.status === "extended" ? item.statusNote : null,
    materialChanges,
    evidenceRevision,
  });
  return { evidenceRevision, recordRevision };
}

/** No approval is inferred from presence in data/published/ or a successful fetch. */
export function isApprovedCycle(item: OpportunityCycle): boolean {
  if (item.fixture) return false;
  const decision = item.reviewDecision;
  if (!decision || decision.status !== "approved" || !decision.reviewer?.trim() || !decision.reviewedAt || !decision.recordRevision) return false;
  if (!Number.isFinite(Date.parse(decision.reviewedAt))) return false;
  if (decision.minutesSpent !== undefined && (!Number.isFinite(decision.minutesSpent) || decision.minutesSpent < 0)) return false;
  const revisions = approvalRevisions(item);
  return decision.evidenceRevision === revisions.evidenceRevision && decision.recordRevision === revisions.recordRevision;
}
