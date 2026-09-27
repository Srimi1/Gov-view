/** NLSIU Professor (Law), Notification 15/2026. Exact-document, founder-review draft. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn, clockIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  indexUrl: string; facultyUrl: string; noticeUrl: string; pdfUrl: string;
  pdfSha256: string; applicationUrl: string; notification: string;
  publishedOn: string; closesOn: string; cutoffLocalTime: string;
  officialTimeZone: string; vacancies: number;
}
const data = JSON.parse(readFileSync(new URL("../data/extractions/nlsiu-professor-law-2026.json", import.meta.url), "utf8")) as Extraction;

/** An index move or amendment needs review; disappearance does not mean cancellation. */
export function verifyNlsiuProfessorPages(index: string, faculty: string, notice: string): void {
  const open = index.split("<h3>Open Positions:</h3>")[1]?.split("<h3>Closed Positions:</h3>")[0];
  if (!open?.includes(`href="${data.facultyUrl}"`)) throw new Error("NLSIU faculty index changed; review required");
  const row = [...faculty.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)]
    .map((match) => match[0]).find((html) => html.includes(`href="${data.noticeUrl}"`));
  if (!row || !/Professor \(Law\)[\s\S]*Permanent[\s\S]*5 Vacancies/i.test(row) ||
      /corrigendum|amendment|extension|cancel/i.test(row) ||
      !/26 October 2026 \(5 PM IST\)/i.test(stripTags(faculty))) {
    throw new Error("NLSIU Professor Law faculty summary changed; review required");
  }
  const body = notice.split('<div class="news-events-page__content">')[1]?.split("</div>")[0];
  const terms = stripTags(body ?? "").replace(/\s+/g, " ");
  if (!body?.includes(`href="${data.pdfUrl}"`) || !body.includes(`href="${data.applicationUrl}"`) ||
      !/Professor \(Law\) \| 5 Vacancies \(3 Unreserved, 2 Scheduled Caste\)/.test(terms) ||
      !/Permanent basis till the age of superannuation, i\.e\., 65 years/.test(terms) ||
      !/Foreign nationals\/OCI\/NRI\/PIO are permitted to apply/.test(terms) ||
      !/confirmation of the candidate.s appointment shall be subject to obtaining necessary visa approvals/.test(terms) ||
      !/26 October 2026 at 17:00 hrs IST/.test(terms) ||
      !/Level 14, As per VII CPC/.test(terms) ||
      /corrigendum|deadline extended|advertisement cancelled|notification cancelled/i.test(terms)) {
    throw new Error("NLSIU Professor Law notice changed; review required");
  }
}

