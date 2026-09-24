import { isIsoDate } from "../time.ts";
import { categories, educationLevels, languageLevels, type ApplicantProfile, type LanguageFramework } from "./types.ts";

/** Profiles live only in this browser. They are never put in URLs or sent anywhere. */
export const PROFILE_STORAGE_KEY = "govview.profile.v1";

const iso2 = /^[A-Z]{2}$/;
const subdivision = /^[A-Z]{2}-[A-Z0-9]{1,3}$/;

/** Keeps only known fields with valid values. Used for storage reads and form input. */
export function sanitizeProfile(input: unknown): ApplicantProfile {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const profile: ApplicantProfile = {};
  if (isIsoDate(raw.dateOfBirth)) profile.dateOfBirth = raw.dateOfBirth;
  for (const key of ["nationality", "residenceCountry"] as const) {
    const value = typeof raw[key] === "string" ? (raw[key] as string).toUpperCase() : "";
    if (iso2.test(value)) profile[key] = value;
  }
  const region = typeof raw.residenceSubdivision === "string" ? raw.residenceSubdivision.toUpperCase() : "";
  if (subdivision.test(region)) profile.residenceSubdivision = region;
  if (typeof raw.education === "string" && (educationLevels as readonly string[]).includes(raw.education)) profile.education = raw.education as ApplicantProfile["education"];
  if (typeof raw.educationField === "string" && raw.educationField.trim()) profile.educationField = raw.educationField.trim().slice(0, 80);
  if (typeof raw.category === "string" && (categories as readonly string[]).includes(raw.category)) profile.category = raw.category as ApplicantProfile["category"];
  for (const key of ["finalYear", "disability", "exServiceman"] as const) {
    if (raw[key] === true) profile[key] = true;
  }
  for (const key of ["experienceYears", "attemptsUsed"] as const) {
    const value = raw[key];
    if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 60) profile[key] = value;
  }
  if (Array.isArray(raw.languageSkills)) {
    const skills: NonNullable<ApplicantProfile["languageSkills"]> = [];
    for (const value of raw.languageSkills.slice(0, 12)) {
      if (!value || typeof value !== "object") continue;
      const { language, framework, level } = value;
      if (typeof language !== "string" || !/^[a-z]{2,3}$/i.test(language)) continue;
      if (framework !== "CEFR" && framework !== "JLPT") continue;
      if (typeof level !== "string" || !(languageLevels[framework as LanguageFramework] as readonly string[]).includes(level)) continue;
      if (framework === "JLPT" && language.toLowerCase() !== "ja") continue;
      if (skills.some((skill) => skill.language === language.toLowerCase() && skill.framework === framework)) continue;
      skills.push({ language: language.toLowerCase(), framework, level });
    }
    if (skills.length) profile.languageSkills = skills;
  }
  return profile;
}

export function loadProfile(): ApplicantProfile {
  try {
    const stored = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    return stored ? sanitizeProfile(JSON.parse(stored)) : {};
  } catch {
    return {};
  }
}

export function saveProfile(profile: ApplicantProfile): void {
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(sanitizeProfile(profile)));
  } catch {
    // Private mode or blocked storage: the check still works for this visit.
  }
}

export function clearProfile(): void {
  try {
    window.localStorage.removeItem(PROFILE_STORAGE_KEY);
  } catch {
    // Nothing stored.
  }
}
