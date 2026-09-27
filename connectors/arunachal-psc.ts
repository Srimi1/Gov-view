/** APPSCCE 05/2026: one scanned-notice-bound draft for 13 service families. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { cityVenue, evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  advertisement: string; indexUrl: string; noticesUrl: string; documentUrl: string;
  applicationUrl: string; sha256: string; opensOn: string; closesOn: string;
  cutoffLocalTime: string; vacancies: number; postFamilies: number; preliminaryExamOn: string;
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/arunachal-appscce-05-2026.json", import.meta.url), "utf8")) as Extraction;
export const ARUNACHAL_INDEX = extraction.indexUrl;
export const ARUNACHAL_NOTICES = extraction.noticesUrl;

export function checkArunachalIndex(html: string): void {
  if (!/Advertisement for Arunachal Pradesh Public Service Combined Competitive Examination/i.test(stripTags(html))) throw new Error("APPSC advertisement index identity changed");
  const anchors = [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ url: new URL(match[1], ARUNACHAL_INDEX), title: stripTags(match[2]) }));
  const matching = anchors.filter(({ title }) => /Advertisement for Arunachal Pradesh Public Service Combined Competitive Examination\s*[-–]\s*2026/i.test(title));
  if (matching.length !== 1 || matching[0].url.href !== extraction.documentUrl) throw new Error("APPSCCE 2026 advertisement changed or duplicated; review required");
  const related = anchors.filter(({ title }) => /(?:APPSCCE\s*[-–]?\s*2026|Combined Competitive Examination\s*[-–]?\s*2026|advertisement\s*(?:no\.?\s*)?5\s*\/\s*2026)/i.test(title));
  if (related.length !== 1 || related[0] !== matching[0]) throw new Error("APPSCCE 2026 related advertisement or corrigendum needs founder review");
}

export function checkArunachalNotices(html: string): void {
  if (!/Notifications/i.test(stripTags(html))) throw new Error("APPSC notification index identity changed");
  const titles = [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => stripTags(match[2]));
  if (titles.some((title) => /(?:APPSCCE\s*[-–]?\s*2026|Combined Competitive Examination\s*[-–]?\s*2026|advertisement\s*(?:no\.?\s*)?5\s*\/\s*2026)/i.test(title))) {
    throw new Error("APPSCCE 2026 later notification needs founder review");
  }
}

export const arunachalPsc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("APPSCCE scanned PDF bytes required");
  const index = await fetchText(ARUNACHAL_INDEX, { accept: "text/html" });
  if (index.evidence.url !== ARUNACHAL_INDEX) throw new Error("APPSC advertisement index redirected");
  checkArunachalIndex(index.text);
  const notices = await fetchText(ARUNACHAL_NOTICES, { accept: "text/html" });
  if (notices.evidence.url !== ARUNACHAL_NOTICES) throw new Error("APPSC notification index redirected");
  checkArunachalNotices(notices.text);
  const pdf = await fetchBytes(extraction.documentUrl, { accept: "application/pdf" });
  const hash = createHash("sha256").update(pdf.bytes).digest("hex");
  if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== extraction.documentUrl || pdf.evidence.sha256 !== hash || hash !== extraction.sha256) throw new Error("APPSCCE 05/2026 PDF changed; extracted fields withheld");

  const today = civilDateIn("Asia/Kolkata", now);
  const cutoff = Date.parse(`${extraction.closesOn}T${extraction.cutoffLocalTime}:00+05:30`);
  const status = today < extraction.opensOn ? "upcoming" : now.getTime() >= cutoff ? "closed" : "open";
  const centers = ["Itanagar", "Naharlagun", "Nirjuli", "Bomdila", "Ziro", "Daporijo", "Seppa", "Pasighat", "Yingkiong", "Tezu", "Aalo", "Basar", "Khonsa", "Changlang", "Roing", "Doimukh", "Yachuli", "Tawang", "Namsai", "Likhabali"];
  const cycle = makeCycle({
    id: "arunachal-psc-2026-05-appscce", sourceId: source.id,
    title: "Arunachal Pradesh Public Service Combined Competitive Examination 2026",
    cycleLabel: `Advertisement ${extraction.advertisement}`, authority: source.authority,
    pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-AR"],
    scopeLabel: `One application for ${extraction.vacancies} posts across ${extraction.postFamilies} service/post families; prelim centre names do not multiply opportunity count`,
    outcome: "135 Group A/B posts, including Arunachal Pradesh Civil Service, Police Service, Child Development Project Officer, District Officers, Labour Officer, Transport posts, Inspectors and Assistant Section Officers. Appointment remains subject to department checks.",
    status, statusNote: "Scanned advertisement transcribed and exact bytes retained; founder review pending. Notification register checked for later APPSCCE 2026 notices.",
    applicationWindow: { opensOn: extraction.opensOn, closesOn: extraction.closesOn, cutoffLocalTime: extraction.cutoffLocalTime, officialTimeZone: "Asia/Kolkata", precision: "minute", note: "Advertisement 5/2026, page 3: link active from 17:00 on 16 September and closes before 17:00 on 20 October 2026. Page 11 repeats 17:00 cutoff. Notice does not print timezone; Asia/Kolkata is local Arunachal time." },
    qualifications: "Graduate degree from a UGC-recognized university or government-declared equivalent. Result-awaiting candidates may enter provisionally but must show proof of passing before the interview. General age 21–35 on 20 October 2026, with APST, PwBD and service relaxations requiring individual review.",
    citizenshipRule: "Indian citizenship required for application (advertisement pages 1 and 4). Foreign citizens do not meet the published criterion, even if they meet language or qualification criteria.",
    residenceRule: "Valid Arunachal Pradesh Permanent Residence Certificate and Arunachal Pradesh Scheduled Tribe certificate/indigenous status required (advertisement pages 1, 4 and 10). Living in the state alone is insufficient.",
    selectionStages: ["Preliminary examination: two objective papers, planned for 6 December 2026", "Main written examination: seven merit papers plus compulsory English qualifying paper", "Interview/viva voce and original-document verification", "Police Service applicants: physical and medical standards", "Appointing department: medical, character, document and recruitment-rule verification"],
    fee: "₹200 online; persons with disabilities exempt (advertisement page 10).",
    rules: { complete: false, asOn: extraction.closesOn,
      nationality: { allowed: ["IN"], evidence: "Advertisement 5/2026, pages 1 and 4: applicants must be citizens of India." },
      education: { minLevel: "bachelor", finalYearAllowed: true, evidence: "Advertisement 5/2026, page 3: graduate degree or equivalent; result-awaiting candidates admitted provisionally, with proof required before interview." },
      age: { min: 21, evidence: "Advertisement 5/2026, page 4: age at least 21 on 20 October 2026; upper limit 35 has APST, PwBD and service relaxations requiring manual review." },
      languages: [
        { language: "mul", requirement: "Must speak any eligible indigenous tribal language of Arunachal Pradesh and know local indigenous tribes. Separate 26 August 2026 government notification governs the test mechanism; no CEFR or numerical level stated here.", stage: "apply", evidence: "Advertisement 5/2026, page 4, mandatory eligibility criterion (3).", sourceUrl: extraction.documentUrl },
        { language: "en", requirement: "Preliminary question papers are in English; compulsory English paper in Main examination requires 33% of 300 marks. No CEFR level stated.", stage: "selection", evidence: "Advertisement 5/2026, pages 6–7.", sourceUrl: extraction.documentUrl },
      ],
      manualChecks: [
        { stage: "apply", text: "Verify valid Arunachal Permanent Residence Certificate and APST certificate, not just current address (advertisement pages 4 and 10)." },
        { stage: "apply", text: "Verify ability to speak an eligible indigenous tribal language of Arunachal and working knowledge of local tribes; language-test mechanism is in separate 26 August 2026 government notification, not yet reviewed (advertisement page 4). No formal proficiency level given." },
        { stage: "apply", text: "Verify age upper limit, APST/PwBD/service relaxations and recognized or equivalent graduate qualification (advertisement pages 3–4)." },
        { stage: "selection", text: "Confirm English qualifying paper and any indigenous-language test, original degree before interview, plus police physical/medical rules where relevant (advertisement pages 3–6)." },
        { stage: "outcome", text: "Appointing department verifies medical fitness, character, original certificates and post-specific recruitment rules before appointment (advertisement page 11)." },
      ],
    },
    venues: centers.map((city) => cityVenue(`Published preliminary examination centre: ${city}; exact venue allocated by APPSC`, city, "IN", "IN-AR")),
    sources: [
      evidenceSource(source, index.evidence, "APPSC advertisement register", "HTML", "English"),
      evidenceSource(source, notices.evidence, "APPSC notification register", "HTML", "English"),
      evidenceSource(source, pdf.evidence, "APPSCCE advertisement 5/2026", "scanned PDF", "English"),
    ],
    applicationUrl: extraction.applicationUrl,
  });
  return { cycles: [cycle], evidence: [index.evidence, notices.evidence, pdf.evidence], complete: false, warnings: [
    "One combined application covers 135 posts across 13 service/post families; 19 listed examination-centre entries, including combined Naharlagun/Nirjuli, are venue geography only.",
    "Foreign citizens fail the explicit Indian-citizenship criterion. PRC and APST certification are separate mandatory criteria; residence address alone cannot establish them.",
    "Indigenous-language speaking criterion and English qualifying paper are published; no CEFR level. Separate government language-test notification and all age relaxations need founder review.",
    "Scanned notice needs founder visual review. Other APPSC advertisements, departments and local authorities remain coverage gaps.",
  ] };
};
