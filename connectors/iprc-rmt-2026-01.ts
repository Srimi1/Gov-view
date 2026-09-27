/** ISRO Propulsion Complex advertisement IPRC/RMT/2026/01, draft-only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn, clockIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { cityVenue, evidenceSource, makeCycle } from "./util.ts";

interface Extraction {
  indexUrl: string; documentUrl: string; documentSha256: string;
  annexureUrl: string; annexureSha256: string; applicationUrl: string;
  advertisement: string; noticeDate: string; opensOn: string; openingLocalTime: string;
  closesOn: string; cutoffLocalTime: string;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/iprc-rmt-2026-01.json", import.meta.url), "utf8")) as Extraction;

interface Post {
  code: number; title: string; vacancies: number; qualification: string;
}
const trade = (name: string) => `Pass in SSLC/SSC/Matric/Class 10 and ITI in ${name} trade with NTC from NCVT, or NAC from NCVT. Exact trade and certificate must match the notice.`;
const posts: Post[] = [
  { code: 60, title: "Technical Assistant (Automobile Engineering)", vacancies: 1, qualification: "First-class diploma in Automobile Engineering." },
  { code: 61, title: "Technical Assistant (Mechanical)", vacancies: 3, qualification: "First-class diploma in Mechanical Engineering or Production Engineering." },
  { code: 62, title: "Technical Assistant (Electronics & Communication)", vacancies: 1, qualification: "First-class diploma in Electronics Engineering, Electronics & Communication Engineering, Electronics & Telecommunication Engineering, or Electronics & Instrumentation Engineering." },
  { code: 63, title: "Technician 'B' (Turner)", vacancies: 2, qualification: trade("Turner") },
  { code: 64, title: "Technician 'B' (Fitter)", vacancies: 4, qualification: trade("Fitter") },
  { code: 65, title: "Technician 'B' (Welder)", vacancies: 2, qualification: trade("Welder") },
  { code: 66, title: "Technician 'B' (Machinist)", vacancies: 3, qualification: trade("Machinist") },
  { code: 67, title: "Technician 'B' (Refrigeration & Air Conditioning)", vacancies: 1, qualification: trade("Refrigeration & Air Conditioning") },
  { code: 68, title: "Technician 'B' (Electrician)", vacancies: 1, qualification: trade("Electrician") },
  { code: 70, title: "Cook 'A'", vacancies: 1, qualification: "Pass in SSLC/SSC/Matric/Class 10 and five years' experience as a cook in an established hotel or canteen. Employer experience certificate is required at skill test; an individual's certificate is not accepted." },
  { code: 71, title: "Fireman 'A'", vacancies: 3, qualification: "Pass in SSLC/SSC/Matric/Class 10, meet published physical fitness standards, and upload preliminary medical examination certificate (Annexure A) with the online application." },
];
const normalizedTitle = (value: string) => value.replace(/[‘’]/g, "'").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();

/** The current application block must still point to the exact checked notice. */
export function verifyIprcRmtIndex(html: string): void {
  const marker = `Advertisement No. ${notice.advertisement} dated 12/09/2026`;
  const start = html.indexOf(marker);
  const end = html.indexOf("<!-- Div for Answer Keys Starts -->", start);
  if (start < 0 || end < 0 || html.indexOf(marker, start + marker.length) >= 0) {
    throw new Error("IPRC 2026 advertisement block changed or duplicated; review required");
  }
  const block = html.slice(start, end);
  const rows = [...block.matchAll(/<td[^>]*>\s*(\d{1,2})\s*<\/td>\s*<td[^>]*>([^<]+)<\/td>/gi)];
  if (rows.length !== posts.length || rows.some((row, index) => Number(row[1]) !== index + 1 || normalizedTitle(row[2]) !== posts[index].title) ||
      !block.includes("15-09-2026, 10:00 Hrs") || !block.includes("05-10-2026, 16:00 Hrs") ||
      !block.includes(`href="${notice.applicationUrl}"`) ||
      !block.includes('href="./files/careers/Advertisement_12092026.pdf"') ||
      !block.includes('href="./files/careers/AnnexureA_12092026.pdf"') ||
      /corrigendum|addendum|extension|revised/i.test(block)) {
    throw new Error("IPRC 2026 post choices, dates or document links changed; review required");
  }
}

