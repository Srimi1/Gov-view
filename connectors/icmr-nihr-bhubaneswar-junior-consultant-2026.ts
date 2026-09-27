/** NIHR Bhubaneswar September Junior Consultant (Medical) walk-in; review only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle } from "./util.ts";

interface Extraction {
  indexUrl: string; careerUrl: string; detailUrl: string;
  englishUrl: string; englishSha256: string;
  hindiUrl: string; hindiSha256: string;
  instituteHindiUrl: string; instituteHindiSha256: string;
  advertisement: string; noticeOn: string; walkInOn: string;
  interviewStartsAt: string; positions: number;
}
const data = JSON.parse(readFileSync(new URL("../data/extractions/icmr-nihr-bhubaneswar-junior-consultant-2026.json", import.meta.url), "utf8")) as Extraction;

function tableRows(html: string): string[] {
  return [...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
}

/** Keep September intake distinct from earlier roles reusing the same advert number. */
export function verifyNihrBhubaneswarPages(index: string, career: string, detail: string): void {
  const indexRows = tableRows(index).filter((row) => row.includes(data.englishUrl));
  if (indexRows.length !== 1 || !indexRows[0].includes(data.hindiUrl) ||
      !indexRows[0].includes("Junior Consultant (Medical)") ||
      !indexRows[0].includes("Sept. 29, 2026") || !indexRows[0].includes("Temporary Posts")) {
    throw new Error("ICMR NIHR September index row changed; review required");
  }
  const careerRows = tableRows(career).filter((row) => row.includes(data.detailUrl));
  if (careerRows.length !== 1 || !careerRows[0].includes("Junior Consultant (Medical)") ||
      !careerRows[0].includes("22/09/2026") || !careerRows[0].includes("29/09/2026")) {
    throw new Error("NIHR Bhubaneswar career row changed; review required");
  }
  for (const row of tableRows(career)) {
    if (row === careerRows[0] || !/junior consultant|dristi/i.test(row) ||
        !/corrigendum|extension|cancel|postpon/i.test(row)) continue;
    const dates = [...row.matchAll(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g)]
      .map((match) => `${match[3]}-${match[2]}-${match[1]}`);
    if (dates.some((date) => date > data.noticeOn)) {
      throw new Error("NIHR Bhubaneswar later amendment needs review");
    }
  }
  if (!detail.includes("Junior Consultant (Medical)") || !detail.includes(data.instituteHindiUrl)) {
    throw new Error("NIHR Bhubaneswar detail or document link changed; review required");
  }
}

