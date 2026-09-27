/** Bhutan Civil Service Examination 2026 registration, exact official notices; review only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle } from "./util.ts";

interface Extraction {
  announcementPageUrl: string; announcementUrl: string; announcementSha256: string;
  initialVacancyPageUrl: string; initialVacancyUrl: string; initialVacancySha256: string;
  revisedVacancyPageUrl: string; revisedVacancyUrl: string; revisedVacancySha256: string;
  opensOn: string; closesOn: string; initialPositions: number; revisedPositions: number;
}
const data = JSON.parse(readFileSync(new URL("../data/extractions/bt-rcsc-bcse-2026.json", import.meta.url), "utf8")) as Extraction;

function article(html: string): string {
  return /<div class="entry-content clear"[\s\S]*?<\/div><!-- \.entry-content \.clear -->/i.exec(html)?.[0] ?? "";
}

/** Detect changed article-to-PDF links and the later vacancy revision. */
export function verifyBcsePages(announcement: string, initial: string, revised: string): void {
  const checks: [string, string, string][] = [
    [article(announcement), "overall schedule for the Bhutan Civil Service Examination (BCSE) 2026", data.announcementUrl],
    [article(initial), `${data.initialPositions} career opportunities`, data.initialVacancyUrl],
    [article(revised), `${data.revisedPositions} vacancies reprioritised`, data.revisedVacancyUrl],
  ];
  for (const [content, wording, url] of checks) {
    if (!content.includes(wording) || !content.includes(`href="${url}"`)) {
      throw new Error("RCSC BCSE article or document link changed; review required");
    }
  }
}

