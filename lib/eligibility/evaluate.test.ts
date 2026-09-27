import assert from "node:assert/strict";
import test from "node:test";

import { evaluateEligibility } from "./evaluate.ts";
import { sanitizeProfile } from "./profile.ts";
import type { ApplicantProfile, EligibilityRules } from "./types.ts";

// Shape of a typical Indian central recruitment notice.
const rules: EligibilityRules = {
  complete: true,
  asOn: "2026-08-01",
  age: {
    min: 21,
    max: 32,
    relaxations: [
      { category: "obc", years: 3 },
      { category: "sc", years: 5 },
      { category: "st", years: 5 },
      { disability: true, years: 10 },
      { exServiceman: true, years: 5 },
    ],
    evidence: "Age: 21–32 years as on 01.08.2026. Relaxation: OBC 3, SC/ST 5, PwBD 10 years.",
  },
  education: { minLevel: "bachelor", finalYearAllowed: true, evidence: "Degree of a recognised university; final-year students may apply." },
  nationality: { allowed: ["IN"], conditional: ["NP", "BT"], evidence: "Citizen of India, or subject of Nepal/Bhutan with certificate of eligibility." },
  attempts: { max: 6, byCategory: { obc: 9, sc: null, st: null }, evidence: "Six attempts; OBC nine; SC/ST unlimited." },
};

const base: ApplicantProfile = { dateOfBirth: "2000-05-10", nationality: "IN", education: "bachelor", category: "general", attemptsUsed: 0 };

test("a fully matching applicant passes all three assessments", () => {
  const report = evaluateEligibility(rules, base);
  assert.equal(report.canApply.result, "matches-published-criteria");
  assert.equal(report.canEnterSelection.result, "matches-published-criteria");
  assert.equal(report.canObtainOutcome.result, "matches-published-criteria");
});

test("age boundary is counted on the notice date, not today", () => {
  // Turns 33 on 2 Aug 2026 — still 32 on 1 Aug.
  assert.equal(evaluateEligibility(rules, { ...base, dateOfBirth: "1993-08-02" }).canApply.result, "matches-published-criteria");
  // Turns 33 on 1 Aug 2026 — too old.
  assert.equal(evaluateEligibility(rules, { ...base, dateOfBirth: "1993-08-01" }).canApply.result, "does-not-match");
  // Turns 21 on 2 Aug 2026 — still 20, too young.
  assert.equal(evaluateEligibility(rules, { ...base, dateOfBirth: "2005-08-02" }).canApply.result, "does-not-match");
});

test("29 February birthdays turn over on 1 March in common years", () => {
  const leap: EligibilityRules = { complete: true, asOn: "2027-02-28", age: { max: 22, evidence: "Max 22." } };
  assert.equal(evaluateEligibility(leap, { dateOfBirth: "2004-02-29" }).canApply.result, "matches-published-criteria");
  const nextDay: EligibilityRules = { complete: true, asOn: "2027-03-01", age: { max: 22, evidence: "Max 22." } };
  assert.equal(evaluateEligibility(nextDay, { dateOfBirth: "2004-02-29" }).canApply.result, "does-not-match");
});

test("category and disability relaxations add up; ex-servicemen need verification", () => {
  const age34 = { ...base, dateOfBirth: "1992-01-01" }; // 34 on asOn
  assert.equal(evaluateEligibility(rules, age34).canApply.result, "does-not-match");
  assert.equal(evaluateEligibility(rules, { ...age34, category: "obc" }).canApply.result, "matches-published-criteria");
  const age44 = { ...base, dateOfBirth: "1982-01-01", category: "obc" as const };
  assert.equal(evaluateEligibility(rules, age44).canApply.result, "does-not-match");
  assert.equal(evaluateEligibility(rules, { ...age44, disability: true }).canApply.result, "matches-published-criteria");
  assert.equal(evaluateEligibility(rules, { ...age34, exServiceman: true }).canApply.result, "needs-verification");
});

test("missing category above the general limit asks for more detail", () => {
  const { category: _omit, ...noCategory } = base;
  const result = evaluateEligibility(rules, { ...noCategory, dateOfBirth: "1992-01-01" }).canApply;
  assert.equal(result.result, "needs-verification");
  assert.match(result.checks.find((check) => check.rule === "age")!.reason, /category/);
});

test("final-year students may apply but must prove the result before appointment", () => {
  const report = evaluateEligibility(rules, { ...base, finalYear: true });
  assert.equal(report.canApply.result, "matches-published-criteria");
  assert.equal(report.canObtainOutcome.result, "needs-verification");
  const strict = { ...rules, education: { ...rules.education!, finalYearAllowed: false } };
  assert.equal(evaluateEligibility(strict, { ...base, finalYear: true }).canApply.result, "does-not-match");
  const unstated = { ...rules, education: { minLevel: "bachelor" as const, evidence: "Degree required; final-year status unstated." } };
  assert.equal(evaluateEligibility(unstated, { ...base, finalYear: true }).canApply.result, "needs-verification");
});

