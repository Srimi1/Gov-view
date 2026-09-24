import { ageOn, isIsoDate } from "../time.ts";
import {
  educationLevels,
  languageLevels,
  type ApplicantProfile,
  type Assessment,
  type Category,
  type EligibilityReport,
  type EligibilityResult,
  type EligibilityRules,
  type RuleCheck,
  type Stage,
} from "./types.ts";

const categoryNames: Record<Category, string> = { general: "General", ews: "EWS", obc: "OBC", sc: "SC", st: "ST" };
const educationNames: Record<string, string> = {
  none: "no formal qualification",
  secondary: "secondary school (10th)",
  "higher-secondary": "higher secondary (12th)",
  diploma: "a diploma",
  bachelor: "a bachelor's degree",
  master: "a master's degree",
  doctorate: "a doctorate",
};

const match = (rule: RuleCheck["rule"], reason: string, evidence?: string): RuleCheck => ({ rule, result: "matches-published-criteria", reason, evidence });
const fail = (rule: RuleCheck["rule"], reason: string, evidence?: string): RuleCheck => ({ rule, result: "does-not-match", reason, evidence });
const unsure = (rule: RuleCheck["rule"], reason: string, evidence?: string): RuleCheck => ({ rule, result: "needs-verification", reason, evidence });

function checkAge(rules: EligibilityRules, profile: ApplicantProfile): RuleCheck | null {
  const age = rules.age;
  if (!age) return null;
  if (!rules.asOn || !isIsoDate(rules.asOn)) return unsure("age", "The notice does not say which date age is counted on.", age.evidence);
  if (!profile.dateOfBirth || !isIsoDate(profile.dateOfBirth)) return unsure("age", "Add your date of birth to check the age limit.", age.evidence);

  const years = ageOn(profile.dateOfBirth, rules.asOn);
  const on = `on ${rules.asOn}`;
  if (age.min !== undefined && years < age.min) {
    return fail("age", `You will be ${years} ${on}; the minimum is ${age.min}.`, age.evidence);
  }
  if (age.max === undefined || years <= age.max) {
    return match("age", `You will be ${years} ${on}${age.max !== undefined ? `, within the limit of ${age.max}` : ""}.`, age.evidence);
  }

  const relaxations = age.relaxations ?? [];
  const categoryYears = Math.max(0, ...relaxations.filter((item) => item.category && item.category === profile.category).map((item) => item.years));
  const disabilityYears = profile.disability ? Math.max(0, ...relaxations.filter((item) => item.disability).map((item) => item.years)) : 0;
  const exServiceYears = profile.exServiceman ? Math.max(0, ...relaxations.filter((item) => item.exServiceman).map((item) => item.years)) : 0;
  const confirmedLimit = age.max + categoryYears + disabilityYears;

  if (years <= confirmedLimit) {
    const parts = [
      categoryYears ? `${categoryYears} years for ${categoryNames[profile.category!]}` : "",
      disabilityYears ? `${disabilityYears} years for disability` : "",
    ].filter(Boolean).join(" and ");
    return match("age", `You will be ${years} ${on}. The limit is ${age.max}, raised to ${confirmedLimit} (${parts}).`, age.evidence);
  }
  if (exServiceYears && years <= confirmedLimit + exServiceYears) {
    return unsure("age", `You will be ${years} ${on}. You fit only with the ex-servicemen relaxation, which depends on your length of service.`, age.evidence);
  }
  const largestPossible = age.max + Math.max(0, ...relaxations.filter((item) => item.category).map((item) => item.years)) + Math.max(0, ...relaxations.filter((item) => item.disability).map((item) => item.years));
  if (!profile.category && years <= largestPossible) {
    return unsure("age", `You will be ${years} ${on}, above the general limit of ${age.max}. Add your category to see if a relaxation applies.`, age.evidence);
  }
  return fail("age", `You will be ${years} ${on}; the upper limit for you is ${confirmedLimit}.`, age.evidence);
}

