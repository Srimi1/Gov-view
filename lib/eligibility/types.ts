/**
 * Eligibility data model.
 *
 * Profiles stay on the applicant's device. Rules come from official notices and
 * always carry the evidence text they were read from.
 */

export const educationLevels = [
  "none",
  "secondary", // 10th / GCSE / ensino fundamental
  "higher-secondary", // 12th / A-level / baccalauréat / ensino médio
  "diploma", // polytechnic, ITI, associate degree
  "bachelor",
  "master",
  "doctorate",
] as const;
export type EducationLevel = (typeof educationLevels)[number];

/** Reservation categories used by Indian notices. Other countries ignore them. */
export const categories = ["general", "ews", "obc", "sc", "st"] as const;
export type Category = (typeof categories)[number];

/** Levels are ordered from lowest to highest; different frameworks are never converted. */
export const languageLevels = {
  CEFR: ["A1", "A2", "B1", "B2", "C1", "C2"],
  JLPT: ["N5", "N4", "N3", "N2", "N1"],
} as const;
export type LanguageFramework = keyof typeof languageLevels;
export interface LanguageSkill {
  language: string; // ISO 639 language tag, e.g. en, ja, ta
  framework: LanguageFramework;
  level: string;
}
export interface LanguageRequirement {
  language: string;
  requirement: string; // Preserve the authority's wording; no invented level equivalences.
  stage: Stage;
  framework?: LanguageFramework;
  minimumLevel?: string;
  certificateRequired?: boolean;
  evidence: string;
  sourceUrl: string;
}

export interface ApplicantProfile {
  dateOfBirth?: string; // YYYY-MM-DD
  nationality?: string; // ISO 3166-1 alpha-2
  residenceCountry?: string; // ISO 3166-1 alpha-2
  residenceSubdivision?: string; // ISO 3166-2, e.g. IN-MH
  education?: EducationLevel;
  educationField?: string;
  /** Final-year students who have not received their result yet. */
  finalYear?: boolean;
  category?: Category;
  disability?: boolean;
  exServiceman?: boolean;
  experienceYears?: number;
  attemptsUsed?: number;
  languageSkills?: LanguageSkill[];
}

export type EligibilityResult = "matches-published-criteria" | "does-not-match" | "needs-verification";

/** Which of the three published assessments a rule affects. */
export type Stage = "apply" | "selection" | "outcome";

export interface AgeRelaxation {
  category?: Category;
  disability?: boolean;
  exServiceman?: boolean;
  years: number;
}

export interface EligibilityRules {
  /**
   * True only when every condition in the notice is captured here. Without it,
   * passing the listed checks gives "not sure yet", never "yes".
   */
  complete?: boolean;
  /** Date on which age and qualifications are counted, as printed in the notice. */
  asOn: string | null;
  age?: { min?: number; max?: number; relaxations?: AgeRelaxation[]; evidence: string };
  education?: { minLevel: EducationLevel; fields?: string[]; finalYearAllowed?: boolean; evidence: string };
  nationality?: {
    allowed: string[];
    /** Nationalities accepted only with an extra certificate or permission. */
    conditional?: string[];
    evidence: string;
  };
  residence?: { countries?: string[]; subdivisions?: string[]; stage?: Stage; evidence: string };
  attempts?: { max: number; byCategory?: Partial<Record<Category, number | null>>; evidence: string };
  experience?: { minYears: number; evidence: string };
  languages?: LanguageRequirement[];
  /** Conditions no form can check: medical, physical, character, language tests. */
  manualChecks?: { stage: Stage; text: string }[];
}

export interface RuleCheck {
  rule: "age" | "education" | "nationality" | "residence" | "attempts" | "experience" | "language" | "manual" | "missing-rules";
  result: EligibilityResult;
  reason: string;
  evidence?: string;
}

export interface Assessment {
  result: EligibilityResult;
  checks: RuleCheck[];
}

export interface EligibilityReport {
  canApply: Assessment;
  canEnterSelection: Assessment;
  canObtainOutcome: Assessment;
}