export const nlsiuProfessorLaw2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("NLSIU original notification PDF required");
  const pages = [];
  for (const url of [data.indexUrl, data.facultyUrl, data.noticeUrl]) {
    const page = await fetchText(url, { accept: "text/html" });
    if (page.evidence.url !== url) throw new Error("NLSIU official page redirected; review required");
    pages.push(page);
  }
  verifyNlsiuProfessorPages(pages[0].text, pages[1].text, pages[2].text);
  const pdf = await fetchBytes(data.pdfUrl, { accept: "application/pdf" });
  const hash = createHash("sha256").update(pdf.bytes).digest("hex");
  if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== data.pdfUrl ||
      pdf.evidence.sha256 !== hash || hash !== data.pdfSha256) {
    throw new Error("NLSIU Professor Law notification changed; extracted fields withheld");
  }
  const today = civilDateIn(data.officialTimeZone, now);
  const status = today > data.closesOn ? "closed" as const :
    today < data.closesOn ? "open" as const :
    clockIn(data.officialTimeZone, now) > data.cutoffLocalTime ? "closed" as const : "open" as const;
  const cycle = makeCycle({
    id: "nlsiu-professor-law-15-2026", sourceId: source.id,
    title: "Professor (Law) — National Law School of India University",
    programme: "NLSIU permanent faculty recruitment", cycleLabel: `Notification ${data.notification}`,
    authority: source.authority, pathway: "recruitment", appointmentType: "permanent",
    jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-KA"],
    scopeLabel: "Statutory public university in Bengaluru, Karnataka. NLSIU expressly permits foreign nationals to apply; campus location is not an applicant-residence condition or interview venue.",
    outcome: `${data.vacancies} Professor (Law) vacancies: 3 unreserved, 2 Scheduled Caste. Permanent appointment to age 65 subject to satisfactory two-year probation and, for selected foreign applicants, necessary Indian visa approval.`,
    status, statusNote: "Official Work With Us index, September faculty summary, exact role page and Notification 15/2026 retained. First connector output awaits founder review.",
    applicationWindow: { opensOn: null, closesOn: data.closesOn, cutoffLocalTime: data.cutoffLocalTime,
      officialTimeZone: data.officialTimeZone, precision: "minute",
      note: "Apply online by 26 October 2026 at 17:00 IST. The 18 September publication date is not treated as an application opening date. The printed minute does not state an inclusive final second." },
    qualifications: "Appendix A requires a recognized Master's degree with at least 55% marks or equivalent grade, subject to specified 5% relaxations. Professor (Law) route A requires relevant Ph.D., at least 10 peer-reviewed publications, UGC research score 120, and ten years' qualifying teaching/research experience including doctoral guidance. Route B permits an outstanding professional with relevant Ph.D., documented significant contribution and ten years' experience. Founder must assess branch-specific evidence and degree equivalence.",
    citizenshipRule: "Notification 15/2026 explicitly permits foreign nationals, OCI, NRI and PIO to apply. Nationality does not guarantee interview or appointment. If selected, a foreign applicant's appointment confirmation depends on necessary visa approvals under Government of India rules.",
    residenceRule: "No Indian or Karnataka applicant domicile condition is stated in Notification 15/2026. Campus is in Bengaluru; actual work authorization and relocation need confirmation.",
    languageNote: "Checked role page and notification state no mandatory teaching or examination language and no CEFR, IELTS or other proficiency level. English publication is not itself a language rule.",
    selectionStages: ["Online application and certificate upload", "Qualification and experience screening; NLSIU may limit interview invitations", "Interview for shortlisted applicants", "Original-document check at joining", "For selected foreign applicants, necessary visa approval before appointment confirmation"],
    fee: "No application fee stated in checked notification; check official form before submitting.",
    salary: "Pay Level 14 under VII Central Pay Commission; exact payable amount not specified in notice.",
    rules: { complete: false, asOn: data.closesOn,
      nationality: { allowed: ["*"], evidence: "NLSIU Notification 15/2026 permits foreign nationals, OCI, NRI and PIO to apply." },
      manualChecks: [
        { stage: "apply", text: "Verify Master's marks/equivalence and any category relaxation, Ph.D. relevance, route A research score/publications/doctoral guidance or route B professional contribution, ten years' experience and required certificates." },
        { stage: "selection", text: "NLSIU may limit interview invitations even when minimum qualifications are met; confirm shortlist and interview arrangements. No published language level is available to check." },
        { stage: "outcome", text: "For a selected foreign applicant, verify necessary Indian visa approvals before appointment confirmation; probation and original-document checks remain." },
      ],
    },
    workLocations: ["NLSIU campus, Nagarbhavi, Bengaluru, Karnataka"],
    venues: [{ kind: "unknown", name: "Interview format and venue not published; Bengaluru is campus location" }],
    sources: [
      evidenceSource(source, pages[0].evidence, "NLSIU Work With Us open positions index", "HTML", "English"),
      evidenceSource(source, pages[1].evidence, "NLSIU September 2026 faculty call summary", "HTML", "English"),
      evidenceSource(source, pages[2].evidence, "NLSIU Professor (Law) role page", "HTML", "English"),
      evidenceSource(source, pdf.evidence, "NLSIU Notification 15/2026 and Appendix A", "PDF", "English"),
    ],
    applicationMethod: "online", applicationUrl: data.applicationUrl,
  });
  return { cycles: [cycle], evidence: [...pages.map((page) => page.evidence), pdf.evidence], complete: false, warnings: [
    "One Professor (Law) notification is one application cycle; five vacancies do not create five cycles.",
    "Foreign nationals may apply, but selection and visa-dependent appointment remain distinct assessments.",
    "Professor qualification routes A and B differ; eligibility is not automated from a single flattened rule.",
    "No formal language level, interview venue or applicant domicile condition is printed.",
    "Four other September faculty notices are collected by a separate review-only source; wider NLSIU recruitment and later amendments remain gaps.",
  ] };
};
