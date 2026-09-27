import assert from "node:assert/strict";
import test from "node:test";
import { demoOpportunities, type OpportunityCycle } from "./opportunities.ts";
import { approvalRevisions, isApprovedCycle } from "./review.server.ts";

function approved(): OpportunityCycle {
  const item: OpportunityCycle = {
    ...demoOpportunities[0], fixture: false, status: "open", statusNote: "",
    sources: [{ ...demoOpportunities[0].sources[0], url: "https://example.gov/notice", sha256: "a".repeat(64), fetchStatus: "fetched" }],
    changes: [],
  };
  item.reviewDecision = { status: "approved", reviewer: "test reviewer", reviewedAt: "2026-09-25T12:00:00Z", minutesSpent: 2, ...approvalRevisions(item) };
  return item;
}

test("material notice changes and cancellation require new approval", () => {
  const item = approved();
  assert.equal(isApprovedCycle(item), true);
  assert.equal(isApprovedCycle({ ...item, changes: [{ at: "2026-09-26", kind: "extended", summary: "Deadline extended." }] }), false);
  assert.equal(isApprovedCycle({ ...item, status: "cancelled", statusNote: "Authority cancelled exam." }), false);
  assert.equal(isApprovedCycle({ ...item, status: "closed" }), true, "calendar passage alone does not revoke approval");
});

test("source failure and ambiguous legacy updated history do not create notice revisions", () => {
  const item = approved();
  assert.equal(isApprovedCycle({ ...item, changes: [{ at: "2026-09-26", kind: "source-failure", summary: "HTTP 503" }] }), true);
  assert.equal(isApprovedCycle({ ...item, changes: [{ at: "2026-09-26", kind: "updated", summary: "Legacy uncertain change" }] }), true);
  assert.equal(isApprovedCycle({ ...item, sources: [{ ...item.sources[0], sha256: "b".repeat(64) }] }), false);
});

test("post-specific language wording needs new approval", () => {
  const item = approved();
  assert.equal(isApprovedCycle({ ...item, languageNote: "Class X local language required by chosen post." }), false);
  const withLanguage = { ...item, languageNote: "Class X local language required by chosen post." };
  withLanguage.reviewDecision = { ...item.reviewDecision!, ...approvalRevisions(withLanguage) };
  assert.equal(isApprovedCycle(withLanguage), true);
  assert.equal(isApprovedCycle({ ...withLanguage, languageNote: "Class XII local language required by chosen post." }), false);
});

test("changing application from online to postal requires fresh approval", () => {
  const item = approved();
  assert.equal(isApprovedCycle({ ...item, applicationMethod: "post" }), false);
});

test("changing appointment type requires fresh approval", () => {
  const item = approved();
  assert.equal(isApprovedCycle(item), true);
  assert.equal(isApprovedCycle({ ...item, appointmentType: "contract" }), false);
});

test("changing work location requires fresh approval", () => {
  const item = approved();
  assert.equal(isApprovedCycle({ ...item, workLocations: ["Example school, London"] }), false);
});

test("reviewer and review time must be real", () => {
  const item = approved();
  assert.equal(isApprovedCycle({ ...item, reviewDecision: { ...item.reviewDecision!, reviewedAt: "not-a-date" } }), false);
  assert.equal(isApprovedCycle({ ...item, reviewDecision: { ...item.reviewDecision!, reviewer: "   " } }), false);
  assert.equal(isApprovedCycle({ ...item, reviewDecision: { ...item.reviewDecision!, minutesSpent: -1 } }), false);
});
