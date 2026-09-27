/** One California civil-service posting plus CalHR's public applicant FAQ, draft-only. */
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  postingUrl: string; faqUrl: string; jobControlId: string; title: string;
  closesOn: string; positions: number; jobType: string; workLocation: string;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/calcareers-jc-532295.json", import.meta.url), "utf8")) as Extraction;

function labelledSpan(html: string, id: string): string {
  const match = new RegExp(`<span\\s+id="${id}"[^>]*>([\\s\\S]*?)<\\/span>`, "i").exec(html);
  return match ? stripTags(match[1]).replace(/\s+/g, " ").trim() : "";
}

/** Reject changed post identity, employment type, filing date or applicant prerequisites. */
export function verifyCalcareersPosting(html: string): void {
  const text = stripTags(html).replace(/\s+/g, " ");
  if (labelledSpan(html, "lblDetailsJobControlNumber") !== notice.jobControlId ||
      labelledSpan(html, "lblWorkingTitleHeader") !== notice.title ||
      labelledSpan(html, "lblFinalFilingDate") !== "9/30/2026" ||
      labelledSpan(html, "lblNumberOfPositions") !== String(notice.positions) ||
      labelledSpan(html, "lblJobType") !== notice.jobType ||
      labelledSpan(html, "lblWorkLocation") !== notice.workLocation ||
      labelledSpan(html, "lblTelework") !== "In Office" ||
      labelledSpan(html, "lblPrimarySalary") !== "$3,829.00 - $4,794.00 per Month" ||
      !/Typing Certificate.{0,250}40 WPM/i.test(text) ||
      !/obtain list eligibility.{0,150}must first take and pass.{0,100}examination/i.test(text) ||
      !/E-Verify to confirm candidate.s identity and employment authorization/i.test(text) ||
      !/foreign degrees\/transcripts.{0,200}equivalency/i.test(text)) {
    throw new Error("CalCareers JC-532295 posting or applicant terms changed; review required");
  }
}

/** Statewide FAQ is general guidance, not vacancy-specific permission or a visa decision. */
export function verifyCalcareersFaq(html: string): void {
  const text = stripTags(html).replace(/\s+/g, " ");
  if (!/few State jobs require U\.S\. citizenship/i.test(text) ||
      !/necessary work visas/i.test(text) ||
      !/does not conduct examinations in any languages other than English/i.test(text) ||
      !/read, write, and speak English to the extent necessary/i.test(text)) {
    throw new Error("CalHR FAQ citizenship or language guidance changed; review required");
  }
}

