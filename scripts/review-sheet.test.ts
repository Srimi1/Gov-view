import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { OpportunityCycle } from "../lib/opportunities.ts";
import { approvalRevisions } from "../lib/review.server.ts";
import { makeReviewDecision } from "../connectors/review-approval.ts";
import { renderReviewSheet } from "./review-sheet.ts";

const packet = JSON.parse(readFileSync(new URL("../data/review/in-dh-recruitment.json", import.meta.url), "utf8")) as {
  sourceId: string; reviewStatus: string; collectedAt: string; cycles: OpportunityCycle[]; warnings: string[];
  approvalRevisions: Record<string, { evidenceRevision: string; recordRevision: string }>;
};
const cycle = packet.cycles[0];

test("review sheet exposes exact proposal, sources and unresolved decision without approving it", () => {
  const sheet = renderReviewSheet(packet, cycle, null);
  assert.match(sheet, /Pending draft\. No approval or publication/);
  assert.match(sheet, /first publication check/i);
  assert.match(sheet, /Plastic Engineering/);
  assert.match(sheet, /citizenshipRule/);
  assert.match(sheet, /Retained hash/);
  assert.match(sheet, new RegExp(approvalRevisions(cycle).recordRevision));
  assert.doesNotMatch(sheet, /reviewedAt.*2026/);
});

test("review sheet compares only a valid prior approval and rejects changed packet revisions", () => {
  const old = { ...cycle, title: "Earlier approved title" };
  const reviewed = { ...old, reviewDecision: makeReviewDecision(old, {
    reviewer: "Founder", reason: "Checked original notice and amendment", evidenceSummary: "Exact official PDF and register read", minutesSpent: 12,
    ...approvalRevisions(old),
  }, new Date("2026-09-24T10:00:00Z")) };
  const sheet = renderReviewSheet(packet, cycle, reviewed);
  assert.match(sheet, /Earlier approved title/);
  assert.match(sheet, /proposed field groups changed/);
  assert.throws(() => renderReviewSheet(packet, cycle, old), /Previous revision must be approved/);
  const drift = { ...packet, approvalRevisions: { ...packet.approvalRevisions, [cycle.id]: { ...packet.approvalRevisions[cycle.id], recordRevision: "0".repeat(64) } } };
  assert.throws(() => renderReviewSheet(drift, cycle, null), /revisions do not match/);
  assert.throws(() => renderReviewSheet({ ...packet, approvalRevisions: {} }, cycle, null), /revisions do not match/);
});

test("untrusted source text stays inert in local Markdown", () => {
  const hostile = { ...cycle, title: "<script>alert(1)</script> [click](javascript:alert(1))" };
  const isolated = { ...packet, cycles: [hostile], approvalRevisions: { [hostile.id]: approvalRevisions(hostile) } };
  const sheet = renderReviewSheet(isolated, hostile, null);
  assert.doesNotMatch(sheet, /<script>/);
  assert.doesNotMatch(sheet, /\[click\]\(javascript:/);
  assert.match(sheet, /&lt;script&gt;/);
});
