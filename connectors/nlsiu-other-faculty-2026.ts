/** Four NLSIU September 2026 faculty notices beyond Professor (Law); review-only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn, clockIn } from "../lib/time.ts";
import type { OpportunityCycle } from "../lib/opportunities.ts";
import type { Connector, Evidence, SourceConfig } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Role {
  id: string; title: string; notification: string; vacancies: number; payLevel: string;
  noticeUrl: string; pdfUrl: string; pdfSha256: string; applicationUrl: string;
  corrigendumUrl?: string; corrigendumSha256?: string;
  subjectAreas: string; vacancyMix: string; rank: "associate" | "professor";
}
interface Extraction { indexUrl: string; facultyUrl: string; closesOn: string; cutoffLocalTime: string; roles: Role[] }
const data = JSON.parse(readFileSync(new URL("../data/extractions/nlsiu-other-faculty-2026.json", import.meta.url), "utf8")) as Extraction;
const compact = (value: string) => value.replace(/\s+/g, " ").trim();
const pdfLinks = (html: string) => [...new Set([...html.matchAll(/href="([^"]+\.pdf)"/gi)].map((match) => match[1]))].sort();

/** Require open index, precise role row, application link, nationality and correction links. */
export function verifyNlsiuOtherPages(index: string, faculty: string, notice: string, role: Role): void {
  const open = index.split("<h3>Open Positions:</h3>")[1]?.split("<h3>Closed Positions:</h3>")[0];
  if (!open?.includes(`href="${data.facultyUrl}"`)) throw new Error("NLSIU faculty index changed; review required");
  const row = [...faculty.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)]
    .map((match) => match[0]).find((html) => html.includes(`href="${role.noticeUrl}"`));
  const rowText = compact(stripTags(row ?? ""));
  if (!row || !rowText.includes(`${role.title} – Permanent | ${role.vacancies} Vacanc`) ||
      !/26 October 2026 \(5 PM IST\)/i.test(stripTags(faculty))) {
    throw new Error(`NLSIU ${role.notification} faculty summary changed; review required`);
  }
  if (role.corrigendumUrl ? !row.includes(`href="${role.corrigendumUrl}"`) : /corrigendum|amendment|extension/i.test(rowText)) {
    throw new Error(`NLSIU ${role.notification} correction link changed; review required`);
  }
  if (JSON.stringify(pdfLinks(row)) !== JSON.stringify(role.corrigendumUrl ? [role.corrigendumUrl] : [])) {
    throw new Error(`NLSIU ${role.notification} faculty row has unreviewed documents`);
  }
  const body = notice.split('<div class="news-events-page__content">')[1]?.split("</div>")[0];
  const terms = compact(stripTags(body ?? ""));
  const expectedPdfs = [role.pdfUrl, ...(role.corrigendumUrl ? [role.corrigendumUrl] : [])].sort();
  if (JSON.stringify(pdfLinks(body ?? "")) !== JSON.stringify(expectedPdfs)) {
    throw new Error(`NLSIU ${role.notification} role page has unreviewed documents`);
  }
  if (!body?.includes(`href="${role.pdfUrl}"`) || !body.includes(`href="${role.applicationUrl}"`) ||
      !terms.includes(`${role.title} | ${role.vacancies} Vacanc`) ||
      !terms.includes(`Level ${role.payLevel}, As per VII CPC`) ||
      !/Permanent basis till the age of superannuation, i\.e\., 65 years/.test(terms) ||
      !/Foreign nationals\/OCI\/NRI\/PIO are permitted to apply/.test(terms) ||
      !/confirmation of the candidate.s appointment shall be subject to obtaining necessary visa approvals/.test(terms) ||
      !/26 October 2026 at 17:00 hrs IST/.test(terms) ||
      (role.corrigendumUrl ? !body.includes(`href="${role.corrigendumUrl}"`) : /View Corrigendum/i.test(terms))) {
    throw new Error(`NLSIU ${role.notification} role page changed; review required`);
  }
}