export const btRcscBcse2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("RCSC original BCSE PDF bytes required");
  const pages = await Promise.all([
    fetchText(data.announcementPageUrl, { accept: "text/html" }),
    fetchText(data.initialVacancyPageUrl, { accept: "text/html" }),
    fetchText(data.revisedVacancyPageUrl, { accept: "text/html" }),
  ]);
  for (const [item, url] of pages.map((item, index) => [item, [data.announcementPageUrl, data.initialVacancyPageUrl, data.revisedVacancyPageUrl][index]] as const)) {
    if (item.evidence.url !== url) throw new Error("RCSC BCSE page redirected; review required");
  }
  verifyBcsePages(pages[0].text, pages[1].text, pages[2].text);
  const documents = await Promise.all([
    fetchBytes(data.announcementUrl, { accept: "application/pdf" }),
    fetchBytes(data.initialVacancyUrl, { accept: "application/pdf" }),
    fetchBytes(data.revisedVacancyUrl, { accept: "application/pdf" }),
  ]);
  const expected = [
    [data.announcementUrl, data.announcementSha256],
    [data.initialVacancyUrl, data.initialVacancySha256],
    [data.revisedVacancyUrl, data.revisedVacancySha256],
  ];
  for (let index = 0; index < documents.length; index += 1) {
    const item = documents[index];
    const sha256 = createHash("sha256").update(item.bytes).digest("hex");
    if (item.bytes.subarray(0, 5).toString() !== "%PDF-" ||
        item.evidence.url !== expected[index][0] || item.evidence.sha256 !== sha256 ||
        sha256 !== expected[index][1]) {
      throw new Error("RCSC BCSE PDF changed; extracted fields withheld");
    }
  }
  const today = civilDateIn("Asia/Thimphu", now);
  const status = today > data.closesOn ? "closed" as const : today < data.opensOn ? "upcoming" as const
    : today === data.closesOn ? "uncertain" as const : "open" as const;
  const cycle = makeCycle({
    id: "bt-rcsc-bcse-2026", sourceId: source.id,
    title: "Bhutan Civil Service Examination 2026",
    programme: "Bhutan Civil Service Examination", cycleLabel: "BCSE 2026 registration",
    authority: source.authority, pathway: "recruitment", jurisdictionCode: "BT", jurisdictionName: "Bhutan",
    scopeLabel: "National Bhutan Civil Service Examination. Registration is one combined cycle; service categories and vacancies are later preferences, not separate registration counts.",
    outcome: `Original June announcement listed ${data.initialPositions} provisional opportunities. August reprioritisation lists ${data.revisedPositions} vacancies: 65 Administration, 40 Finance, 427 Technical, 60 Education PGDE and 150 Education B.Ed. Allocation depends on examination results and later placement.`,
    status,
    statusNote: "Official RCSC registration announcement, initial vacancies and later reprioritisation retained. Registration closed 7 July 2026; October Main Examination is a later selection stage, not a reopened application window. Founder review pending.",
    applicationWindow: { opensOn: data.opensOn, closesOn: data.closesOn, cutoffLocalTime: null, officialTimeZone: null, precision: "date",
      note: "RCSC announcement page 1: BCSE online registration system open 8 June–7 July 2026. No closing clock time or official timezone is printed; later examination dates do not extend registration." },
    qualifications: "Generally a recognized full-time bachelor's degree of at least three years, with documented equivalent Shedra or validated two-year routes. Field requirements differ for Administration, Finance, Education, Technical and Dzongkha categories. Age normally up to 35 for registration; existing in-service civil servants up to 45 require exceptional approval. Verify each route before deciding eligibility.",
    citizenshipRule: "RCSC requires an original valid Bhutanese Citizenship Identity Card for document verification and Main Examination confirmation. No foreign-citizen alternative is in the retained announcement. Whether the registration form accepts a foreign national is not separately stated; foreign citizens cannot satisfy the published selection-stage document requirement.",
    residenceRule: "Announcement does not state a residence or domicile requirement. Exam and verification locations are not applicant-residence restrictions.",
    languageNote: "Preliminary Examination tests English and Dzongkha communication. Main Examination written papers vary by service, including English/Dzongkha papers. Notice gives no CEFR or standardized language-proficiency level; PE-exempt professional routes need separate stage review.",
    selectionStages: ["Online BCSE registration and e-admit-card confirmation, 8 June–7 July 2026", "Preliminary Examination unless an official professional exemption applies", "Original Bhutanese Citizenship Identity Card and academic-document verification before Main Examination", "Main Examination: written papers, academic achievement and viva voce; minimum 50% ME score plus rank and vacancies for placement", "Medical certificate and negative drug test before appointment"],
    fee: "No registration fee stated in retained announcement. Nu. 5,000 administrative fee applies only to withdrawal after selection confirmation and before oath-taking; it is not an application fee.",
    rules: { complete: false, asOn: null,
      nationality: { allowed: ["BT"], stage: "selection", evidence: "RCSC BCSE 2026 announcement, page 5, Section E: original valid Bhutanese Citizenship Identity Card required for Main Examination document verification." },
      manualChecks: [
        { stage: "apply", text: "Check degree duration and recognition, service-specific field, age 35 or approved in-service exception up to 45, complete registration and e-admit card. No precise closing time is published." },
        { stage: "selection", text: "Check Bhutanese Citizenship Identity Card, PE pass or documented exemption, English/Dzongkha examination requirements, original degree documents and assigned venue." },
        { stage: "outcome", text: "Check ME minimum 50%, merit rank, reprioritised vacancy allocation, medical and drug-test certificates, and final appointment terms." },
      ],
    },
    venues: [{ kind: "unknown", name: "Individual PE/ME venue requires separately assigned official notice; country scope is not an exam pin" }],
    sources: [
      evidenceSource(source, pages[0].evidence, "RCSC BCSE 2026 registration article", "HTML", "English"),
      evidenceSource(source, documents[0].evidence, "RCSC BCSE 2026 six-page examination announcement", "PDF", "English"),
      evidenceSource(source, pages[1].evidence, "RCSC initial vacancy article", "HTML", "English"),
      evidenceSource(source, documents[1].evidence, "RCSC initial vacancy notice, 711 opportunities", "PDF", "English"),
      evidenceSource(source, pages[2].evidence, "RCSC reprioritised vacancy article", "HTML", "English"),
      evidenceSource(source, documents[2].evidence, "RCSC reprioritised vacancy notice, 742 opportunities", "PDF", "English"),
    ],
    applicationMethod: "online", applicationUrl: "https://bcse.rcsc.gov.bt/Login",
  });
  return { cycles: [cycle], evidence: [...pages.map((item) => item.evidence), ...documents.map((item) => item.evidence)], complete: false, warnings: [
    "One closed BCSE registration cycle, not 742 applications. August vacancy count revises June count and does not reopen registration.",
    "Original Bhutanese Citizenship Identity Card is required before Main Examination; registration-form behavior for foreign citizens is not established.",
    "English and Dzongkha are tested in PE and service-dependent ME papers; no formal language proficiency level is published.",
    "Professional PE exemptions, degree equivalence, age exception and specific vacancy preferences need founder review.",
    "No exact registration closing clock time, official timezone or individual examination venue is encoded.",
  ] };
};
