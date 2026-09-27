import test from "node:test";
import assert from "node:assert/strict";
import { evaluateEligibility, profileIsEmpty } from "./evaluate.ts";
import { sanitizeProfile } from "./profile.ts";
import type { EligibilityRules, LanguageRequirement } from "./types.ts";

// Synthetic rules test behavior; these are never published as real requirements.
const rule: LanguageRequirement = { language: "ja", framework: "JLPT", minimumLevel: "N2", requirement: "Test fixture: JLPT N2", stage: "selection", evidence: "Synthetic N2 condition", sourceUrl: "https://example.gov/test" };
const rules = (changes: Partial<LanguageRequirement> = {}): EligibilityRules => ({ complete: true, asOn: null, nationality: { allowed: ["IN"], evidence: "Synthetic citizenship condition" }, languages: [{ ...rule, ...changes }] });

test("JLPT order and stage inheritance; citizenship cannot override failed language", () => {
  const report = evaluateEligibility(rules(), { nationality: "IN", languageSkills: [{ language: "ja", framework: "JLPT", level: "N3" }] });
  assert.equal(report.canApply.result, "matches-published-criteria");
  assert.equal(report.canEnterSelection.result, "does-not-match");
  assert.equal(report.canObtainOutcome.result, "does-not-match");
  assert.equal(evaluateEligibility(rules(), { nationality: "IN", languageSkills: [{ language: "ja", framework: "JLPT", level: "N1" }] }).canEnterSelection.result, "matches-published-criteria");
});

test("CEFR level thresholds stay within scale; evidence and certificates require verification", () => {
  const profile = { nationality: "IN", languageSkills: [{ language: "ja", framework: "CEFR" as const, level: "C1" }] };
  assert.equal(evaluateEligibility(rules(), profile).canEnterSelection.result, "needs-verification");
  assert.equal(evaluateEligibility(rules({ framework: "CEFR", minimumLevel: "B2" }), profile).canEnterSelection.result, "matches-published-criteria");
  for (const changes of [{ evidence: "" }, { sourceUrl: "javascript:alert(1)" }, { minimumLevel: undefined }, { framework: "CEFR" as const, minimumLevel: "B2", certificateRequired: true }]) {
    assert.equal(evaluateEligibility(rules(changes), profile).canEnterSelection.result, "needs-verification");
  }
});

test("language storage rejects invalid scales, levels, duplicates and hidden fields", () => {
  assert.deepEqual(sanitizeProfile({ languageSkills: [
    { language: "JA", framework: "JLPT", level: "N2", secret: "discard" },
    { language: "ja", framework: "JLPT", level: "N1" },
    { language: "en", framework: "JLPT", level: "N2" },
    { language: "en", framework: "CEFR", level: "N1" },
    { language: "en", framework: "unknown", level: "C1" },
  ] }), { languageSkills: [{ language: "ja", framework: "JLPT", level: "N2" }] });
  assert.equal(profileIsEmpty({ languageSkills: [] }), true);
});