function verifyPdf(bytes: Buffer, evidence: Evidence, url: string, expectedHash: string): void {
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (bytes.subarray(0, 5).toString() !== "%PDF-" || evidence.url !== url ||
      evidence.sha256 !== hash || hash !== expectedHash) {
    throw new Error(`NLSIU document ${url} changed; extracted fields withheld`);
  }
}

function proposal(role: Role, source: SourceConfig, indexEvidence: Evidence, facultyEvidence: Evidence,
  noticeEvidence: Evidence, pdfEvidence: Evidence, correctionEvidence: Evidence | undefined, now: Date): OpportunityCycle {
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today > data.closesOn ? "closed" as const : today < data.closesOn ? "open" as const :
    clockIn("Asia/Kolkata", now) > data.cutoffLocalTime ? "closed" as const : "open" as const;
  const qualification = role.rank === "associate"
    ? "Appendix A requires a recognized Master's degree with at least 55% marks or equivalent grade, subject to stated 5% relaxations; relevant Ph.D.; eight years of qualifying teaching/research experience; at least seven peer-reviewed publications; and UGC research score 75. Degree equivalence, discipline relevance and research evidence need founder assessment."
    : "Appendix A requires a recognized Master's degree with at least 55% marks or equivalent grade, subject to stated 5% relaxations. Professor route A requires relevant Ph.D., at least ten peer-reviewed publications, UGC research score 120 and ten years' qualifying teaching/research experience including doctoral guidance. Route B permits an outstanding professional with relevant Ph.D., documented significant contribution and ten years' experience. Founder must assess both routes separately.";
  const sources = [
    evidenceSource(source, indexEvidence, "NLSIU Work With Us open positions index", "HTML", "English"),
    evidenceSource(source, facultyEvidence, "NLSIU September 2026 faculty call summary", "HTML", "English"),
    evidenceSource(source, noticeEvidence, `NLSIU ${role.title} role page`, "HTML", "English"),
    evidenceSource(source, pdfEvidence, `NLSIU Notification ${role.notification} and Appendix A`, "PDF", "English"),
  ];
  if (correctionEvidence) sources.push(evidenceSource(source, correctionEvidence,
    `NLSIU ${role.notification} signed corrigendum`, "scanned PDF", "English"));
  return makeCycle({
    id: role.id, sourceId: source.id, title: `${role.title} — National Law School of India University`,
    programme: "NLSIU permanent faculty recruitment", cycleLabel: `Notification ${role.notification}${correctionEvidence ? " · 22 September corrigendum" : ""}`,
    authority: source.authority, pathway: "recruitment", appointmentType: "permanent",
    jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-KA"],
    scopeLabel: "Statutory public university in Bengaluru, Karnataka. Foreign nationals may apply; campus location is not an applicant domicile or interview venue.",
    outcome: `${role.vacancies} permanent ${role.title} ${role.vacancies === 1 ? "vacancy" : "vacancies"} (${role.vacancyMix}), subject to two-year probation and superannuation at 65. Selected foreign applicants need Indian visa approval before appointment confirmation.`,
    status, statusNote: `Official September faculty call, role page and exact Notification ${role.notification} retained${correctionEvidence ? " with signed 22 September corrigendum" : ""}. First output awaits founder review.`,
    applicationWindow: { opensOn: null, closesOn: data.closesOn, cutoffLocalTime: data.cutoffLocalTime,
      officialTimeZone: "Asia/Kolkata", precision: "minute",
      note: "Apply online by 26 October 2026 at 17:00 IST. Publication on 18 September is not proof of application opening; inclusive final second is unstated." },
    qualifications: `${qualification} Indicative subject areas: ${role.subjectAreas}.${correctionEvidence ? " Signed corrigendum adds Anthropology to Sociology in indicative areas; other entries remain unchanged." : ""}`,
    citizenshipRule: `Notification ${role.notification} expressly permits foreign nationals, OCI, NRI and PIO to apply. Selection and appointment are separate; selected foreign applicants need visa approval.`,
    residenceRule: "No Indian or Karnataka applicant domicile condition is printed. Work authorization and relocation remain appointment checks.",
    languageNote: "Checked role page, notification and any linked corrigendum state no mandatory language or standardized proficiency level. English publication does not itself establish a language rule.",
    selectionStages: ["Online application with certificates", "Qualification and experience screening; NLSIU may limit interview invitations", "Interview if shortlisted", "Original-document check at joining", "Visa approval for selected foreign applicants before appointment confirmation"],
    fee: "No application fee stated in checked notification; confirm on official form before submission.",
    salary: `Pay Level ${role.payLevel} under VII Central Pay Commission; notice gives no exact payable amount.`,
    rules: { complete: false, asOn: data.closesOn,
      nationality: { allowed: ["*"], evidence: `NLSIU Notification ${role.notification} permits foreign nationals, OCI, NRI and PIO to apply.` },
      manualChecks: [
        { stage: "apply", text: `Check Master's marks/equivalence, Ph.D. relevance, ${role.rank === "associate" ? "eight years' experience, seven publications and UGC score 75" : "Professor route A or B, ten years' experience and research evidence"}, plus required certificates and any category relaxation.` },
        { stage: "selection", text: "Minimum qualifications do not ensure interview. Confirm shortlist, interview arrangements and any language expectation; no published level is available." },
        { stage: "outcome", text: "For a selected foreign applicant, confirm necessary Indian visa approval before appointment confirmation; probation and original-document checks remain." },
      ],
    },
    workLocations: ["NLSIU campus, Nagarbhavi, Bengaluru, Karnataka"],
    venues: [{ kind: "unknown", name: "Interview venue not published; Bengaluru is campus location" }],
    sources, applicationMethod: "online", applicationUrl: role.applicationUrl,
  });
}

