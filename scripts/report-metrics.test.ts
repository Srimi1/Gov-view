import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { demoOpportunities, type OpportunityCycle } from "../lib/opportunities.ts";
import { approvalRevisions } from "../lib/review.server.ts";
import { collectMetrics } from "./report-metrics.ts";

function write(root: string, path: string, value: unknown) {
  const target = join(root, path);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, typeof value === "string" ? value : JSON.stringify(value));
}

test("metrics count only current approved revisions and leave unaudited measures unavailable", () => {
  const root = mkdtempSync(join(tmpdir(), "govview-metrics-"));
  try {
    const now = new Date("2026-09-25T12:00:00Z");
    write(root, "data/reference/jurisdictions.json", { inventoryAsOf: "2026-09-24", jurisdictions: [{ code: "IN" }, { code: "US" }, { code: "FR" }, { code: "DE" }] });
    write(root, "sources/registry.json", { sources: [
      { id: "in", country: "IN", enabled: true, cadenceHours: 24 },
      { id: "us", country: "US", enabled: true, cadenceHours: 24 },
      { id: "fr", country: "FR", enabled: true, cadenceHours: 24 },
    ] });
    write(root, "data/published/sources-status.json", {
      in: { lastSuccessfulFetchAt: "2026-09-25T10:00:00Z", lastError: null },
      us: { lastSuccessfulFetchAt: "2026-09-20T10:00:00Z", lastError: "timeout" },
      fr: { lastSuccessfulFetchAt: null, lastError: null },
    });
    const source = demoOpportunities[0].sources[0];
    const base: OpportunityCycle = {
      ...demoOpportunities[0], id: "approved-exam", fixture: false, jurisdictionCode: "IN",
      sources: [{ ...source, id: "source-one", url: "https://official.example/notice", sha256: "a".repeat(64), verificationStatus: "verified" }],
      rules: { complete: true, asOn: "2026-09-25", age: { min: 18, evidence: "Official notice p. 1" }, education: { minLevel: "bachelor", evidence: "Official notice p. 2" } },
      syllabus: { edition: "2026", language: "English", status: "verified", officialDocuments: [], topics: [{ stage: "written", subject: "Math", topic: "Algebra", citation: { sourceId: "source-one", url: "https://official.example/notice", documentSha256: "a".repeat(64) } }] },
      reviewDecision: undefined,
    };
    const revisions = approvalRevisions(base);
    const approved: OpportunityCycle = { ...base, reviewDecision: { status: "approved", ...revisions, reviewer: "Human", reviewedAt: "2026-09-25T11:00:00Z", minutesSpent: 5 } };
    const stale: OpportunityCycle = { ...approved, id: "stale-exam", title: "Changed after review" };
    write(root, "data/published/cycles/IN.json", [approved, stale]);
    write(root, "public/data/index.json", { total: 1, countries: [{ code: "IN" }] });
    write(root, "data/review/in.json", { reviewStatus: "pending", collectedAt: "2026-09-15T12:00:00Z", cycles: [{ id: "draft-1" }, { id: "draft-2" }] });
    write(root, "out/index.html", "<html></html>");

    const report = collectMetrics(root, now);
    assert.equal(report.coverage.jurisdictions, 4);
    assert.equal(report.coverage.unresearchedJurisdictions, 1);
    assert.equal(report.coverage.collectedRecords, 2);
    assert.equal(report.coverage.publicRecords, 1);
    assert.equal(report.coverage.jurisdictionsWithPublicRecords, 1);
    assert.equal(report.coverage.approvedRecords, 1);
    assert.equal(report.approvedRuleDepth.completeRules, 1);
    assert.equal(report.approvedRuleDepth.fieldCounts.age, 1);
    assert.equal(report.syllabus.verifiedTopics, 1);
    assert.equal(report.review.measuredMinutes, 5);
    assert.equal(report.review.pendingCycles, 2);
    assert.equal(report.review.oldestPacketAgeDays, 10);
    assert.equal(report.review.estimatedPendingMinutes, 10);
    assert.equal(report.sourceFreshness.freshSources, 1);
    assert.equal(report.sourceFreshness.overdueSources, 1);
    assert.equal(report.sourceFreshness.neverFetchedSources, 1);
    assert.equal(report.build.status, "measured");
    assert.equal(report.audits.falseChangeRate.status, "unavailable");
    assert.equal(report.audits.incorrectDateIncidents.status, "unavailable");
    assert.equal(report.audits.usage.status, "unavailable");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("missing static export is reported as unavailable, not zero files", () => {
  const root = mkdtempSync(join(tmpdir(), "govview-metrics-"));
  try {
    write(root, "data/reference/jurisdictions.json", { inventoryAsOf: "2026-09-24", jurisdictions: [] });
    write(root, "sources/registry.json", { sources: [] });
    write(root, "data/published/sources-status.json", {});
    const report = collectMetrics(root, new Date("2026-09-25T12:00:00Z"));
    assert.equal(report.build.status, "unavailable");
    assert.equal(report.coverage.publicRecords, null);
    assert.equal(report.review.medianMinutesPerDecision, null);
    assert.equal(report.review.exceedsTwoHourWeeklyCapacity, null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