function checkEducation(rules: EligibilityRules, profile: ApplicantProfile, stage: Stage): RuleCheck | null {
  const rule = rules.education;
  if (!rule) return null;
  if (!profile.education) return unsure("education", "Add your highest qualification to check this.", rule.evidence);
  const have = educationLevels.indexOf(profile.education);
  const need = educationLevels.indexOf(rule.minLevel);
  if (have < need) return fail("education", `Needs ${educationNames[rule.minLevel]}; you have ${educationNames[profile.education]}.`, rule.evidence);

  if (rule.fields?.length) {
    if (!profile.educationField) return unsure("education", `Only some subjects count (${rule.fields.join(", ")}). Add your subject to check.`, rule.evidence);
    const field = profile.educationField.toLocaleLowerCase();
    const accepted = rule.fields.some((item) => field.includes(item.toLocaleLowerCase()) || item.toLocaleLowerCase().includes(field));
    if (!accepted) return unsure("education", `The notice lists ${rule.fields.join(", ")}. Check whether ${profile.educationField} is accepted as equivalent.`, rule.evidence);
  }

  if (profile.finalYear) {
    if (!rule.finalYearAllowed) return fail("education", "The qualification must be complete by the cut-off date; final-year students are not accepted.", rule.evidence);
    if (stage === "outcome") return unsure("education", "Final-year students may apply, but you must show your result before appointment.", rule.evidence);
    return match("education", "Final-year students may apply.", rule.evidence);
  }
  return match("education", `You have ${educationNames[profile.education]}; ${educationNames[rule.minLevel]} is required.`, rule.evidence);
}

function checkNationality(rules: EligibilityRules, profile: ApplicantProfile): RuleCheck | null {
  const rule = rules.nationality;
  if (!rule) return null;
  if (!profile.nationality) return unsure("nationality", "Add your nationality to check this.", rule.evidence);
  const code = profile.nationality.toUpperCase();
  if (rule.allowed.includes("*") || rule.allowed.includes(code)) return match("nationality", "Your nationality is accepted.", rule.evidence);
  if (rule.conditional?.includes(code)) return unsure("nationality", "Your nationality is accepted only with an extra certificate or permission.", rule.evidence);
  return fail("nationality", "The notice does not accept your nationality.", rule.evidence);
}

function checkResidence(rules: EligibilityRules, profile: ApplicantProfile): RuleCheck | null {
  const rule = rules.residence;
  if (!rule) return null;
  if (rule.subdivisions?.length) {
    if (!profile.residenceSubdivision) return unsure("residence", "Only residents of certain states or regions qualify. Add where you live.", rule.evidence);
    return rule.subdivisions.includes(profile.residenceSubdivision.toUpperCase())
      ? match("residence", "Your state or region is accepted.", rule.evidence)
      : fail("residence", "Only residents of specific states or regions qualify.", rule.evidence);
  }
  if (rule.countries?.length) {
    if (!profile.residenceCountry) return unsure("residence", "Add your country of residence to check this.", rule.evidence);
    return rule.countries.includes(profile.residenceCountry.toUpperCase())
      ? match("residence", "Your country of residence is accepted.", rule.evidence)
      : fail("residence", "You must live in an accepted country.", rule.evidence);
  }
  return null;
}

function checkAttempts(rules: EligibilityRules, profile: ApplicantProfile): RuleCheck | null {
  const rule = rules.attempts;
  if (!rule) return null;
  if (profile.attemptsUsed === undefined) return unsure("attempts", "Add how many attempts you have used.", rule.evidence);
  const limitFor = (category: Category | undefined) => {
    if (category && rule.byCategory && category in rule.byCategory) return rule.byCategory[category];
    return rule.max;
  };
  const limit = limitFor(profile.category);
  if (limit === null || limit === undefined) return match("attempts", "No attempt limit applies to your category.", rule.evidence);
  if (profile.attemptsUsed < limit) return match("attempts", `You have used ${profile.attemptsUsed} of ${limit} attempts.`, rule.evidence);
  const higherElsewhere = !profile.category && Object.values(rule.byCategory ?? {}).some((value) => value === null || (value ?? 0) > profile.attemptsUsed!);
  if (higherElsewhere) return unsure("attempts", "You have used the general number of attempts. Add your category to see if you get more.", rule.evidence);
  return fail("attempts", `You have used all ${limit} attempts.`, rule.evidence);
}

function checkExperience(rules: EligibilityRules, profile: ApplicantProfile): RuleCheck | null {
  const rule = rules.experience;
  if (!rule) return null;
  if (profile.experienceYears === undefined) return unsure("experience", "Add your years of relevant experience.", rule.evidence);
  return profile.experienceYears >= rule.minYears
    ? match("experience", `You have ${profile.experienceYears} years; ${rule.minYears} are required.`, rule.evidence)
    : fail("experience", `Needs ${rule.minYears} years of experience; you have ${profile.experienceYears}.`, rule.evidence);
}

