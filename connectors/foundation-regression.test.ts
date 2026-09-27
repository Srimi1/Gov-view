import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { ssc } from "./ssc.ts";
import { usajobs } from "./usajobs.ts";
import { parseRobots, politeFetchBytes, retryAfterDelay, robotsAllows } from "./http.ts";
import { clockTime, evidenceSource } from "./util.ts";
import { mergeSuccessfulRun, retainApprovedSnapshots, splitForPublication } from "./merge.ts";
import type { Evidence, SourceConfig } from "./types.ts";
import type { OpportunityCycle } from "../lib/opportunities.ts";
import { approvalRevisions } from "../lib/review.server.ts";
import { makeReviewDecision } from "./review-approval.ts";
import { approveStagedCandidate, verifyRetainedEvidence } from "../scripts/approve-review.ts";

const source: SourceConfig = { id: "in-ssc", name: "SSC", country: "IN", authority: "Staff Selection Commission", homepage: "https://ssc.gov.in", connector: "ssc", cadenceHours: 24, licence: "", enabled: true };
const evidence: Evidence = { url: "https://ssc.gov.in/api/calendar", fetchedAt: "2026-09-24T10:00:00Z", sha256: "a".repeat(64), contentType: "application/json", bytes: 10 };

test("SSC annual editions keep distinct IDs and tentative dates never open applications", async () => {
  const title = "Combined Graduate Level Examination for appointments to posts across ministries, departments and attached offices";
  const result = await ssc({ source, now: new Date("2026-10-15T12:00:00Z"), env: {}, log: () => {}, fetchText: async () => ({ evidence, text: JSON.stringify({ statusCode: "200", data: [
    { id: "cgl-2026", headline: `${title} 2026`, examYear: "2026", startDate: "2026-10-01", endDate: "2026-10-31" },
    { id: "cgl-2027", headline: `${title} 2027`, examYear: "2027", startDate: "2026-10-01", endDate: "2026-10-31" },
  ] }) }) });
  assert.equal(new Set(result.cycles.map((cycle) => cycle.id)).size, 2);
  for (const cycle of result.cycles) {
    assert.notEqual(cycle.status, "open");
    assert.equal(cycle.applicationWindow.opensOn, null);
    assert.equal(cycle.applicationWindow.closesOn, null);
    assert.equal(cycle.applicationUrl, null);
  }
});

test("linked document never inherits fetched page hash or validation timestamp", () => {
  const link = evidenceSource(source, evidence, "Notification", "PDF", "English", "https://ssc.gov.in/notice.pdf");
  assert.equal(link.sha256, undefined);
  assert.equal(link.lastSuccessfulFetchAt, null);
  assert.equal(link.lastValidatedAt, null);
});

test("invalid minute values cannot become application cutoffs", () => {
  assert.equal(clockTime("18:99"), null);
  assert.equal(clockTime("13:00pm"), null);
  assert.equal(clockTime("6:00pm"), "18:00");
});

test("robots explicit Allow wins equal or shorter matching Disallow", () => {
  const rules = parseRobots("User-agent: *\nDisallow: /public\nAllow: /public/jobs\nDisallow: /public/jobs/private\n");
  assert.equal(robotsAllows(rules, "/public/jobs"), true);
  assert.equal(robotsAllows(rules, "/public/jobs/private"), false);
  assert.equal(parseRobots("User-agent: OtherBot\nDisallow: /" ).length, 0);
  assert.equal(robotsAllows(parseRobots("User-agent: *\nDisallow: /\nUser-agent: GOVView\nAllow: /public"), "/public"), true);
});

test("Retry-After is parsed and bounded for free runner budgets", () => {
  assert.equal(retryAfterDelay("5"), 5000);
  assert.equal(retryAfterDelay("3600"), 30000);
  assert.equal(retryAfterDelay("not-a-date"), null);
});

