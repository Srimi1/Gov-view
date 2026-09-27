/** JKPSC GCET Librarian SC backlog: exact scanned notices, founder review only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle } from "./util.ts";

interface Extraction {
  homepageUrl: string;
  originalUrl: string; originalSha256: string;
  corrigendumUrl: string; corrigendumSha256: string;
  augustExtensionUrl: string; augustExtensionSha256: string;
  septemberExtensionUrl: string; septemberExtensionSha256: string;
  notification: string; opensOn: string; originalClosesOn: string;
  augustExtendedClosesOn: string; closesOn: string; eligibilityCutoffOn: string;
  vacancies: number; reservation: string;
}
const data = JSON.parse(readFileSync(new URL("../data/extractions/jkpsc-gcet-librarian-2026.json", import.meta.url), "utf8")) as Extraction;

/** Bind July 07 notification and both later extension links on current official homepage. */
export function verifyJkpscHome(html: string): void {
  for (const link of ["AP_LIB_BACKLOG_2026.PDF", "nid=18028&type=n", "nid=18039&type=n", "nid=18041&type=n"]) {
    if (!html.includes(link)) throw new Error("JKPSC GCET Librarian homepage links changed; review required");
  }
  if (!html.includes("15/09/2026 Filling up of the posts of Assistant professor(s) Librarian (GCET)")) {
    throw new Error("JKPSC September extension row changed; review required");
  }
}