test("a citizenship match never overrides failed age, residence, or qualification", () => {
  const tooOld = evaluateEligibility(rules, { ...base, dateOfBirth: "1980-01-01" });
  assert.equal(tooOld.canApply.checks.find((check) => check.rule === "nationality")!.result, "matches-published-criteria");
  assert.equal(tooOld.canApply.result, "does-not-match");
  assert.equal(tooOld.canObtainOutcome.result, "does-not-match");
  assert.equal(evaluateEligibility(rules, { ...base, education: "higher-secondary" }).canApply.result, "does-not-match");
  const domicile: EligibilityRules = { ...rules, residence: { subdivisions: ["IN-MH"], evidence: "Domicile of Maharashtra." } };
  assert.equal(evaluateEligibility(domicile, { ...base, residenceSubdivision: "IN-KA" }).canApply.result, "does-not-match");
  assert.equal(evaluateEligibility(domicile, { ...base, residenceSubdivision: "IN-MH" }).canApply.result, "matches-published-criteria");
});

test("conditional nationalities and missing profile data need verification, never a pass", () => {
  assert.equal(evaluateEligibility(rules, { ...base, nationality: "NP" }).canApply.result, "needs-verification");
  assert.equal(evaluateEligibility(rules, { ...base, nationality: "US" }).canApply.result, "does-not-match");
  assert.equal(evaluateEligibility(rules, {}).canApply.result, "needs-verification");
  assert.equal(evaluateEligibility(null, base).canApply.result, "needs-verification");
  assert.equal(evaluateEligibility({ asOn: null, age: { max: 30, evidence: "Max 30" } }, base).canApply.result, "needs-verification");
});

test("migration-origin exception stays uncertain for any foreign passport while Nepal and Bhutan get certificate wording", () => {
  const migrantRule: EligibilityRules = {
    complete: false, asOn: null,
    nationality: {
      allowed: ["IN"], conditional: ["NP", "BT"], uncertain: ["*"],
      conditionalReason: "Government of India eligibility certificate required for Nepal or Bhutan subjects.",
      uncertainReason: "Indian-origin migration route cannot be decided from passport country alone.",
      evidence: "RRB CEN 03/2026 paragraph 7.1.",
    },
  };
  const check = (nationality: string) => evaluateEligibility(migrantRule, { nationality }).canApply.checks.find((item) => item.rule === "nationality")!;
  assert.equal(check("IN").result, "matches-published-criteria");
  assert.match(check("NP").reason, /certificate required/);
  assert.match(check("BT").reason, /certificate required/);
  assert.equal(check("US").result, "needs-verification");
  assert.match(check("US").reason, /migration route/);
});

test("explicit OCI eligibility keeps foreign citizenship and OCI status separate", () => {
  const fmge: EligibilityRules = {
    complete: false,
    asOn: "2026-08-31",
    nationality: {
      allowed: ["IN"],
      ociAccepted: true,
      uncertain: ["NP"],
      evidence: "FMGE bulletin §4.1 accepts Indian citizens and OCI; §8.7 has conflicting Nepalese wording.",
    },
  };
  const nationality = (profile: ApplicantProfile) => evaluateEligibility(fmge, profile).canApply.checks.find((check) => check.rule === "nationality")!;
  assert.equal(nationality({ nationality: "US", ociStatus: "yes" }).result, "matches-published-criteria");
  assert.equal(nationality({ nationality: "US", ociStatus: "no" }).result, "does-not-match");
  assert.equal(nationality({ nationality: "US" }).result, "needs-verification");
  assert.equal(nationality({ nationality: "NP", ociStatus: "no" }).result, "needs-verification");
  assert.match(nationality({ nationality: "NP", ociStatus: "no" }).reason, /conflict|inconsistent/i);
  assert.equal(nationality({ nationality: "IN", ociStatus: "no" }).result, "matches-published-criteria");
  assert.equal(evaluateEligibility(fmge, { nationality: "US", ociStatus: "yes" }).canApply.result, "needs-verification");
  assert.equal(evaluateEligibility(rules, { ...base, nationality: "US", ociStatus: "yes" }).canApply.result, "does-not-match");
});

test("attempt limits follow category, with unlimited categories", () => {
  assert.equal(evaluateEligibility(rules, { ...base, attemptsUsed: 6 }).canApply.result, "does-not-match");
  assert.equal(evaluateEligibility(rules, { ...base, attemptsUsed: 6, category: "obc" }).canApply.result, "matches-published-criteria");
  assert.equal(evaluateEligibility(rules, { ...base, attemptsUsed: 20, category: "sc" }).canApply.result, "matches-published-criteria");
});

