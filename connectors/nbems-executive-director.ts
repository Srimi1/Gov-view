/** One exact NBEMS Executive Director deputation notice, pending founder review. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector, Evidence } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  indexUrl: string; englishUrl: string; englishSha256: string;
  hindiUrl: string; hindiSha256: string; noticeDate: string; closesOn: string; edition: string;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/nbems-executive-director-2026.json", import.meta.url), "utf8")) as Extraction;

/** Ignore broken nested text links; bind dated row to its official download icon. */
export function verifyNbemsDirectorIndex(html: string): void {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  const checks = [
    { title: /Vacancy Notice for the post of Executive Director \[English version\]/i, url: notice.englishUrl },
    { title: /कार्यकारी निदेशक के पद हेतु रिक्ति सूचना \[हिंदी संस्करण\]/, url: notice.hindiUrl },
  ];
  for (const check of checks) {
    const matches = rows.filter((row) => check.title.test(stripTags(row).replace(/\s+/g, " ")));
    if (matches.length !== 1 || !/12-08-2026/.test(matches[0]) || !matches[0].includes(`href="${check.url}"`)) {
      throw new Error("NBEMS Executive Director dated vacancy row or document link changed; review required");
    }
  }
}

export const nbemsExecutiveDirector: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("NBEMS Executive Director original notice bytes required");
  const index = await fetchText(notice.indexUrl, { accept: "text/html" });
  if (index.evidence.url !== notice.indexUrl) throw new Error("NBEMS vacancy index redirected; review required");
  verifyNbemsDirectorIndex(index.text);
  const documents = new Map<string, Evidence>();
  for (const [language, url, expected] of [["English", notice.englishUrl, notice.englishSha256], ["Hindi", notice.hindiUrl, notice.hindiSha256]] as const) {
    const pdf = await fetchBytes(url, { accept: "application/pdf" });
    const hash = createHash("sha256").update(pdf.bytes).digest("hex");
    if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== url || pdf.evidence.sha256 !== hash || hash !== expected) {
      throw new Error(`NBEMS Executive Director ${language} notice changed; dates and eligibility withheld`);
    }
    documents.set(language, pdf.evidence);
  }

  const today = civilDateIn("Asia/Kolkata", now);
  const cycle = makeCycle({
    id: "nbems-executive-director-2026", sourceId: source.id,
    title: "Executive Director — NBEMS (medical officer deputation)",
    programme: "NBEMS Executive Director 2026 deputation",
    cycleLabel: `${notice.edition} · 2026`,
    authority: source.authority, pathway: "recruitment",
    jurisdictionCode: "IN", jurisdictionName: "India",
    scopeLabel: "One national-level public institution leadership post, by deputation from eligible medical services; office in New Delhi. Application is sent through the current employer.",
    outcome: "One Executive Director post on deputation for three years, extendable by two years, at Level 14 of the Central Government pay matrix. Selection and release by the parent authority are required.",
    status: today > notice.closesOn ? "closed" : "open",
    statusNote: "Official NBEMS vacancy register links English and Hindi versions dated 12 August 2026. Postal application must reach NBEMS by 30 October 2026; no cutoff clock time is printed. Founder review pending.",
    applicationWindow: { opensOn: null, closesOn: notice.closesOn, cutoffLocalTime: null,
      officialTimeZone: "Asia/Kolkata", precision: "date",
      note: "English notice page 2, paragraph 5: application with employer forwarding, vigilance clearance and five years' APARs must reach postal address before last date 30 October 2026. Notice date is not assumed to be application opening date. No cutoff hour is stated." },
    qualifications: "Postgraduate degree in Medicine, Surgery or Public Health or branch; 20 years' standing in profession; at least 10 years postgraduate teaching after PG and 5 years as Professor and Head, Professor, Director or Dean, or equivalent. Age at most 55 on 30 October 2026. Existing eligible officer service, employer forwarding, vigilance clearance and five years' APARs are essential.",
    citizenshipRule: "This vacancy notice does not print a citizenship rule. It solicits eligible officers from Central/State Government medical services, Defence Services, Railways, AIIMS, PGIMERs and government medical colleges or institutions. Foreign nationality alone cannot establish access to those services or deputation; international applicants need NBEMS and parent-authority confirmation.",
    residenceRule: "No general residence or domicile condition is stated. New Delhi office and postal application address are not residence requirements.",
    languageNote: "Official vacancy has English and Hindi versions. Neither sets a formal language proficiency level or certificate for this post; publication language does not establish applicant language eligibility.",
    selectionStages: ["Employer forwards prescribed application, vigilance clearance and five years' APARs", "NBEMS screens documents and eligibility", "Selection decision and parent-authority release", "Initial three-year deputation, potentially extended to five years"],
    fee: "Application fee not stated in checked English or Hindi vacancy notice.",
    rules: { complete: false, asOn: notice.closesOn,
      age: { max: 55, evidence: "NBEMS Executive Director vacancy notice, English page 2 paragraph 3: maximum 55 years on closing date 30 October 2026." },
      manualChecks: [
        { stage: "apply", text: "Verify postgraduate medical/public-health degree, 20 years' professional standing, 10 years' postgraduate teaching, 5 years' specified leadership experience and service eligibility. Employer must forward full documents; nationality permission is not stated." },
        { stage: "selection", text: "Confirm NBEMS screening, vigilance clearance, five years' APARs and employer release. The notice does not state a language proficiency test." },
        { stage: "outcome", text: "Confirm selection and lawful deputation from parent medical service; one vacancy and three-year initial term do not guarantee appointment." },
      ],
    },
    venues: [{ kind: "unknown", name: "No interview or selection venue published; New Delhi is the office and postal destination" }],
    sources: [
      evidenceSource(source, index.evidence, "NBEMS official vacancy register, 12 August 2026 rows", "HTML", "English and Hindi"),
      evidenceSource(source, documents.get("English")!, "NBEMS Executive Director vacancy notice and application form", "PDF", "English"),
      evidenceSource(source, documents.get("Hindi")!, "NBEMS Executive Director vacancy notice and application form", "PDF", "Hindi"),
    ],
    applicationMethod: "post",
    applicationUrl: notice.englishUrl,
  });
  return { cycles: [cycle], evidence: [index.evidence, ...documents.values()], complete: false, warnings: [
    "This is one deputation vacancy for eligible serving medical officers, not an open-entry examination for all graduates.",
    "The notice has no explicit citizenship or formal language-level rule; employer-service eligibility and international permission require authority review.",
    "Postal receipt deadline has no published cutoff hour. The notice date is not an application opening date.",
    "Other NBEMS direct recruitment posts, research associates, and future vacancy notices remain coverage gaps.",
  ] };
};
