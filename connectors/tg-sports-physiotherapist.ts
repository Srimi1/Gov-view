/** One exact Telangana State Sports Department physiotherapist intake. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  indexUrl: string; noticeUrl: string; noticeSha256: string; applicationUrl: string;
  opensOn: string; closesOn: string; cutoffLocalTime: string;
  physicalFormDate: string; physicalFormStart: string; physicalFormEnd: string;
  officialTimeZone: string;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/tg-sports-physiotherapist-2026.json", import.meta.url), "utf8")) as Extraction;

/** Live visible title, dates and official links must still name the same intake. */
export function verifyTgSportsIndex(html: string): void {
  const headings = [...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)]
    .map((match) => stripTags(match[1]).replace(/\s+/g, " "))
    .filter((title) => /RECRUITMENT FOR PHYSIOTHERAPIST/i.test(title));
  if (headings.length !== 1 || !/\(Male Only\).*KHELO INDIA STATE CENTRE OF EXCELLENCE.*HAKIMPET/i.test(headings[0])) {
    throw new Error("Telangana Sports physiotherapist intake title changed; manual review required");
  }
  const lines = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((match) => stripTags(match[1]).replace(/\s+/g, " "));
  for (const pattern of [
    /Notification Start Date:\s*23-09-2026/i,
    /Online Application Start Date:\s*23-09-2026/i,
    /Online Application End Date:\s*26-09-2026 till 05:00 PM/i,
    /Physical Forms Submission On:\s*28-09-2026 11:00 AM to 05:00 PM/i,
  ]) if (lines.filter((line) => pattern.test(line)).length !== 1) {
    throw new Error("Telangana Sports application or physical-form dates changed; manual review required");
  }
  for (const url of [notice.noticeUrl, notice.applicationUrl]) {
    const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)]
      .map((match) => new URL(match[1], notice.indexUrl).href)
      .filter((value) => value === url);
    if (links.length !== 1) throw new Error("Telangana Sports official notice or application link changed; manual review required");
  }
}

export const tgSportsPhysiotherapist: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("Telangana Sports original PDF bytes required");
  const page = await fetchText(notice.indexUrl, { accept: "text/html" });
  if (page.evidence.url !== notice.indexUrl) throw new Error("Telangana Sports portal redirected; manual review required");
  verifyTgSportsIndex(page.text);
  const original = await fetchBytes(notice.noticeUrl, { accept: "application/pdf" });
  const hash = createHash("sha256").update(original.bytes).digest("hex");
  if (original.bytes.subarray(0, 5).toString() !== "%PDF-" || original.evidence.url !== notice.noticeUrl ||
      original.evidence.sha256 !== hash || hash !== notice.noticeSha256) {
    throw new Error("Telangana Sports notice PDF changed; extracted terms withheld");
  }
  const today = civilDateIn(notice.officialTimeZone, now);
  const status = today < notice.opensOn ? "upcoming" as const : today > notice.closesOn ? "closed" as const : "open" as const;
  const cycle = makeCycle({
    id: "tg-sports-physiotherapist-male-2026", sourceId: source.id,
    title: "Physiotherapist (male) — Telangana Khelo India State Centre of Excellence",
    cycleLabel: "Telangana State Sports Department physiotherapist intake, September 2026",
    programme: "Khelo India State Centre of Excellence physiotherapist recruitment",
    authority: source.authority, pathway: "recruitment",
    jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-TG"],
    scopeLabel: "Telangana State Sports Department role at Khelo India State Centre of Excellence, Hakimpet. Job location is not a published examination or interview venue.",
    outcome: "Physiotherapist Grade II role. Official portal calls for a male applicant; the retained notice does not print a numeric vacancy count or appointment tenure.",
    status,
    statusNote: "Official portal and exact qualification PDF checked. First output requires founder review; physical-form step and appointment terms remain unresolved.",
    applicationWindow: { opensOn: notice.opensOn, closesOn: notice.closesOn, cutoffLocalTime: notice.cutoffLocalTime,
      officialTimeZone: notice.officialTimeZone, precision: "minute",
      note: "Official portal: online application 23–26 September 2026, ending 17:00 IST. Separate physical-forms submission is listed for 28 September 11:00–17:00 IST; its recipients and procedure need authority review. Do not treat that later step as reopening online applications." },
    qualifications: "Master's in Physiotherapy from a recognized Indian or foreign university plus at least three years' physiotherapist work experience. The official PDF lists shortlisting scores for total experience, sports experience, master's marks and specialization. A recognized foreign degree is not evidence of foreign-citizen application or appointment permission.",
    citizenshipRule: "The portal and qualification PDF do not state a nationality rule. International applicants need Telangana State Sports Department confirmation for application, interview and appointment; a foreign-university degree is expressly accepted as a qualification only.",
    residenceRule: "No applicant domicile rule is stated in the portal or qualification PDF. The role is at Hakimpet; that does not establish where applicants must reside.",
    selectionStages: ["Online application and document upload", "Physical-forms submission step listed separately for 28 September; process needs review", "Shortlisting by experience, master's marks and specialization", "Interview scored on domain, practical knowledge, aptitude and soft skills", "Document and appointment checks"],
    fee: "No application fee stated in the retained portal announcement or qualification PDF; verify in the application portal before paying.",
    salary: "₹60,000–₹80,000 remuneration for Physiotherapist Grade II, per official PDF; tenure and benefits not stated.",
    rules: { complete: false, asOn: null,
      age: { max: 45, evidence: "Official physiotherapist PDF, page 2: maximum age not more than 45 years on last date of receipt of applications. Portal separately lists 26 September online close and 28 September physical-form submission; age cut-off date needs founder confirmation." },
      education: { minLevel: "master", evidence: "Official physiotherapist PDF, page 1: Master's in Physiotherapy from a recognized Indian or foreign university. Exact degree recognition needs review." },
      experience: { minYears: 3, evidence: "Official physiotherapist PDF, page 1: minimum three years of work experience as physiotherapist." },
      manualChecks: [
        { stage: "apply", text: "Confirm male-only portal scope, recognized physiotherapy degree, 3 years of role-specific experience, document upload, physical-form step, and any unstated fee." },
        { stage: "selection", text: "Confirm shortlisting, interview date/location and whether any language requirement applies. None is stated in the retained PDF." },
        { stage: "outcome", text: "Confirm nationality/work authorization, employer and appointment tenure, qualification recognition and final document checks." },
      ],
    },
    venues: [],
    sources: [
      evidenceSource(source, page.evidence, "Telangana Sports official recruitment portal and dates", "HTML", "English"),
      evidenceSource(source, original.evidence, "Official physiotherapist qualification and interview notice, 2 pages", "PDF", "English"),
    ],
    applicationUrl: notice.applicationUrl,
  });
  return { cycles: [cycle], evidence: [page.evidence, original.evidence], complete: false, warnings: [
    "The portal calls for a male applicant; the qualification PDF gives no numeric vacancy total, contract tenure, nationality rule or general language level.",
    "Recognized foreign university qualifications do not establish permission for foreign citizens to apply or be appointed.",
    "A separate physical-forms step on 28 September follows the 26 September 17:00 online close; founder must verify process, delivery destination and the resulting age cut-off date.",
    "The portal page contains older client-side role text. Only the current visible heading, dates, official notice link and exact PDF are used for this draft.",
  ] };
};