test("concurrent requests to one host reserve separate one-second slots", async () => {
  const originalFetch = globalThis.fetch;
  const starts: number[] = [];
  globalThis.fetch = async () => {
    starts.push(Date.now());
    return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
  };
  try {
    await Promise.all([
      politeFetchBytes("https://rate-limit-test.example.gov/a", { ignoreRobotsFor: ["rate-limit-test.example.gov"] }),
      politeFetchBytes("https://rate-limit-test.example.gov/b", { ignoreRobotsFor: ["rate-limit-test.example.gov"] }),
    ]);
    assert.equal(starts.length, 2);
    assert.ok(starts[1] - starts[0] >= 900, `${starts[1] - starts[0]} ms`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const record = (id: string, extra: Partial<OpportunityCycle> = {}): OpportunityCycle => ({
  id, fixture: false, title: id, cycleLabel: "", programme: "", authority: "", pathway: "recruitment", status: "open", statusNote: "",
  jurisdictionCode: "IN", jurisdictionName: "India", scopeLabel: "", outcome: "",
  applicationWindow: { opensOn: null, closesOn: "2026-11-30", officialTimeZone: "Asia/Kolkata", cutoffLocalTime: null, precision: "date" },
  qualifications: "", citizenshipRule: "", residenceRule: "", selectionStages: [], fee: "", rules: null, venues: [], sources: [],
  lastVerifiedAt: null, applicationUrl: null, changes: [], ...extra,
});

test("incomplete snapshots preserve absent records; cancelled records remain cancelled", () => {
  const now = new Date("2026-09-24T06:00:00Z");
  const previous = [record("absent"), record("cancelled", { status: "cancelled" })];
  const result = mergeSuccessfulRun({ sourceId: "s", previous, fresh: [], overrides: new Map(), now, today: () => "2026-09-24", snapshotComplete: false });
  assert.equal(result.find((cycle) => cycle.id === "absent")?.status, "open");
  assert.equal(result.find((cycle) => cycle.id === "cancelled")?.status, "cancelled");
});

test("disappearance timer resets after reappearance", () => {
  const now = new Date("2026-10-20T06:00:00Z");
  const previous = [record("cycle", { changes: [{ at: "2026-09-01T00:00:00Z", kind: "updated", summary: "No longer listed at the source." }, { at: "2026-09-10T00:00:00Z", kind: "updated", summary: "Listed at the source again." }] })];
  const result = mergeSuccessfulRun({ sourceId: "s", previous, fresh: [], overrides: new Map(), now, today: () => "2026-10-20", snapshotComplete: true });
  assert.equal(result.length, 1);
  assert.equal(result[0].status, "uncertain");
  assert.match(result[0].statusNote, /2026-10-20/);
});

test("USAJOBS cap reports partial snapshot and available total", async () => {
  const usSource = { ...source, id: "us-usajobs", country: "US", maxRecords: 1 };
  const result = await usajobs({ source: usSource, now: new Date("2026-09-24"), env: { USAJOBS_API_KEY: "test-key", USAJOBS_EMAIL: "test@example.com" }, log: () => {}, fetchText: async () => ({ evidence, text: JSON.stringify({ SearchResult: { SearchResultItems: [
    { MatchedObjectDescriptor: { PositionID: "1", PositionTitle: "Role 1", PositionURI: "https://www.usajobs.gov/job/1" } },
    { MatchedObjectDescriptor: { PositionID: "2", PositionTitle: "Role 2", PositionURI: "https://www.usajobs.gov/job/2" } },
  ], UserArea: { NumberOfPages: "2", SearchResultCountAll: "501" } } }) }) });
  assert.equal(result.cycles.length, 1);
  assert.equal(result.complete, false);
  assert.equal(result.totalAvailable, 501);
  assert.ok(result.continuation);
});

test("publication requires exact reviewer decision; changed evidence returns to review", () => {
  const raw = record("exam", { sources: [evidenceSource(source, evidence, "Notice", "JSON", "English")] });
  const noReview = splitForPublication([raw], [], source.id, new Map());
  assert.equal(noReview.approved.length, 0);
  assert.equal(noReview.pending.length, 1);

  const revisions = approvalRevisions({ ...raw, sourceId: source.id });
  const decision = { status: "approved" as const, reviewer: "Example Reviewer", reviewedAt: "2026-09-25T12:00:00Z", minutesSpent: 5, ...revisions };
  const approved = splitForPublication([raw], [], source.id, new Map([[raw.id, { reviewDecision: decision }]]));
  assert.equal(approved.approved.length, 1);
  assert.equal(approved.pending.length, 0);
  assert.equal(approved.approved[0].lastVerifiedAt, decision.reviewedAt);
  assert.equal(approved.approved[0].sources[0].verificationStatus, "verified");

  const changed = { ...raw, sources: [{ ...raw.sources[0], sha256: "b".repeat(64) }] };
  const staleDecision = splitForPublication([changed], [], source.id, new Map([[raw.id, { reviewDecision: decision }]]));
  assert.equal(staleDecision.approved.length, 0);
  assert.equal(staleDecision.pending.length, 1);
});

test("unchanged bulk-feed item keeps approval when unrelated page bytes change", () => {
  const firstSource = { ...evidenceSource(source, evidence, "Feed item", "JSON", "English", "https://ssc.gov.in/item/42"), itemSha256: "c".repeat(64) };
  const raw = record("item-42", { sources: [firstSource] });
  const revisions = approvalRevisions({ ...raw, sourceId: source.id });
  const decision = { status: "approved" as const, reviewer: "Example Reviewer", reviewedAt: "2026-09-25T12:00:00Z", ...revisions };
  const latestEvidence = { ...evidence, sha256: "d".repeat(64), fetchedAt: "2026-09-26T12:00:00Z" };
  const changedPageSource = { ...evidenceSource(source, latestEvidence, "Feed item", "JSON", "English", "https://ssc.gov.in/item/42"), itemSha256: "c".repeat(64) };
  const next = record("item-42", { sources: [changedPageSource] });
  const result = splitForPublication([next], [record("item-42", { ...raw, reviewDecision: decision })], source.id, new Map());
  assert.equal(result.approved.length, 1);
  assert.equal(result.pending.length, 0);
});

test("human approval records exact staged revisions and rejects stale or linked-only evidence", () => {
  const candidate = record("exam", { sources: [evidenceSource(source, evidence, "Notice", "JSON", "English")], sourceId: source.id });
  const revisions = approvalRevisions(candidate);
  const attestation = { reviewer: "Human Reviewer", reason: "Checked application date against official notice", evidenceSummary: "Official JSON notice and its exact fetched hash", minutesSpent: 7, ...revisions };
  const decision = makeReviewDecision(candidate, attestation, new Date("2026-09-25T12:00:00Z"));
  assert.equal(decision.reviewedAt, "2026-09-25T12:00:00.000Z");
  assert.equal(decision.evidenceSummary, attestation.evidenceSummary);
  const approved = approveStagedCandidate({ sourceId: source.id, reviewStatus: "pending", cycles: [candidate] }, candidate.id, {}, attestation, new Date("2026-09-25T12:00:00Z"));
  assert.equal(approved.override.reviewDecision?.status, "approved");
  assert.throws(() => makeReviewDecision(candidate, { ...attestation, evidenceRevision: "0".repeat(64) }, new Date()), /changed since review/);
  assert.throws(() => makeReviewDecision(record("linked", { sources: [evidenceSource(source, evidence, "PDF", "PDF", "English", "https://ssc.gov.in/notice.pdf")] }), attestation, new Date()), /No exact-byte fetched evidence/);
  assert.throws(() => makeReviewDecision(candidate, { ...attestation, minutesSpent: 0 }, new Date()), /Actual review minutes/);
});

test("approval checks decompressed retained bytes against fetched hash", () => {
  const directory = mkdtempSync(join(tmpdir(), "govview-review-test-"));
  const bytes = Buffer.from("official notice fixture");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const bodyDir = join(directory, "data/evidence/bodies", source.id);
  mkdirSync(bodyDir, { recursive: true });
  const file = join(bodyDir, `${sha256}.txt.gz`);
  const fetched = { ...evidence, sha256, bytes: bytes.length };
  const cycle = record("exam", { sources: [evidenceSource(source, fetched, "Notice", "JSON", "English")] });
  try {
    writeFileSync(file, gzipSync(bytes));
    assert.doesNotThrow(() => verifyRetainedEvidence(directory, source.id, cycle));
    writeFileSync(file, gzipSync(Buffer.from("changed")));
    assert.throws(() => verifyRetainedEvidence(directory, source.id, cycle), /hash mismatch/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("approved snapshot survives pending revision and updates only after new exact approval", () => {
  const old = record("exam", { title: "Exam 2026", sources: [evidenceSource(source, evidence, "Notice", "JSON", "English")] });
  const oldRevision = approvalRevisions(old);
  const approvedOld = { ...old, reviewDecision: { status: "approved" as const, reviewer: "Reviewer", reviewedAt: "2026-09-25T10:00:00Z", ...oldRevision } };
  const pending = record("exam", { title: "Exam 2026 amended", sources: [{ ...old.sources[0], sha256: "b".repeat(64) }] });
  assert.deepEqual(retainApprovedSnapshots([], [approvedOld]), [approvedOld]);
  assert.deepEqual(retainApprovedSnapshots([approvedOld], [pending]), [approvedOld]);
  const refreshedWithoutReview = { ...approvedOld, sources: [{ ...approvedOld.sources[0], lastSuccessfulFetchAt: "2026-09-26T10:00:00Z" }] };
  assert.deepEqual(retainApprovedSnapshots([approvedOld], [refreshedWithoutReview]), [approvedOld]);
  assert.deepEqual(retainApprovedSnapshots([pending], []), []);
  const newRevision = approvalRevisions(pending);
  const approvedNew = { ...pending, reviewDecision: { status: "approved" as const, reviewer: "Reviewer", reviewedAt: "2026-09-26T10:00:00Z", ...newRevision } };
  assert.deepEqual(retainApprovedSnapshots([approvedOld], [approvedNew]), [approvedNew]);
});