export const jkpscGcetLibrarian2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("JKPSC original scanned PDF bytes required");
  const home = await fetchText(data.homepageUrl, { accept: "text/html" });
  if (home.evidence.url !== data.homepageUrl) throw new Error("JKPSC homepage redirected; review required");
  verifyJkpscHome(home.text);
  const expected = [
    [data.originalUrl, data.originalSha256, "Notification 07-PSC (DR-P) of 2026, GCET backlog", "scanned PDF"],
    [data.corrigendumUrl, data.corrigendumSha256, "7 August corrigendum to notifications 05, 06 and 07", "scanned PDF"],
    [data.augustExtensionUrl, data.augustExtensionSha256, "28 August extension to 14 September", "scanned PDF"],
    [data.septemberExtensionUrl, data.septemberExtensionSha256, "15 September extension to 18 September", "scanned PDF"],
  ] as const;
  const documents = [];
  for (const [url, pinnedSha256] of expected) {
    const document = await fetchBytes(url, { accept: "application/pdf" });
    const actualSha256 = createHash("sha256").update(document.bytes).digest("hex");
    if (document.bytes.subarray(0, 5).toString() !== "%PDF-" ||
        document.evidence.url !== url || document.evidence.sha256 !== actualSha256 ||
        actualSha256 !== pinnedSha256) {
      throw new Error("JKPSC GCET Librarian PDF changed; extracted fields withheld");
    }
    documents.push(document);
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today > data.closesOn ? "closed" as const : today < data.opensOn ? "upcoming" as const
    : today === data.closesOn ? "uncertain" as const : "open" as const;
  const cycle = makeCycle({
    id: "jkpsc-gcet-librarian-sc-backlog-2026", sourceId: source.id,
    title: "Librarian (GCET) — Scheduled Caste backlog",
    programme: "JKPSC GCET Librarian backlog recruitment", cycleLabel: data.notification,
    authority: source.authority, pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India",
    subdivisionCodes: ["IN-JK"],
    scopeLabel: "Jammu and Kashmir Government College of Engineering and Technology. One Librarian item in notification 07; three Assistant Professor items and notifications 05/06 are separate gaps.",
    outcome: `One Librarian vacancy reserved for Scheduled Caste backlog candidates in GCET. Original notification lists a pre-revised pay band of ₹15,600–39,100 plus ₹6,000 AGP.`,
    status,
    statusNote: "Original scanned notice, 7 August corrigendum and both deadline extensions retained. Applications ended 18 September 2026; educational and reservation eligibility remains assessed as of 31 August. Founder review pending.",
    applicationWindow: { opensOn: data.opensOn, closesOn: data.closesOn, cutoffLocalTime: null, officialTimeZone: null, precision: "date",
      note: "Notification 07 opens online forms 1 August; 28 August notice moves deadline from 31 August to 14 September; 15 September notice moves it to 18 September. Both extensions keep qualification/reservation cutoff 31 August. No closing clock time or named official timezone is printed." },
    qualifications: "Library Science, Information Science, Documentation Science or equivalent professional master's degree with normally at least 55% marks (notice describes 50% for specified categories/older PhD holders), knowledge of library computerization, and NET/SLET/SET or the stated PhD exemption. Foreign-university equivalent degrees may count; degree recognition and exemption need individual review.",
    citizenshipRule: "Notification 07 does not state a citizenship rule. It invites applicants holding a valid Jammu and Kashmir domicile certificate, and this Librarian seat is SC backlog. A foreign degree is permitted as an academic credential; that does not establish foreign-citizen application or appointment eligibility.",
    residenceRule: "Valid J&K domicile certificate from competent authority is mandatory. Domicile is a legal certificate, not inferred from present residence; foreign-citizen access to that status and this reserved post requires official verification.",
    languageNote: "Retained notification states no formal language-proficiency level for this Librarian post. Degree subject and written-exam syllabus are separate requirements; actual exam language should be checked before an applicant relies on it.",
    selectionStages: ["Apply online through JKPSC one-time registration for GCET Librarian and upload required documents", "Written examination under JKPSC rules; detailed timetable and assigned centre to be published later", "Original degree, J&K domicile and SC-category evidence checked at document verification", "Final appointment subject to service-rule and category verification"],
    fee: "₹1,200 general; ₹700 reserved category; no fee for PHC candidates, per notification 07. Fee and document upload required for a complete form.",
    salary: "Pre-revised pay band ₹15,600–39,100 plus AGP ₹6,000 in notification 07; confirm current pay mapping before reliance.",
    rules: { complete: false, asOn: data.eligibilityCutoffOn,
      manualChecks: [
        { stage: "apply", text: "Verify valid J&K domicile certificate, SC backlog eligibility, reserved-category certificate by 31 August, educational credential/NET or PhD route, and submitted fee/documents. Citizenship and foreign-citizen route are unstated." },
        { stage: "selection", text: "Verify written-exam syllabus and language, assigned Srinagar/Jammu centre, admissible photo ID, and original academic/category/domicile documents." },
        { stage: "outcome", text: "Verify appointing-authority acceptance of SC and domicile certificates, degree equivalence, 2017 service rules as corrected on 7 August, and final pay terms." },
      ],
    },
    venues: [{ kind: "unknown", name: "Notice names Srinagar and Jammu centre options; candidate's exact examination venue is assigned later" }],
    sources: [
      evidenceSource(source, home.evidence, "JKPSC official homepage notice links", "HTML", "English"),
      ...documents.map((item, index) => evidenceSource(source, item.evidence, expected[index][2], expected[index][3], "English")),
    ],
    applicationMethod: "online", applicationUrl: data.homepageUrl,
    changes: [
      { at: "2026-08-07", kind: "updated", summary: "Corrigendum corrects service-rule reference in notification 07; it does not establish a different Librarian vacancy count." },
      { at: "2026-08-28", kind: "extended", summary: `Application deadline extended from ${data.originalClosesOn} to ${data.augustExtendedClosesOn}; eligibility cutoff remains ${data.eligibilityCutoffOn}.` },
      { at: "2026-09-15", kind: "extended", summary: `Application deadline extended from ${data.augustExtendedClosesOn} to ${data.closesOn}; eligibility cutoff remains ${data.eligibilityCutoffOn}.` },
    ],
  });
  return { cycles: [cycle], evidence: [home.evidence, ...documents.map((item) => item.evidence)], complete: false, warnings: [
    "One SC-reserved GCET Librarian item is staged. Other items in notification 07 and notifications 05/06 remain uncollected, even though both deadline notices name them.",
    "J&K domicile certificate and SC backlog status are legal eligibility checks; present residence and a foreign university degree cannot decide foreign-citizen eligibility.",
    "No official closing hour/timezone or formal language level is printed; 18 September is a date-only deadline.",
    "Original scanned notices and corrigendum require founder visual review before publication.",
  ] };
};
