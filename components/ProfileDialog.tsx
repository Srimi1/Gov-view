"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Lock, X } from "lucide-react";
import { sanitizeProfile } from "@/lib/eligibility/profile";
import { languageLevels, type ApplicantProfile, type LanguageFramework, type LanguageSkill } from "@/lib/eligibility/types";
import { languageOptions } from "@/lib/eligibility/languages";
import { sortedCountries, subdivisionsByCountry } from "@/lib/places";

type Props = {
  open: boolean;
  profile: ApplicantProfile;
  onClose: () => void;
  onSave: (profile: ApplicantProfile) => void;
  onClear: () => void;
};

const educationOptions: [string, string][] = [
  ["", "Choose…"],
  ["none", "No formal qualification"],
  ["secondary", "Secondary school (10th, GCSE)"],
  ["higher-secondary", "Higher secondary (12th, A-levels, bac)"],
  ["diploma", "Diploma, ITI or associate degree"],
  ["bachelor", "Bachelor's degree"],
  ["master", "Master's degree"],
  ["doctorate", "Doctorate"],
];

function numberOrUndefined(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const number = Number(value);
  return Number.isInteger(number) ? number : undefined;
}

export default function ProfileDialog({ open, profile, onClose, onSave, onClear }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [residence, setResidence] = useState(profile.residenceCountry ?? "");
  const [nationality, setNationality] = useState(profile.nationality ?? "");
  const [languageSkills, setLanguageSkills] = useState<LanguageSkill[]>(profile.languageSkills ?? []);
  // Country names come from the browser's Intl data, which differs from the server's — build on the client only.
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]);
  useEffect(() => setCountries(sortedCountries()), []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setResidence(profile.residenceCountry ?? "");
      setNationality(profile.nationality ?? "");
      setLanguageSkills(profile.languageSkills ?? []);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, profile]);

  const regions = subdivisionsByCountry[residence];
  const showCategory = nationality === "IN" || residence === "IN";
  const today = new Date().toISOString().slice(0, 10);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (key: string) => {
      const value = data.get(key);
      return typeof value === "string" && value ? value : undefined;
    };
    onSave(sanitizeProfile({
      dateOfBirth: text("dateOfBirth"),
      nationality: text("nationality"),
      residenceCountry: text("residenceCountry"),
      residenceSubdivision: text("residenceSubdivision"),
      education: text("education"),
      educationField: text("educationField"),
      finalYear: data.get("finalYear") === "on",
      category: showCategory ? text("category") : undefined,
      disability: data.get("disability") === "on",
      exServiceman: data.get("exServiceman") === "on",
      experienceYears: numberOrUndefined(data.get("experienceYears")),
      attemptsUsed: numberOrUndefined(data.get("attemptsUsed")),
      languageSkills,
    }));
    onClose();
  }

  return (
    <dialog ref={dialogRef} className="profile-dialog" onClose={onClose} aria-labelledby="profile-title">
      <form onSubmit={submit} key={open ? "open" : "closed"}>
        <header className="dialog-head">
          <div>
            <h2 id="profile-title">Your details</h2>
            <p>We compare these with each notice's published rules. Leave out anything you'd rather not share — those checks will show as "not sure yet".</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="privacy-note"><Lock size={14} aria-hidden="true" />Saved only in this browser. Never sent to us or added to links you share.</div>

        <div className="form-grid">
          <label>Date of birth
            <input type="date" name="dateOfBirth" defaultValue={profile.dateOfBirth} max={today} min="1940-01-01" />
          </label>
          <label>Nationality
            <select name="nationality" value={nationality} onChange={(event) => setNationality(event.target.value)}>
              <option value="">Choose…</option>
              {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
            </select>
          </label>
          <label>Country you live in
            <select name="residenceCountry" value={residence} onChange={(event) => setResidence(event.target.value)}>
              <option value="">Choose…</option>
              {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
            </select>
          </label>
          {regions ? (
            <label>State or territory
              <select name="residenceSubdivision" defaultValue={profile.residenceSubdivision ?? ""}>
                <option value="">Choose…</option>
                {regions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </label>
          ) : <span />}
          <label>Highest qualification
            <select name="education" defaultValue={profile.education ?? ""}>
              {educationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Subject
            <input name="educationField" defaultValue={profile.educationField} placeholder="e.g. Nursing, Civil engineering" maxLength={80} />
          </label>
          <label className="check wide">
            <input type="checkbox" name="finalYear" defaultChecked={profile.finalYear} />
            I'm in the final year and waiting for my result
          </label>
          {showCategory && (
            <label>Category (India)
              <select name="category" defaultValue={profile.category ?? ""}>
                <option value="">Choose…</option>
                <option value="general">General / Unreserved</option>
                <option value="ews">EWS</option>
                <option value="obc">OBC (non-creamy layer)</option>
                <option value="sc">SC</option>
                <option value="st">ST</option>
              </select>
            </label>
          )}
          <label>Years of relevant experience
            <input type="number" name="experienceYears" min={0} max={60} step={1} defaultValue={profile.experienceYears} inputMode="numeric" />
          </label>
          <label>Attempts already used
            <input type="number" name="attemptsUsed" min={0} max={60} step={1} defaultValue={profile.attemptsUsed} inputMode="numeric" />
            <small>For exams that limit attempts.</small>
          </label>
          <label className="check">
            <input type="checkbox" name="disability" defaultChecked={profile.disability} />
            I have a benchmark disability
          </label>
          <label className="check">
            <input type="checkbox" name="exServiceman" defaultChecked={profile.exServiceman} />
            I'm an ex-serviceman / veteran
          </label>
        </div>

        <fieldset className="language-profile">
          <legend>Language qualifications (optional)</legend>
          <p className="fine-print">Enter only levels you know. CEFR and JLPT are compared within the same scale. Certificates and notice-specific language tests still need verification.</p>
          {languageSkills.map((skill, index) => (
            <div className="language-skill-row" key={index}>
              <label>Language
                <select value={skill.language} onChange={(event) => setLanguageSkills((items) => items.map((item, i) => i === index ? { ...item, language: event.target.value, framework: "CEFR", level: "" } : item))}>
                  {languageOptions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
              </label>
              <label>Scale
                <select value={skill.framework} onChange={(event) => setLanguageSkills((items) => items.map((item, i) => i === index ? { ...item, framework: event.target.value as LanguageFramework, level: "" } : item))}>
                  <option value="CEFR">CEFR</option>
                  {skill.language === "ja" && <option value="JLPT">JLPT</option>}
                </select>
              </label>
              <label>Level
                <select value={skill.level} onChange={(event) => setLanguageSkills((items) => items.map((item, i) => i === index ? { ...item, level: event.target.value } : item))}>
                  <option value="">Choose…</option>
                  {languageLevels[skill.framework].map((level) => <option key={level}>{level}</option>)}
                </select>
              </label>
              <button type="button" className="button-quiet" aria-label={`Remove language ${index + 1}`} onClick={() => setLanguageSkills((items) => items.filter((_, i) => i !== index))}>Remove</button>
            </div>
          ))}
          <button type="button" className="button-quiet" disabled={languageSkills.length >= 12} onClick={() => setLanguageSkills((items) => [...items, { language: "en", framework: "CEFR", level: "" }])}>Add language</button>
        </fieldset>

        <footer className="dialog-foot">
          <button type="button" className="button-quiet danger" onClick={() => { onClear(); onClose(); }}>Delete my details</button>
          <div>
            <button type="button" className="button-quiet" onClick={onClose}>Cancel</button>
            <button type="submit" className="button-primary">Save and check</button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
