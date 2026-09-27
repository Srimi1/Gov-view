/** Chandigarh UTCPS Accountant walk-in: exact official PDF, one draft cycle. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { cityVenue, evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  indexUrl: string; documentUrl: string; sha256: string; indexDate: string;
  interviewOn: string; interviewLocalTime: string; vacancies: number;
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/chandigarh-utcps-accountant-2026.json", import.meta.url), "utf8")) as Extraction;
export const CHANDIGARH_NOTICES = extraction.indexUrl;

export function checkChandigarhUtcpsIndex(html: string): void {
  if (!/Public Notice/i.test(stripTags(html))) throw new Error("Chandigarh public-notice index identity changed");
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  const related = rows.filter((row) => /Union Territory Child Protection Society|\bUTCPS\b/i.test(stripTags(row)));
  if (related.length !== 1) throw new Error("UTCPS notice set changed; founder review required");
  const row = related[0];
  if (!/Accountant|following posts purely on Contractual basis/i.test(stripTags(row)) || !stripTags(row).includes(extraction.indexDate)) throw new Error("UTCPS notice identity or date changed");
  const anchors = [...row.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  if (anchors.length !== 1) throw new Error("UTCPS notice link set changed");
  const url = new URL(anchors[0][1], CHANDIGARH_NOTICES);
  if (url.origin !== "https://chandigarh.gov.in" || !/^\/cadmin\/\/?uploads\/[^/]+\.pdf$/i.test(url.pathname) || url.search || url.hash || url.href !== extraction.documentUrl) throw new Error("UTCPS official PDF changed or moved");
}

export const chandigarhUtcps: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("UTCPS exact PDF bytes required");
  const index = await fetchText(CHANDIGARH_NOTICES, { accept: "text/html" });
  if (index.evidence.url !== CHANDIGARH_NOTICES) throw new Error("Chandigarh public-notice index redirected");
  checkChandigarhUtcpsIndex(index.text);
  const pdf = await fetchBytes(extraction.documentUrl, { accept: "application/pdf" });
  const hash = createHash("sha256").update(pdf.bytes).digest("hex");
  if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== extraction.documentUrl || pdf.evidence.sha256 !== hash || hash !== extraction.sha256) throw new Error("UTCPS Accountant PDF changed; extracted fields withheld");

  const interviewPassed = civilDateIn("Asia/Kolkata", now) > extraction.interviewOn;
  const cycle = makeCycle({
    id: "chandigarh-utcps-2026-accountant-officer", sourceId: source.id,
    title: "Accountant Officer — Union Territory Child Protection Society", authority: "Union Territory Child Protection Society, Chandigarh Administration",
    cycleLabel: "UTCPS walk-in notice, 22 September 2026", pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-CH"],
    scopeLabel: `${extraction.vacancies} contract Accountant Officer post; initial term one year; one walk-in application and interview`,
    outcome: `${extraction.vacancies} Accountant Officer contract post with UTCPS, initially for one year. Monthly remuneration ₹36,370; renewal and appointment remain subject to authority decision.`,
    status: interviewPassed ? "closed" : "uncertain",
    statusNote: interviewPassed ? "Published walk-in date has passed; later replacement notice has not been verified." : `Walk-in interview announced for 8 October at ${extraction.interviewLocalTime}. No separate application deadline or opening date printed; founder review pending.`,
    applicationWindow: { opensOn: null, closesOn: null, cutoffLocalTime: null, officialTimeZone: "Asia/Kolkata", precision: "unknown", note: "Notice page 1 gives a walk-in interview on 8 October 2026 at 10:00, not a separate application close. Applicants bring completed form and documents to interview. No application cutoff or opening date is printed." },
    qualifications: "Notice offers retired Accounts Officer or Section Officer route, or B.Com. with at least 60% from a recognised university, and states two years' Accounts Officer/Section Officer experience. How experience applies across both alternatives needs founder confirmation. Ability to use accounting software, MS Office and internet is required. Age 25–62; form asks age on date of advertisement.",
    citizenshipRule: "No nationality condition is stated in this three-page notice. Whether foreign citizens may attend selection or receive a Chandigarh Administration contract appointment needs official confirmation.",
    residenceRule: "No domicile or residence condition is stated. Attendance at the Chandigarh walk-in is a venue requirement, not proof of local residence eligibility.",
    selectionStages: ["Bring completed application, photo, resume, self-attested qualification and experience copies, plus originals", `Walk-in interview on 8 October 2026 at ${extraction.interviewLocalTime} at 5th Floor, New Secretariat, Sector 9, Chandigarh`, "Document checks and authority appointment decision"],
    fee: "No fee is stated in the notice; verify before assuming free application.",
    salary: "₹36,370 per month, equivalent to DC Rate of Finance Officer Accounts (notice page 1).",
    rules: { complete: false, asOn: null, manualChecks: [
      { stage: "apply", text: "Confirm whether foreign citizens can apply for the UTCPS contract; the notice gives no nationality condition (page 1)." },
      { stage: "apply", text: "Verify retired officer or B.Com. 60% route and whether two years' Accounts/Section Officer experience applies to both routes; notice table is ambiguous (page 1)." },
      { stage: "apply", text: "Verify age 25–62 and reference date; application form asks age on date of advertisement, while dated index row says 22 September 2026 (pages 1–2)." },
      { stage: "selection", text: "Bring completed form, original documents and self-attested copies to 8 October walk-in. Notice names no language examination or proficiency level (page 1)." },
      { stage: "outcome", text: "Contract appointment conditions and foreign-citizen permission require authority verification; selection may be cancelled by competent authority (page 1)." },
    ] },
    venues: [cityVenue("Walk-in interview: 5th Floor, New Secretariat, Sector 9, Chandigarh (pin shows city, not building)", "Chandigarh", "IN", "IN-CH")],
    sources: [
      evidenceSource(source, index.evidence, "Chandigarh public-notice register", "HTML", "English"),
      evidenceSource(source, pdf.evidence, "UTCPS Accountant Officer walk-in notice and application form", "PDF", "English"),
    ],
    applicationUrl: extraction.documentUrl,
  });
  return { cycles: [cycle], evidence: [index.evidence, pdf.evidence], complete: false, warnings: [
    "Only one UTCPS Accountant Officer cycle staged; Chandigarh's other departments and recruitment notices remain coverage gaps.",
    "The walk-in date and 10:00 start are selection timing, not an invented application deadline. Exact building address is published; map point has city precision only.",
    "No published nationality, domicile or language-proficiency criterion in this notice. Foreign-citizen application and appointment remain uncertain.",
    "Qualification alternatives and experience column need founder review before publication.",
  ] };
};
