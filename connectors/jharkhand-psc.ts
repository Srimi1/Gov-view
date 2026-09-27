/** JPSC medical Assistant Professor 07/2026: exact-document draft. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn, clockSecondIn } from "../lib/time.ts";
import type { Connector, Evidence } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Document { key: string; url: string; sha256: string }
interface Extraction {
  cycleId: string; indexUrl: string; detailUrl: string; applicationUrl: string;
  advertisement: string; opensOn: string; closesOn: string; cutoffLocalTime: string;
  ageAsOn: string; vacancies: number; specialties: number; documents: Document[];
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/jpsc-assistant-professor-07-2026.json", import.meta.url), "utf8")) as Extraction;
export const JPSC_INDEX = extraction.indexUrl;
export const JPSC_DETAIL = extraction.detailUrl;

export function checkJharkhandIndex(html: string): void {
  const matches = [...html.matchAll(/<a\b[^>]*href=["']([^"']*exam_files\.php\?id=13045)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  if (matches.length !== 1 || new URL(matches[0][1], JPSC_INDEX).href !== JPSC_DETAIL || !/Assistant Professor in Medical Colleges\s*\(Super Specialist\).*07\/2026/i.test(stripTags(matches[0][2]).replace(/\s+/g, " "))) {
    throw new Error("JPSC 07/2026 homepage identity changed; review required");
  }
}

export function checkJharkhandDetail(html: string): void {
  const start = html.indexOf('<div id="midColumn">');
  const end = html.indexOf('<div id="footer">', start);
  if (start < 0 || end < 0) throw new Error("JPSC 07/2026 detail section missing; review required");
  const section = html.slice(start, end);
  if (!/Assistant Professor in Medical Colleges\s*\(Super Specialist\).*07\/2026/i.test(stripTags(section).replace(/\s+/g, " "))) {
    throw new Error("JPSC 07/2026 detail title changed; review required");
  }
  const actual = [...section.matchAll(/<a\b[^>]*href=["']([^"']+\.pdf)["'][^>]*>/gi)].map((match) => new URL(match[1], JPSC_DETAIL).href).sort();
  const expected = extraction.documents.map((document) => document.url).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("JPSC 07/2026 document set changed; review required");
}

export const jharkhandPsc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("JPSC official PDF byte fetch required");
  const index = await fetchText(JPSC_INDEX, { accept: "text/html" });
  const detail = await fetchText(JPSC_DETAIL, { accept: "text/html" });
  if (index.evidence.url !== JPSC_INDEX || detail.evidence.url !== JPSC_DETAIL) throw new Error("JPSC official page redirected");
  checkJharkhandIndex(index.text);
  checkJharkhandDetail(detail.text);
  const documents = new Map<string, Evidence>();
  for (const document of extraction.documents) {
    const pdf = await fetchBytes(document.url, { accept: "application/pdf" });
    const hash = createHash("sha256").update(pdf.bytes).digest("hex");
    if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== document.url || pdf.evidence.sha256 !== hash || hash !== document.sha256) {
      throw new Error(`JPSC 07/2026 ${document.key} PDF changed; extracted fields withheld`);
    }
    documents.set(document.key, pdf.evidence);
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today < extraction.opensOn ? "upcoming" : today > extraction.closesOn || (today === extraction.closesOn && clockSecondIn("Asia/Kolkata", now) >= `${extraction.cutoffLocalTime}:00`) ? "closed" : "open";
  const cycle = makeCycle({
    id: extraction.cycleId,
    sourceId: source.id,
    title: "Jharkhand medical college Assistant Professor 2026",
    cycleLabel: `JPSC advertisement ${extraction.advertisement}`,
    programme: "Jharkhand medical college super-specialty faculty",
    authority: source.authority,
    pathway: "recruitment",
    jurisdictionCode: "IN",
    jurisdictionName: "India",
    subdivisionCodes: ["IN-JH"],
    scopeLabel: "Jharkhand government medical colleges; one advertisement lists 90 posts across ten super-specialties",
    outcome: "Regular Assistant Professor appointments in nephrology, cardiology, neurology, surgical gastroenterology, neurosurgery, urology, cardiothoracic surgery, plastic/reconstructive surgery, and medical/surgical oncology; 90 posts total",
    status,
    statusNote: "Original 07/2026 advertisement and press note agree on 12 May 2026, 17:00 online deadline. Founder review pending; ten-specialty application grouping needs confirmation.",
    applicationWindow: {
      opensOn: extraction.opensOn,
      closesOn: extraction.closesOn,
      cutoffLocalTime: extraction.cutoffLocalTime,
      officialTimeZone: "Asia/Kolkata",
      precision: "minute",
      note: "Hindi press note page 1 and original notice page 9: online application 28 April–12 May 2026 by 17:00. Fee payment until 14 May and paper-copy receipt until 25 May are separate steps. Notice does not print timezone; Asia/Kolkata is local interpretation.",
    },
    qualifications: "Specialty-specific D.M./DNB/DrNB or M.Ch./DNB/DrNB, plus Basic Course in Biomedical Research; exact medical recognition and experience require review (advertisement page 2).",
    citizenshipRule: "No explicit citizenship or foreign-national application rule was established in checked advertisement and press note. International applicants need official confirmation at application, selection and appointment stages.",
    residenceRule: "Jharkhand permanent-residence certificate is required for state reservation benefits (advertisement page 4); notice does not present it as a general application bar for unreserved candidates.",
    selectionStages: ["Online application through JPSC One Time Registration", "Academic and experience merit assessment", "Interview", "Original medical qualification, registration, residence/category and other document verification before appointment"],
    fee: "₹600 plus bank charge for unreserved/BC/EWS; ₹150 for Jharkhand SC/ST; eligible benchmark-disability exemption and other categories require notice review (advertisement page 7).",
    salary: "7th Pay Matrix Level 11 (advertisement page 2)",
    rules: { complete: false, asOn: extraction.ageAsOn,
      age: { min: 30, evidence: "Advertisement page 2: minimum age 30 on 1 August 2025. Upper age varies by category, sex, disability and state service (page 3), so no common maximum is encoded." },
      manualChecks: [
        { stage: "apply", text: "Confirm citizenship and any foreign-national right to apply; checked notice does not establish it." },
        { stage: "apply", text: "Verify specialty-specific DM/DNB/DrNB or MCh qualification, recognition, Basic Course in Biomedical Research and age relaxation (advertisement pages 2–3)." },
        { stage: "apply", text: "Confirm whether each specialty requires its own application form; one advertisement has ten specialties and 90 posts." },
        { stage: "selection", text: "Confirm interview language with JPSC; no formal language-proficiency level is stated in checked notice." },
        { stage: "outcome", text: "Confirm citizenship/appointment permission, medical registration, original credentials and any claimed Jharkhand reservation certificate (advertisement pages 4 and 9)." },
      ],
    },
    venues: [{ kind: "unknown", name: "Interview location not verified; JPSC office address is not treated as interview venue" }],
    sources: [
      evidenceSource(source, index.evidence, "JPSC latest recruitment index", "HTML", "English and Hindi"),
      evidenceSource(source, detail.evidence, "JPSC advertisement 07/2026 document list", "HTML", "English"),
      ...extraction.documents.map((document) => evidenceSource(source, documents.get(document.key)!, `JPSC 07/2026 ${document.key}`, "PDF", "Hindi and English")),
    ],
    applicationUrl: extraction.applicationUrl,
  });
  return { cycles: [cycle], evidence: [index.evidence, detail.evidence, ...documents.values()], complete: false, warnings: [
    "One 90-post advertisement with ten specialty rows is provisionally one cycle; founder must confirm whether specialty applications are separate.",
    "Citizenship and formal language criteria are not established by checked Hindi notice. International applicant status remains needs verification; PDF text extraction uses legacy font encoding and is unreliable without visual review.",
    "Jharkhand residence controls reservation benefits; do not turn it into a blanket application exclusion.",
    "Fee-payment and hard-copy dates follow, but do not extend, the 12 May online application deadline.",
    "Other JPSC 2026 advertisements and authorities remain unextracted coverage gaps.",
  ] };
};
