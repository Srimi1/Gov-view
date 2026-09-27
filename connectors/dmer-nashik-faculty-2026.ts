/** Maharashtra DMER's September 2026 Nashik faculty call; one review-only cycle. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { cityVenue, evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  indexUrl: string; noticeUrl: string; noticeSha256: string; indexDate: string;
  opensOn: string; closesOn: string; cutoffLocalTime: string; interviewOn: string;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/dmer-nashik-faculty-2026.json", import.meta.url), "utf8")) as Extraction;

/** Bind one dated DMER index row to exact PDF; never infer closure from disappearance. */
export function verifyDmerNashikIndex(html: string): void {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const matches = rows.filter(([, row]) => {
    const text = stripTags(row).replace(/\s+/g, " ");
    return text.includes(notice.indexDate) && text.includes("नाशिक") &&
      text.includes("प्राध्यापक") &&
      [...row.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)]
        .some(([, href]) => new URL(href, notice.indexUrl).pathname === new URL(notice.noticeUrl).pathname);
  });
  if (matches.length !== 1) throw new Error("Maharashtra DMER Nashik notice index changed; review required");
}

export const dmerNashikFaculty2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("DMER Nashik original PDF bytes required");
  const index = await fetchText(notice.indexUrl, { accept: "text/html" });
  if (index.evidence.url !== notice.indexUrl) throw new Error("DMER Nashik index redirected; review required");
  verifyDmerNashikIndex(index.text);
  const pdf = await fetchBytes(notice.noticeUrl, { accept: "application/pdf" });
  const hash = createHash("sha256").update(pdf.bytes).digest("hex");
  if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== notice.noticeUrl ||
      pdf.evidence.sha256 !== hash || hash !== notice.noticeSha256) {
    throw new Error("DMER Nashik original PDF changed; review required");
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today < notice.opensOn ? "upcoming" as const : today < notice.closesOn ? "open" as const :
    today === notice.closesOn ? "uncertain" as const : "closed" as const;
  const cycle = makeCycle({
    id: "dmer-gmc-nashik-faculty-september-2026", sourceId: source.id,
    title: "Temporary medical faculty — Government Medical College Nashik",
    programme: "GMC Nashik faculty recruitment", cycleLabel: "September 2026 advertisement 04",
    authority: source.authority, pathway: "recruitment", appointmentType: "contract", jurisdictionCode: "IN", jurisdictionName: "India",
    scopeLabel: "Government Medical College, Nashik, Maharashtra; eight vacancies across three faculty ranks and six medical subjects. Nashik is published work and interview location, not an applicant domicile restriction.",
    outcome: "Eight temporary contractual faculty vacancies: one Professor, three Associate Professor and four Assistant Professor positions. Appointment is for up to 364 days or until a regular/reassigned candidate is available, subject to the notice's terms.",
    status,
    statusNote: "Official DMER index and scanned Marathi/English notice retained. Exact PDF is hash-pinned; role-specific terms and any later amendment need founder review.",
    applicationWindow: { opensOn: notice.opensOn, closesOn: notice.closesOn, cutoffLocalTime: notice.cutoffLocalTime,
      officialTimeZone: null, precision: "minute", note: "Notice page 1 prints 21–28 September 2026, 11:00–17:00. It does not name the governing timezone or state whether the final minute is inclusive. On 28 September status remains uncertain until authority confirmation. DMER index posted this PDF on 24 September." },
    qualifications: "Post and subject-specific NMC qualifications and experience are printed on pages 3–5. They include relevant MD/MS/DNB or listed equivalent routes; senior ranks also require teaching experience, research publications, and NMC-designated courses. Check exact rank and subject. Form requests medical council registration evidence.",
    citizenshipRule: "No express nationality eligibility clause was identified in the checked advertisement. Foreign citizens must confirm application permission, recognized qualifications, Indian medical registration, and appointment permission with the college.",
    residenceRule: "No applicant Maharashtra domicile restriction is printed as a blanket rule. Page 6 describes preference for certain candidates trained at Maharashtra government institutions; other candidates may be considered under its conditions. Residence and priority need individual confirmation.",
    languageNote: "Notice is mainly Marathi, with English qualification tables and form. It states no formal Marathi, Hindi or English proficiency level or certificate. Document language alone is not a language eligibility rule.",
    selectionStages: ["Submit prescribed form and attested qualification records within printed application window; notice describes direct delivery to the college's receipt office or email", `Attend published interview on ${notice.interviewOn}, if eligible`, "Present original documents and medical registration evidence", "Authority applies rank-specific selection and preference rules"],
    fee: "No application fee identified in the eight-page notice; confirm before submission.",
    salary: "Page 6 prints consolidated remuneration by faculty rank; founder must verify amount and applicable pay terms before publication.",
    rules: { complete: false, asOn: null, manualChecks: [
      { stage: "apply", text: "Confirm selected rank and subject, exact qualifications, age reckoning date, application delivery route and receipt by 28 September 17:00. Foreign-citizen eligibility is not stated." },
      { stage: "selection", text: "Confirm NMC medical registration, required experience, publications, courses, Maharashtra-institution priority, and 7 October interview attendance. No formal language level is printed." },
      { stage: "outcome", text: "Confirm professional licence recognition, work authorization, rank-specific contract terms and original certificates before appointment." },
    ] },
    venues: [cityVenue("Published interview: Government Medical College, Nashik", "Nashik", "IN", "MH")],
    sources: [
      evidenceSource(source, index.evidence, "Maharashtra DMER home news index, 24 September entry", "HTML", "English/Marathi"),
      evidenceSource(source, pdf.evidence, "GMC Nashik advertisement 04 and application form, 8 pages", "scanned PDF", "Marathi/English"),
    ],
    applicationUrl: notice.noticeUrl,
  });
  return { cycles: [cycle], evidence: [index.evidence, pdf.evidence], complete: false, warnings: [
    "Eight vacancies share one advertisement and application window; count one cycle, not eight. Rank and subject are choices within the call.",
    "Page 1 lists 21–28 September 2026, 11:00–17:00, with no named timezone or explicit inclusive final minute. The index first shows this PDF on 24 September.",
    "Foreign-citizen permission and formal language level are not stated. NMC registration and rank-specific credentials require individual review.",
    "This connector binds one Nashik PDF only; other DMER medical college recruitments and future corrigenda remain collection gaps.",
  ] };
};