export const calcareersJc532295: Connector = async ({ source, fetchText, now }) => {
  const posting = await fetchText(notice.postingUrl, { accept: "text/html" });
  const faq = await fetchText(notice.faqUrl, { accept: "text/html" });
  if (posting.evidence.url !== notice.postingUrl || faq.evidence.url !== notice.faqUrl) {
    throw new Error("CalCareers source redirected; review required");
  }
  verifyCalcareersPosting(posting.text);
  verifyCalcareersFaq(faq.text);
  const today = civilDateIn("America/Los_Angeles", now);
  // Filing hour is absent from the posting; treat its final date as uncertain.
  const status = today > notice.closesOn ? "closed" as const : today === notice.closesOn ? "uncertain" as const : "open" as const;
  const sources = [
    evidenceSource(source, posting.evidence, "CalCareers vacancy JC-532295", "HTML", "English"),
    evidenceSource(source, faq.evidence, "California CalHR applicant FAQ: citizenship and English", "HTML", "English"),
  ];
  const cycle = makeCycle({
    id: "calcareers-jc-532295", sourceId: source.id,
    title: "Office Technician (Typing), Fresno — California Correctional Health Care Services",
    programme: "California state civil-service job postings", cycleLabel: notice.jobControlId,
    authority: source.authority, pathway: "recruitment", appointmentType: "temporary", jurisdictionCode: "US", jurisdictionName: "United States",
    subdivisionCodes: ["US-CA"],
    scopeLabel: "California state civil-service appointment at CCHCS Region II, Fresno County. Fresno is the in-office duty location, not a published examination venue or applicant residence condition.",
    outcome: "One advertised position; 12-month limited-term, full-time, in-office appointment. Published pay is $3,829–$4,794 monthly before the posting's Personal Leave Program adjustment; permanent appointment is not promised.",
    status,
    statusNote: "Exact current job-control page and statewide CalHR FAQ retained. Position, class exam, work authorization and typing certificate require founder review before publication.",
    applicationWindow: { opensOn: null, closesOn: notice.closesOn, cutoffLocalTime: null, officialTimeZone: null,
      precision: "date", note: "JC-532295 gives 30 September 2026 as final filing date without a clock time or governing timezone for electronic applications. Mailed applications use the stated postmark rule; drop-off office hours differ. Posting date is not assumed to be opening date." },
    qualifications: "Must meet Office Technician (Typing) classification minimum requirements and obtain CalCareers examination/list eligibility. A qualifying typing certificate from a five-minute test at 40 WPM, issued within four years, must accompany the application. Foreign education used for minimum qualifications needs U.S. course/degree equivalency verification.",
    citizenshipRule: "CalHR FAQ says most California state jobs do not require U.S. citizenship but requires necessary work visas and lawful employment eligibility. JC-532295 prints no separate citizenship bar; CCHCS uses E-Verify. Foreign citizens may have a route, but this applicant's work authorization and appointment eligibility need verification.",
    residenceRule: "No California or Fresno applicant-residence rule appears in this posting. Fresno County is the work location, and in-office attendance is required.",
    languageNote: "CalHR says state examinations are conducted in English and applicants must read, write and speak English as needed for the work. No CEFR or other formal level is printed. The separate 40 WPM typing certificate is a speed credential, not a language proficiency level.",
    selectionStages: ["Obtain Office Technician (Typing) exam/list eligibility", "Submit separate JC-532295 application with valid 40 WPM typing certificate", "Minimum-qualification screening and interview", "Background investigation, Live Scan and tuberculosis evaluation", "E-Verify employment authorization and final appointment checks"],
    fee: "No application fee stated in the retained posting; confirm any class-exam charges separately before applying.",
    salary: "$3,829–$4,794 per month as advertised; PLP 2025 adjustment noted",
    rules: { complete: false, asOn: notice.closesOn,
      languages: [{ language: "en", stage: "selection", requirement: "California state exams are in English; ability to read, write and speak English is needed to the extent required by the job. No formal proficiency level is published.", evidence: "CalHR applicant FAQ, Applying for a State Examination: English-language response.", sourceUrl: notice.faqUrl }],
      manualChecks: [
        { stage: "apply", text: "Confirm current U.S. work authorization, vacancy-specific citizenship exceptions if any, valid 40 WPM typing certificate submitted with application, class minimum qualifications, foreign degree equivalency if relevant, and exam/list eligibility process." },
        { stage: "selection", text: "Confirm CalCareers examination/list eligibility, English ability for actual duties, application screening, interview and document review. FAQ does not state a numerical language level." },
        { stage: "outcome", text: "Confirm E-Verify employment authorization, background and fingerprint clearance, tuberculosis evaluation, limited-term appointment and in-office work. Passing an exam alone does not grant the job." },
      ],
    },
    venues: [{ kind: "unknown", name: "Classification examination and interview venues not published; Fresno County is duty location" }],
    sources, applicationMethod: "online", applicationUrl: notice.postingUrl,
  });
  return { cycles: [cycle], evidence: [posting.evidence, faq.evidence], complete: false, warnings: [
    "CalHR's statewide FAQ permits noncitizens in many state jobs with necessary U.S. work authorization; it does not prove this applicant can obtain JC-532295 appointment. E-Verify and vacancy-specific terms need review.",
    "Class examination/list eligibility is a prerequisite, not another vacancy cycle. Typing certificate must accompany the job application.",
    "English exam and duty-language requirements have no published CEFR level. 40 WPM is typing speed, not a language framework level.",
    "Electronic filing clock time is not printed. One limited-term Fresno position; posting may be reused for later vacancies but those are not counted now.",
    "Other California jobs, exams and departments remain coverage gaps.",
  ] };
};
