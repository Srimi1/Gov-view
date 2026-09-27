/** RRB Section Controller national CEN 03/2026 from official Secunderabad archive; review-only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle } from "./util.ts";

interface Extraction {
  archiveUrl: string; noticeUrl: string; noticeSha256: string;
  corrigendumUrl: string; corrigendumSha256: string;
  opensOn: string; closesOn: string; cutoffLocalTime: string; ageAsOn: string; positions: number;
}
const data = JSON.parse(readFileSync(new URL("../data/extractions/rrb-cen-03-2026-section-controller.json", import.meta.url), "utf8")) as Extraction;

/** The old regional archive is useful only while it still links both exact national documents. */
export function verifyRrbSectionControllerArchive(html: string): void {
  const section = (html.split('id="headingOne1"')[1]?.split('id="headingOne2"')[0] ?? "")
    .replace(/<!--[\s\S]*?-->/g, "");
  if (!section.includes("CEN 03/2026 (Section Controller)") ||
      !section.includes(`href="${data.noticeUrl}"`) ||
      !section.includes(`href="${data.corrigendumUrl}"`) ||
      !section.includes("Date : 14/07/2026") || !section.includes("Date : 17/07/2026") ||
      /Corrigendum\s+No\.?\s*[2-9]/i.test(section)) {
    throw new Error("RRB CEN 03/2026 archive links or corrigenda changed; review required");
  }
}