export const iprcRmt2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("IPRC original PDF bytes required");
  const index = await fetchText(notice.indexUrl, { accept: "text/html" });
  if (index.evidence.url !== notice.indexUrl) throw new Error("IPRC careers index redirected; review required");
  verifyIprcRmtIndex(index.text);
  const document = await fetchBytes(notice.documentUrl, { accept: "application/pdf" });
  const annexure = await fetchBytes(notice.annexureUrl, { accept: "application/pdf" });
  for (const [item, url, expected] of [
    [document, notice.documentUrl, notice.documentSha256],
    [annexure, notice.annexureUrl, notice.annexureSha256],
  ] as const) {
    const hash = createHash("sha256").update(item.bytes).digest("hex");
    if (item.bytes.subarray(0, 5).toString() !== "%PDF-" || item.evidence.url !== url ||
        item.evidence.sha256 !== hash || hash !== expected) {
      throw new Error("IPRC 2026 PDF changed; dates and eligibility withheld");
    }
  }

  const today = civilDateIn("Asia/Kolkata", now);
  const localClock = clockIn("Asia/Kolkata", now);
  // India local time decides provisional status only; notice does not name an official timezone.
  const status = today > notice.closesOn ? "closed" as const
    : today < notice.opensOn || (today === notice.opensOn && localClock < notice.openingLocalTime) ||
      (today === notice.closesOn && localClock >= notice.cutoffLocalTime) ? "uncertain" as const
    : "open" as const;
  const baseSources = [
    evidenceSource(source, index.evidence, "IPRC careers: advertisement IPRC/RMT/2026/01", "HTML", "English"),
    evidenceSource(source, document.evidence, "IPRC/RMT/2026/01 detailed advertisement", "PDF", "English", notice.documentUrl),
  ];
  const annexureSource = evidenceSource(source, annexure.evidence, "IPRC Fireman preliminary medical certificate, Annexure A", "PDF", "English", notice.annexureUrl);
  const writtenTestVenues = [
    cityVenue("Tirunelveli written-test city option; exact centre pending", "Tirunelveli", "IN", "IN-TN"),
    cityVenue("Chennai written-test city option; exact centre pending", "Chennai", "IN", "IN-TN"),
    { kind: "unknown" as const, name: "Skill-test location not published" },
  ];
  const cycles = posts.map((post) => {
    const technical = post.code <= 62;
    const fireman = post.code === 71;
    const pay = technical ? "Pay-matrix Level 7, ₹44,900–₹1,42,400"
      : post.code <= 68 ? "Pay-matrix Level 3, ₹21,700–₹69,100" : "Pay-matrix Level 2, ₹19,900–₹63,200";
    const language = technical
      ? "Written and skill-test papers offered in English and Hindi (bilingual). No formal proficiency level or language certificate is printed."
      : `Written and skill-test papers offered in Tamil, Hindi and English (trilingual). ${post.code === 70 ? "Cook written syllabus includes General English at Class 10 level. " : fireman ? "Fireman written syllabus includes Basic English. " : ""}No formal proficiency level or language certificate is printed.`;
    const initialFee = technical ? 750 : 500;
    const ordinaryRefund = technical ? 500 : 400;
    return makeCycle({
      id: `iprc-rmt-2026-01-${post.code}`, sourceId: source.id,
      title: `${post.title} — ISRO Propulsion Complex`, programme: "IPRC direct recruitment 2026",
      cycleLabel: `${notice.advertisement} · post code ${post.code}`, authority: source.authority,
      pathway: "recruitment", appointmentType: "temporary", jurisdictionCode: "IN", jurisdictionName: "India",
      scopeLabel: "Central-government ISRO recruitment; initial duty station Mahendragiri, Tamil Nadu, with possible later posting at other ISRO/Department of Space units in India. Duty station is not an applicant domicile or test centre.",
      outcome: `${post.vacancies} ${post.vacancies === 1 ? "vacancy" : "vacancies"} for post code ${post.code}; ${pay}. Notice calls posts temporary but likely to continue indefinitely; permanent tenure is not guaranteed.`,
      status,
      statusNote: "Original 10-page advertisement and current careers block retained. First connector output awaits founder review; later amendments and reservation/medical conditions must be checked.",
      applicationWindow: { opensOn: notice.opensOn, closesOn: notice.closesOn, cutoffLocalTime: notice.cutoffLocalTime,
        officialTimeZone: null, precision: "minute", note: `IPRC careers index and advertisement section 14: online registration starts ${notice.opensOn} at ${notice.openingLocalTime} and closes ${notice.closesOn} at ${notice.cutoffLocalTime}. No governing timezone is printed. Each post code needs a separate application and fee.` },
      qualifications: `${post.qualification} Required qualifications and experience must be held by ${notice.closesOn}. ${fireman ? "Fireman applicants must also meet detailed medical and physical tests. " : ""}Exact credentials, category reservation and age relaxation need founder review.`,
      citizenshipRule: "Advertisement section 13(1): only Indian nationals are eligible to apply. Foreign citizens do not meet the published application rule; no foreign/OCI exception is printed.",
      residenceRule: "No Tamil Nadu domicile or residence requirement is printed. Mahendragiri is initial duty station; Tirunelveli and Chennai are written-test city choices.",
      languageNote: language,
      selectionStages: ["Separate online application and fee for this post code", "Document screening", "Offline written test in chosen Tirunelveli or Chennai city", fireman ? "Physical efficiency skill test and detailed medical examination" : "Curriculum-based qualifying skill test", "Original-document verification and final appointment checks"],
      fee: `₹${initialFee} initially per separate online application. Refund only if applicant appears in written test: female/SC/ST/ex-serviceman/PwBD applicants receive full fee back; other applicants receive ₹${ordinaryRefund} back, subject to bank charges.`,
      salary: pay,
      rules: { complete: false, asOn: notice.closesOn,
        nationality: { allowed: ["IN"], evidence: "IPRC/RMT/2026/01 detailed advertisement section 13(1): Only Indian Nationals are eligible to apply." },
        manualChecks: [
          { stage: "apply", text: `Confirm Indian nationality, exact post-code qualification, age ${fireman ? "18–25" : "18–35"} on 5 October 2026 or documented relaxation, category evidence, separate form and successful fee payment.${fireman ? " Upload Annexure A preliminary medical certificate with application." : ""}` },
          { stage: "selection", text: `Confirm written test, ${fireman ? "physical efficiency and medical" : "skill test"}, original documents and offered paper language. Published paper languages do not establish a formal proficiency level.` },
          { stage: "outcome", text: "Confirm final selection, fit medical status, service conditions and posting. Test admission or success alone does not grant appointment." },
        ],
      },
      venues: writtenTestVenues,
      sources: fireman ? [...baseSources, annexureSource] : baseSources,
      applicationMethod: "online", applicationUrl: notice.applicationUrl,
    });
  });
  return { cycles, evidence: [index.evidence, document.evidence, annexure.evidence], complete: false, warnings: [
    "Eleven distinct post-code applications cover 22 vacancies; multiple vacancies and two optional written-test cities do not multiply opportunity counts.",
    "Only Indian nationals may apply. Exam paper languages are published, but no formal proficiency level or certificate is printed.",
    "Posts are temporary but likely to continue indefinitely; initial duty station and possible later transfers are separate from written-test city choices.",
    "Opening and cutoff clock times are printed without a governing timezone. Deadline-day status is uncertain after local 16:00 until source confirmation.",
    "Refund depends on written-test attendance; full initial fee must be paid per post application.",
    "Other IPRC and ISRO notices, later addenda and founder validation remain coverage gaps.",
  ] };
};
