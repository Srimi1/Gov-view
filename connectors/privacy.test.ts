import assert from "node:assert/strict";
import test from "node:test";
import { assertAllowedSourceUrl, assertNoCandidateListCycle, assertNoCandidateListText } from "./privacy.ts";
import type { OpportunityCycle } from "../lib/opportunities.ts";

const cycle = (title: string, sourceTitle = "Official recruitment notice"): OpportunityCycle => ({
  id: "test-cycle", fixture: false, title, cycleLabel: "2026", programme: "Recruitment", authority: "Public Service Commission",
  pathway: "recruitment", status: "uncertain", statusNote: "", jurisdictionCode: "IN", jurisdictionName: "India", scopeLabel: "", outcome: "",
  applicationWindow: { opensOn: null, closesOn: null, officialTimeZone: "Asia/Kolkata", cutoffLocalTime: null, precision: "unknown" },
  qualifications: "", citizenshipRule: "", residenceRule: "", selectionStages: [], fee: "", rules: null, venues: [], lastVerifiedAt: null, applicationUrl: null, changes: [],
  sources: [{ id: "notice", title: sourceTitle, authority: "Public Service Commission", language: "English", format: "HTML", url: "https://example.gov/notice", lastSuccessfulFetchAt: null, lastValidatedAt: null, verificationStatus: "pending-review" }],
});

test("candidate merit and selection lists cannot enter collector", () => {
  assert.throws(() => assertAllowedSourceUrl("https://example.gov/recruitment/merit-list-2026.pdf"), /candidate-identifying/i);
  assert.throws(() => assertAllowedSourceUrl("https://example.gov/files/shortlisted-candidates.pdf"), /candidate-identifying/i);
  assert.throws(() => assertNoCandidateListCycle(cycle("Merit List of Selected Candidates")), /candidate-identifying/i);
  assert.throws(() => assertNoCandidateListCycle(cycle("Recruitment 2026", "Selection list with candidate names")), /candidate-identifying/i);
  assert.throws(() => assertNoCandidateListText("<html><title>Final Result</title><table><tr><th>Roll Number</th><th>Candidate Name</th></tr><tr><td>12345</td><td>Someone</td></tr></table></html>", "text/html", "https://example.gov/results"), /candidate-identifying/i);
  assert.throws(() => assertNoCandidateListText("<table><tr><th>Candidate Name</th><th>Roll No.</th></tr><tr><td>Someone</td><td>12345</td></tr></table>", "text/html", "https://example.gov/data"), /candidate-identifying/i);
  assert.throws(() => assertNoCandidateListText('{"items":[{"candidateName":"Someone","rollNumber":"12345"}]}', "application/json", "https://example.gov/data"), /candidate-identifying/i);
});

test("ordinary notice and authority or signatory names remain allowed", () => {
  assert.doesNotThrow(() => assertAllowedSourceUrl("https://example.gov/recruitment/notice-2026.pdf"));
  assert.doesNotThrow(() => assertNoCandidateListCycle(cycle("Recruitment Notice for Results Analyst", "Notification signed by Secretary Jane Doe")));
  assert.doesNotThrow(() => assertNoCandidateListText("<html><title>Recruitment Notification</title><p>Signed by Secretary Jane Doe. Results will be announced later.</p></html>", "text/html", "https://example.gov/recruitment/notice"));
});
