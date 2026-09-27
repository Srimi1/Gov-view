import assert from "node:assert/strict";
import test from "node:test";
import { demoOpportunities, type OpportunityCycle } from "./opportunities.ts";
import { selectPublicRecords } from "./publication.server.ts";
import { approvalRevisions } from "./review.server.ts";

function approved(): OpportunityCycle {
  const record: OpportunityCycle = {
    ...demoOpportunities[0], fixture: false, status: "open", statusNote: "", changes: [],
    sources: [{ ...demoOpportunities[0].sources[0], url: "https://example.gov/notice", sha256: "a".repeat(64), fetchStatus: "fetched" }],
  };
  record.reviewDecision = { status: "approved", reviewer: "test reviewer", reviewedAt: "2026-09-25T12:00:00Z", minutesSpent: 3, ...approvalRevisions(record) };
  return record;
}

test("unreviewed current revisions never enter public shards", () => {
  const old = approved();
  const changed = { ...old, applicationWindow: { ...old.applicationWindow, closesOn: "2026-12-31" } };
  assert.deepEqual(selectPublicRecords([changed], []), []);
  const [previous] = selectPublicRecords([changed], [old]);
  assert.equal(previous.applicationWindow.closesOn, old.applicationWindow.closesOn);
  assert.equal(previous.reviewPending, true);
  assert.equal(previous.publicationApproved, false);
});

test("current approval supersedes snapshot; disappearance retains previous version", () => {
  const old = approved();
  const current = { ...old, title: "New title" };
  current.reviewDecision = { ...old.reviewDecision!, reviewedAt: "2026-09-26T12:00:00Z", ...approvalRevisions(current) };
  const [published] = selectPublicRecords([current], [old]);
  assert.equal(published.title, "New title");
  assert.equal(published.publicationApproved, true);
  assert.equal(published.reviewPending, false);
  const [missing] = selectPublicRecords([], [old]);
  assert.equal(missing.reviewPending, true);
});

test("invalid or duplicate snapshots cannot leak into public data", () => {
  const old = approved();
  assert.throws(() => selectPublicRecords([], [{ ...old, title: "altered" }]), /Invalid approved snapshot/);
  assert.throws(() => selectPublicRecords([], [old, old]), /Duplicate approved snapshot/);
});