export const icmrNihrBhubaneswarJuniorConsultant2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("NIHR Bhubaneswar original PDF bytes required");
  const pages = [];
  for (const url of [data.indexUrl, data.careerUrl, data.detailUrl]) {
    const page = await fetchText(url, { accept: "text/html" });
    if (page.evidence.url !== url) throw new Error("NIHR Bhubaneswar source page redirected; review required");
    pages.push(page);
  }
  verifyNihrBhubaneswarPages(pages[0].text, pages[1].text, pages[2].text);
  const expected = [
    [data.englishUrl, data.englishSha256, "NIHR Bhubaneswar 22 September English advertisement and application form", "English"],
    [data.hindiUrl, data.hindiSha256, "NIHR Bhubaneswar 22 September Hindi advertisement and application form", "Hindi"],
    [data.instituteHindiUrl, data.instituteHindiSha256, "NIHR institute-hosted Hindi advertisement", "Hindi"],
  ] as const;
  const documents = [];
  for (const [url, pinnedSha256] of expected) {
    const document = await fetchBytes(url, { accept: "application/pdf" });
    const actualSha256 = createHash("sha256").update(document.bytes).digest("hex");
    if (document.bytes.subarray(0, 5).toString() !== "%PDF-" ||
        document.evidence.url !== url || document.evidence.sha256 !== actualSha256 ||
        actualSha256 !== pinnedSha256) {
      throw new Error("NIHR Bhubaneswar Junior Consultant PDF changed; extracted fields withheld");
    }
    documents.push(document);
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today > data.walkInOn ? "closed" as const : today < data.walkInOn ? "upcoming" as const : "uncertain" as const;
  const cycle = makeCycle({
    id: "icmr-nihr-bhubaneswar-junior-consultant-medical-sep-2026", sourceId: source.id,
    title: "Junior Consultant (Medical) — ICMR-NIHR Bhubaneswar",
    programme: "ICMR-NIHR DRISTI Junior Consultant (Medical)",
    cycleLabel: `${data.advertisement}, 22 September 2026 walk-in`,
    authority: source.authority, pathway: "recruitment", appointmentType: "contract",
    jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-OR"],
    scopeLabel: "One September 2026 DRISTI Bharat Tribal Health Observatory contract interview. Earlier May/June NIHR postings reuse the advertisement number but are separate intakes.",
    outcome: `${data.positions} temporary Junior Consultant (Medical) position, ₹80,000 monthly consolidated. Vacancy count may vary; no right to regular absorption.`,
    status,
    statusNote: "22 September English/Hindi notice and institute career row retained. Walk-in begins 29 September 2026 at 10:30; last arrival time is unstated. The age table says 'Max. Age Limit 40 to 50 Years' without category mapping; founder review required.",
    applicationWindow: { opensOn: null, closesOn: data.walkInOn, cutoffLocalTime: null, officialTimeZone: null, precision: "date",
      note: "Attend the 29 September 2026 walk-in with prescribed application and original documents. 10:30 is interview start, not a stated last acceptance time. No online opening, closing clock time or official timezone is printed." },
    qualifications: "MBBS, BDS, BVSc or equivalent relevant degree plus at least six years of post-qualification experience and proven specialty competence. Notice's 'Max. Age Limit 40 to 50 Years' lacks a category mapping; age relaxation follows ICMR guidelines and needs review.",
    citizenshipRule: "English/Hindi notices do not state nationality or foreign-citizen eligibility. A foreign medical degree and professional registration, if applicable, need separate authority confirmation before an international applicant relies on this route.",
    residenceRule: "No domicile or residence requirement is stated. Bhubaneswar is interview and work location, not an applicant-residence rule.",
    languageNote: "No mandatory language or formal proficiency level is stated in retained notice. Bilingual publication does not itself require Hindi or English fluency; interview and any optional written-test language need authority confirmation.",
    selectionStages: ["Attend walk-in with prescribed form, photo, educational and post-qualification experience documents", "Original-document verification and shortlist based on qualification and experience", "Possible written test or assignment if institute requires it", "Interview and temporary contract selection"],
    fee: "No application fee stated in retained notices; confirm with institute.",
    salary: "₹80,000 monthly consolidated.",
    rules: { complete: false, asOn: data.walkInOn,
      manualChecks: [
        { stage: "apply", text: "Verify nationality and work authorization, professional qualification/equivalence, six years after degree, ambiguous age range and ICMR relaxation, and exclusion of regular government organization employees." },
        { stage: "selection", text: "Verify prescribed form, original documents, arrival process, any optional written test/assignment language and later institute amendment." },
        { stage: "outcome", text: "Verify medical credential recognition, final contract terms and ₹80,000 consolidated pay; no regular appointment is promised." },
      ],
    },
    workLocations: ["ICMR-NIHR, Bhubaneswar, Odisha"],
    venues: [{ kind: "published-address", name: "Annex Building, ICMR-NIHR, Chandrasekharpur, Bhubaneswar, Odisha 751023", city: "Bhubaneswar", subdivision: "IN-OR" }],
    sources: [
      evidenceSource(source, pages[0].evidence, "ICMR national employment index, NIHR September role", "HTML", "English"),
      evidenceSource(source, pages[1].evidence, "NIHR Bhubaneswar career register", "HTML", "English"),
      evidenceSource(source, pages[2].evidence, "NIHR September Junior Consultant detail", "HTML", "English"),
      ...documents.map((document, index) => evidenceSource(source, document.evidence, expected[index][2], "PDF", expected[index][3])),
    ],
    applicationMethod: "in-person", applicationUrl: data.englishUrl,
  });
  return { cycles: [cycle], evidence: [...pages.map((page) => page.evidence), ...documents.map((document) => document.evidence)], complete: false, warnings: [
    "One September Junior Consultant (Medical) walk-in; May/June postings reuse advertisement number 189/2026-27 and are not this application cycle.",
    "10:30 is interview start, not application cutoff. No last arrival time or official timezone is printed.",
    "The notice's maximum-age cell says 40 to 50 years without category mapping; do not calculate an age match before founder clarification.",
    "Nationality, foreign-medical-degree recognition and exam/interview language are unstated. Bilingual notice does not establish a language level.",
    "Published street address has no verified coordinates and has no map pin.",
    "Other NIHR and ICMR opportunities remain outside this exact-document pilot.",
  ] };
};