export const rrbCen032026SectionController: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("RRB original CEN and corrigendum bytes required");
  const archive = await fetchText(data.archiveUrl, { accept: "text/html" });
  if (archive.evidence.url !== data.archiveUrl) throw new Error("RRB archive redirected; review required");
  verifyRrbSectionControllerArchive(archive.text);
  const documents = await Promise.all([
    fetchBytes(data.noticeUrl, { accept: "application/pdf" }),
    fetchBytes(data.corrigendumUrl, { accept: "application/pdf" }),
  ]);
  for (const [document, url, expected] of [
    [documents[0], data.noticeUrl, data.noticeSha256],
    [documents[1], data.corrigendumUrl, data.corrigendumSha256],
  ] as const) {
    const sha256 = createHash("sha256").update(document.bytes).digest("hex");
    if (document.bytes.subarray(0, 5).toString() !== "%PDF-" ||
        document.evidence.url !== url || document.evidence.sha256 !== sha256 || sha256 !== expected) {
      throw new Error("RRB CEN 03/2026 PDF changed; extracted fields withheld");
    }
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today > data.closesOn ? "closed" as const
    : today < data.opensOn ? "upcoming" as const
    : today === data.closesOn ? "uncertain" as const
    : "open" as const;
  const sources = [
    evidenceSource(source, archive.evidence, "RRB Secunderabad official CEN 03/2026 archive", "HTML", "English"),
    evidenceSource(source, documents[0].evidence, "CEN 03/2026 Section Controller detailed notice", "PDF", "English"),
    evidenceSource(source, documents[1].evidence, "CEN 03/2026 Corrigendum 1, Bhubaneswar ECoR zone", "PDF", "Hindi and English"),
  ];
  const citation = (page: number) => ({ sourceId: sources[1].id, url: data.noticeUrl, documentSha256: data.noticeSha256, page });
  const cycle = makeCycle({
    id: "rrb-cen-03-2026-section-controller", sourceId: source.id,
    title: "Section Controller — Railway Recruitment Boards", programme: "RRB CEN 03/2026 Section Controller",
    cycleLabel: "Centralised Employment Notice 03/2026", authority: source.authority,
    pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India",
    scopeLabel: "One national Railway Recruitment Boards application cycle. Candidate chooses one RRB and zone preferences. Vacancy zones are hiring scope, not published examination venues.",
    outcome: `${data.positions} provisional Section Controller vacancies across all RRBs; 7th CPC level 6, initial pay ₹35,400. Selection and appointment are not guaranteed; appointment term is not stated in the retained notice.`,
    status,
    statusNote: "Applications closed 14 August 2026. Official regional archive, 57-page CEN and Corrigendum 1 retained. New unified RRB portal and later notices are an access gap; first output awaits founder review.",
    applicationWindow: { opensOn: data.opensOn, closesOn: data.closesOn, cutoffLocalTime: data.cutoffLocalTime,
      officialTimeZone: null, precision: "minute", note: "CEN page 3: online applications opened 15 July 2026 at 00:00 and closed 14 August 2026 at 23:59. No timezone is named. Fee payment, corrections and scribe details had later separate dates, not extensions of the application window." },
    qualifications: "Recognized university degree or equivalent, completed by the 14 August 2026 application close; candidates awaiting final results may not apply. Published normal-course age 20–33 as of 1 July 2026, with several category and service relaxations; medical standard A-2 applies.",
    citizenshipRule: "CEN paragraph 7.1 accepts Indian citizens; subjects of Nepal or Bhutan with a Government of India eligibility certificate; and specified persons of Indian origin who migrated from named countries intending permanent settlement, also with a certificate. Passport nationality alone cannot decide the migrant-origin route. Paragraph 7.2 allows provisional examination admission while a required certificate is pending, but requires it at document verification.",
    residenceRule: "No applicant state domicile requirement is stated in the retained CEN. Choice of one RRB and zone preferences does not imply applicant residence eligibility.",
    languageNote: "CBT can be chosen in English, Hindi or 13 listed regional languages, but reading-comprehension passages and questions are in English. CBAT questions and options are English or Hindi only. No CEFR or other formal proficiency level is stated.",
    selectionStages: ["Single online application to one chosen RRB", "Single-stage computer based test (CBT)", "Computer based aptitude test (CBAT); prescribed vision certificate required", "Document verification, including any Government of India nationality eligibility certificate", "Railway medical examination and final appointment decision"],
    fee: "₹500 general, with ₹400 refund less bank charges after attending CBT; ₹250 for published concession categories, refundable less bank charges after attending CBT. Actual refund has further account and verification conditions in CEN paragraph 10.3.",
    salary: "7th CPC level 6; initial pay ₹35,400.",
    rules: { complete: false, asOn: data.ageAsOn,
      education: { minLevel: "bachelor", finalYearAllowed: false, evidence: "CEN 03/2026 pp. 3, 4 and 13: university degree or equivalent; waiting for final qualifying results is ineligible at application close." },
      nationality: { allowed: ["IN"], conditional: ["NP", "BT"], uncertain: ["*"],
        conditionalReason: "Nepal or Bhutan subjects need a Government of India certificate of eligibility; provisional exam admission and document-verification rules differ.",
        uncertainReason: "The Indian-origin migrant route depends on origin, migration intent and a Government of India certificate; passport nationality alone cannot decide it.",
        evidence: "CEN 03/2026 paragraph 7.1 accepts Indian citizens, Nepal/Bhutan subjects and specified Indian-origin migrants; paragraph 7.2 governs provisional examination admission and certificate at document verification." },
      languages: [{ language: "en", stage: "selection", mandatory: true,
        requirement: "CBT reading comprehension is in English. The CEN states no formal English proficiency level or certificate.",
        evidence: "CEN 03/2026 p. 26, Logical Capability / Reading Comprehension; p. 28 lists CBT mediums and p. 27 limits CBAT to English/Hindi.", sourceUrl: data.noticeUrl }],
      manualChecks: [
        { stage: "apply", text: "Confirm age and all applicable relaxations, recognized completed degree, one-RRB application, fee and any nationality certificate/migrant-origin route. Passport and residence alone do not prove the exception." },
        { stage: "selection", text: "Confirm CBT English comprehension, chosen CBT medium, English-or-Hindi CBAT, vision certificate, provisional admission for certificate-requiring nationality routes, and later assigned venue." },
        { stage: "outcome", text: "Confirm eligibility certificate at document verification, A-2 medical and vision standards, qualification originals, zone allotment and final appointment conditions." },
      ],
    },
    syllabus: { edition: "CEN 03/2026", language: "English", status: "pending",
      officialDocuments: [citation(26)], topics: [
        { stage: "CBT", subject: "Analytical and Mathematical Capability", topic: "Mathematics and data analysis/interpretation; official list is illustrative", citation: citation(26) },
        { stage: "CBT", subject: "Logical Capability", topic: "Logical reasoning and English reading comprehension", citation: citation(26) },
        { stage: "CBT", subject: "Mental Reasoning", topic: "Analogies, series, coding-decoding, ranking and arrangements", citation: citation(26) },
      ] },
    venues: [{ kind: "unknown", name: "CBT, CBAT, document verification and medical venues assigned later by chosen RRB" }],
    sources, applicationMethod: "online", applicationUrl: null,
  });
  return { cycles: [cycle], evidence: [archive.evidence, ...documents.map((item) => item.evidence)], complete: false, warnings: [
    "One national CEN and 119 provisional vacancies create one opportunity cycle, not 119 or one per RRB.",
    "Corrigendum 1 changes RRB Bhubaneswar zone label from ECR to ECoR; it does not extend application dates.",
    "New unified RRB portal rejects exact notice access for this collector; old archive cannot establish later CEN updates or current CEN 05/2026 details.",
    "Nepal/Bhutan certificate and Indian-origin migrant exceptions require manual evidence; an arbitrary foreign passport is not automatically accepted or excluded.",
    "CBT English comprehension and CBAT English/Hindi mediums are exam content, not a CEFR qualification claim.",
  ] };
};