export const nlsiuOtherFaculty2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("NLSIU original notification and correction PDF bytes required");
  const index = await fetchText(data.indexUrl, { accept: "text/html" });
  const faculty = await fetchText(data.facultyUrl, { accept: "text/html" });
  if (index.evidence.url !== data.indexUrl || faculty.evidence.url !== data.facultyUrl) throw new Error("NLSIU index redirected; review required");
  const evidence = [index.evidence, faculty.evidence];
  const cycles: OpportunityCycle[] = [];
  for (const role of data.roles) {
    const notice = await fetchText(role.noticeUrl, { accept: "text/html" });
    if (notice.evidence.url !== role.noticeUrl) throw new Error(`NLSIU ${role.notification} role page redirected; review required`);
    verifyNlsiuOtherPages(index.text, faculty.text, notice.text, role);
    const pdf = await fetchBytes(role.pdfUrl, { accept: "application/pdf" });
    verifyPdf(pdf.bytes, pdf.evidence, role.pdfUrl, role.pdfSha256);
    evidence.push(notice.evidence, pdf.evidence);
    let correctionEvidence: Evidence | undefined;
    if (role.corrigendumUrl) {
      if (!role.corrigendumSha256) throw new Error(`NLSIU ${role.notification} correction hash missing`);
      const correction = await fetchBytes(role.corrigendumUrl, { accept: "application/pdf" });
      verifyPdf(correction.bytes, correction.evidence, role.corrigendumUrl, role.corrigendumSha256);
      correctionEvidence = correction.evidence;
      evidence.push(correction.evidence);
    }
    cycles.push(proposal(role, source, index.evidence, faculty.evidence, notice.evidence, pdf.evidence, correctionEvidence, now));
  }
  return { cycles, evidence, complete: false, totalAvailable: 5, warnings: [
    "Four distinct notices and online application forms produce four cycles; the fifth September faculty role, Professor (Law), is collected by its separate connector. Vacancies never multiply cycle count.",
    "Notifications 17 and 18 have signed corrigenda: title wording and Sociology and Anthropology indicative subject area. Exact PDF bytes gate all extracted claims.",
    "Foreign nationals may apply, but qualifications, interview selection and visa-dependent appointment are separate assessments.",
    "No mandatory language level, applicant domicile, interview venue or application fee is stated in checked documents.",
    "Later amendments and wider NLSIU recruitment remain coverage gaps; all drafts need founder review.",
  ] };
};