test("manual checks only affect their own and later stages", () => {
  const withMedical: EligibilityRules = { ...rules, manualChecks: [{ stage: "outcome", text: "Medical examination before appointment." }] };
  const report = evaluateEligibility(withMedical, base);
  assert.equal(report.canApply.result, "matches-published-criteria");
  assert.equal(report.canEnterSelection.result, "matches-published-criteria");
  assert.equal(report.canObtainOutcome.result, "needs-verification");
});

test("appointment citizenship does not reject exam entry, and functional English has no invented CEFR equivalence", () => {
  // NYC Correction/Police Officer notices place US citizenship at appointment.
  // This partial scenario tests stage semantics, not verified applicant permission.
  const appointmentRules: EligibilityRules = {
    complete: false, asOn: null,
    nationality: { allowed: ["US"], stage: "outcome", evidence: "NYC exam 7302: citizenship required at appointment." },
    residence: { countries: ["US"], stage: "outcome",
      evidence: "Appointment requires residency in NYC or specified adjoining US counties; exact counties remain manual." },
    languages: [{ language: "en", stage: "selection", mandatory: true,
      requirement: "Functional English comprehension and communication; no standardized level given.",
      evidence: "NYC exam 7302 English requirement.", sourceUrl: "https://www.nyc.gov/assets/dcas/downloads/pdf/noes/20277302000.pdf" }],
  };
  const foreign = evaluateEligibility(appointmentRules, { nationality: "IN", residenceCountry: "US",
    languageSkills: [{ language: "en", framework: "CEFR", level: "C2" }] });
  assert.equal(foreign.canApply.result, "needs-verification");
  assert.equal(foreign.canEnterSelection.result, "needs-verification");
  assert.equal(foreign.canObtainOutcome.result, "does-not-match");
  assert.equal(foreign.canApply.checks.some((check) => check.rule === "nationality"), false);
  assert.equal(foreign.canEnterSelection.checks.some((check) => check.rule === "nationality"), false);
  assert.equal(foreign.canEnterSelection.checks.find((check) => check.rule === "language")!.result, "needs-verification");
  const citizenAbroad = evaluateEligibility(appointmentRules, { nationality: "US", residenceCountry: "IN" });
  assert.equal(citizenAbroad.canApply.result, "needs-verification");
  assert.equal(citizenAbroad.canObtainOutcome.checks.find((check) => check.rule === "nationality")!.result, "matches-published-criteria");
  assert.equal(citizenAbroad.canObtainOutcome.result, "does-not-match");
});

test("desirable language is displayed as advice but never gates eligibility", () => {
  const optional: EligibilityRules = { ...rules, languages: [{ language: "gu", stage: "selection", mandatory: false, requirement: "Gujarati knowledge desirable.", evidence: "Notice page 1", sourceUrl: "https://example.gov.in/notice.pdf" }] };
  const report = evaluateEligibility(optional, base);
  assert.equal(report.canEnterSelection.result, "matches-published-criteria");
  assert.equal(report.canEnterSelection.checks.some((check) => check.rule === "language"), false);
});

test("profile sanitizer drops unknown fields and invalid values", () => {
  const cleaned = sanitizeProfile({ dateOfBirth: "2001-02-30", nationality: "in", category: "vip", attemptsUsed: -1, email: "x@y.z", education: "master", residenceSubdivision: "in-mh" });
  assert.deepEqual(cleaned, { nationality: "IN", education: "master", residenceSubdivision: "IN-MH" });
  assert.deepEqual(sanitizeProfile(null), {});
  assert.deepEqual(sanitizeProfile({ nationality: "us", ociStatus: "yes" }), { nationality: "US", ociStatus: "yes" });
  assert.deepEqual(sanitizeProfile({ nationality: "us", ociStatus: "no" }), { nationality: "US", ociStatus: "no" });
  assert.deepEqual(sanitizeProfile({ nationality: "us", ociStatus: "maybe" }), { nationality: "US" });
});

test("partial rules never produce a yes", () => {
  const partial: EligibilityRules = { asOn: null, nationality: { allowed: ["IN"], evidence: "Citizen of India." } };
  const result = evaluateEligibility(partial, base).canApply;
  assert.equal(result.result, "needs-verification");
  assert.match(result.checks.at(-1)!.reason, /Age limits and Qualifications/);
  // A definite "no" is still a "no".
  assert.equal(evaluateEligibility(partial, { ...base, nationality: "US" }).canApply.result, "does-not-match");
});
