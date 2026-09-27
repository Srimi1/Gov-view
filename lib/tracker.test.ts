import assert from "node:assert/strict";
import test from "node:test";
import { demoOpportunities, type OpportunityCycle } from "./opportunities.ts";
import { compareTracked, mergeTracker, parseTrackerDocument, readTracker, snapshotOpportunity, trackerDocument, writeTracker } from "./tracker.ts";

const sample = () => snapshotOpportunity(demoOpportunities[0], new Date("2026-09-25T10:00:00Z"));

test("tracker JSON round-trips without applicant profile data", () => {
  const document = trackerDocument([sample()]);
  assert.deepEqual(parseTrackerDocument(JSON.stringify(document)), document);
  assert.equal(JSON.stringify(document).includes("dateOfBirth"), false);
});

test("tracker import rejects malformed entries, duplicate ids, and oversized files", () => {
  assert.throws(() => parseTrackerDocument("no"), /valid JSON/);
  assert.throws(() => parseTrackerDocument(JSON.stringify({ version: 2, entries: [] })), /unsupported version/);
  assert.throws(() => parseTrackerDocument(JSON.stringify({ version: 1, entries: [sample(), sample()] })), /duplicate/);
  assert.throws(() => parseTrackerDocument(" ".repeat(250_001)), /too large/);
});

test("merge keeps newer snapshot; unavailable source differs from verified change", () => {
  const older = sample();
  const newer = { ...older, savedAt: "2026-09-26T10:00:00.000Z", status: "closed" as const };
  assert.deepEqual(mergeTracker([older], [newer]), [newer]);
  assert.equal(compareTracked(older, null), "source-unavailable");
  const current = { ...demoOpportunities[0], fixture: false, publicationApproved: true, evidenceRevision: "b".repeat(64), reviewDecision: { status: "approved" as const, evidenceRevision: "b".repeat(64), recordRevision: "c".repeat(64), reviewer: "Reviewer", reviewedAt: "2026-09-26T10:00:00Z" } } satisfies OpportunityCycle;
  assert.equal(compareTracked(older, current), "now-reviewed");
});

test("local tracker saves and clears; storage failures stay visible", () => {
  let value: string | null = null;
  const storage = { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
  writeTracker(storage, [sample()]);
  assert.equal(readTracker(storage).entries.length, 1);
  writeTracker(storage, []);
  assert.deepEqual(readTracker(storage).entries, []);
  assert.throws(() => writeTracker({ setItem: () => { throw new Error("QuotaExceededError"); } }, [sample()]), /QuotaExceededError/);
});