function combine(checks: RuleCheck[]): EligibilityResult {
  if (checks.some((check) => check.result === "does-not-match")) return "does-not-match";
  if (checks.some((check) => check.result === "needs-verification")) return "needs-verification";
  return "matches-published-criteria";
}

function checkLanguages(rules: EligibilityRules, profile: ApplicantProfile, stage: Stage): RuleCheck[] {
  const stages: Stage[] = ["apply", "selection", "outcome"];
  return (rules.languages ?? []).filter((rule) => stages.indexOf(rule.stage) <= stages.indexOf(stage)).map((rule) => {
    // Notice language is not evidence of a required proficiency level.
    if (!rule.evidence.trim() || !/^https:\/\//.test(rule.sourceUrl)) return unsure("language", "The language requirement needs official evidence.");
    const levels = rule.framework ? languageLevels[rule.framework] as readonly string[] : undefined;
    const required = levels?.indexOf(rule.minimumLevel ?? "") ?? -1;
    if (!levels || required < 0) return unsure("language", rule.requirement, rule.evidence);
    const skills = (profile.languageSkills ?? []).filter((skill) => skill.language.toLowerCase() === rule.language.toLowerCase() && skill.framework === rule.framework);
    const reported = Math.max(-1, ...skills.map((skill) => levels.indexOf(skill.level)));
    if (reported < 0) return unsure("language", `Add your ${rule.language} level in ${rule.framework}; the notice requires ${rule.minimumLevel}. Other scales cannot be substituted.`, rule.evidence);
    if (reported < required) return fail("language", `Your reported ${rule.language} level is below ${rule.framework} ${rule.minimumLevel}.`, rule.evidence);
    if (rule.certificateRequired) return unsure("language", `Your reported level meets ${rule.framework} ${rule.minimumLevel}; the authority must verify the required certificate and any validity conditions.`, rule.evidence);
    return match("language", `Your reported ${rule.language} level meets ${rule.framework} ${rule.minimumLevel}.`, rule.evidence);
  });
}

function assess(rules: EligibilityRules | null | undefined, profile: ApplicantProfile, stage: Stage): Assessment {
  if (!rules) {
    const checks = [unsure("missing-rules", "Criteria for this notice have not been entered yet. Read the official notice.")];
    return { result: "needs-verification", checks };
  }
  const checks: RuleCheck[] = [];
  const push = (check: RuleCheck | null) => { if (check) checks.push(check); };

  // Every stage re-checks the application criteria: passing citizenship never
  // overrides a failed age, residence, or qualification rule.
  push(checkNationality(rules, profile));
  push(checkAge(rules, profile));
  push(checkEducation(rules, profile, stage));
  push(checkExperience(rules, profile));
  push(checkAttempts(rules, profile));
  checks.push(...checkLanguages(rules, profile, stage));
  const residenceStage = rules.residence?.stage ?? "apply";
  if (residenceStage === "apply" || stage === residenceStage || (residenceStage === "selection" && stage === "outcome")) push(checkResidence(rules, profile));

  const stageOrder: Stage[] = ["apply", "selection", "outcome"];
  for (const manual of rules.manualChecks ?? []) {
    if (stageOrder.indexOf(manual.stage) <= stageOrder.indexOf(stage)) push(unsure("manual", manual.text));
  }
  if (!checks.length) checks.push(unsure("missing-rules", "The notice gives no checkable criteria for this step."));
  if (!rules.complete && combine(checks) === "matches-published-criteria") {
    const missing = (["age", "education", "nationality"] as const).filter((rule) => !rules[rule]);
    checks.push(unsure("missing-rules", missing.length
      ? `We could only check part of the rules. ${missing.map((rule) => ({ age: "Age limits", education: "Qualifications", nationality: "Nationality" })[rule]).join(" and ")} are in the official notice.`
      : "Some conditions in the notice aren't captured here yet. Read the notice to confirm."));
  }
  return { result: combine(checks), checks };
}

/** Deterministic: same rules and profile always give the same report. */
export function evaluateEligibility(rules: EligibilityRules | null | undefined, profile: ApplicantProfile): EligibilityReport {
  return {
    canApply: assess(rules, profile, "apply"),
    canEnterSelection: assess(rules, profile, "selection"),
    canObtainOutcome: assess(rules, profile, "outcome"),
  };
}

export function profileIsEmpty(profile: ApplicantProfile): boolean {
  return Object.values(profile).every((value) => value === undefined || value === "" || value === false || (Array.isArray(value) && !value.length));
}
