/** Andhra PSC brief-notification pilot. Exact PDF evidence; founder review required. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

export const ANDHRA_INDEX = "https://portal-psc.ap.gov.in/HomePages/RecruitmentNotifications";
interface Extraction {
  notification: string; documentUrl: string; sha256: string; post: string; provisionalVacancies: number;
  opensOn: string; closesOn: string; cutoffLocalTime: string; detailedNoticeDueOnOrBefore: string;
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/andhra-16-2026.json", import.meta.url), "utf8")) as Extraction;

export function parseAndhraIndex(html: string) {
  const entries = [...html.matchAll(/<li>\s*<a\b[^>]*href="([^"]+)"[^>]*>\s*<span>([\s\S]*?)<\/span>\s*<\/a>\s*<\/li>/gi)]
    .map((match) => ({ url: new URL(match[1], ANDHRA_INDEX), title: stripTags(match[2]).replace(/\s+/g, " ") }))
    .filter((entry) => /Notification No\.\s*\d+\/2026/i.test(entry.title));
  if (!entries.length) throw new Error("Andhra recruitment index changed: no 2026 notifications");
  for (const entry of entries) {
    if (entry.url.origin !== "https://psc.ap.gov.in" || !/^\/Documents\/NotificationDocuments\/[^/]+\.pdf$/i.test(entry.url.pathname) || entry.url.search || entry.url.hash) throw new Error("Andhra recruitment document outside official PDF archive");
  }
  const selected = entries.filter((entry) => new RegExp(`Notification No\\.\\s*0?16/2026\\b`, "i").test(entry.title));
  if (selected.length !== 1 || selected[0].url.href !== extraction.documentUrl || !/Forest Range Officers in A\.P\. Forest Service/i.test(selected[0].title)) throw new Error("Andhra 16/2026 brief notice changed or amended; founder review required");
  return { selected: { url: selected[0].url.href, title: selected[0].title }, count2026: entries.length };
}

export const andhraPsc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("Andhra exact PDF evidence fetch required");
  const index = await fetchText(ANDHRA_INDEX, { accept: "text/html" });
  const parsed = parseAndhraIndex(index.text);
  const today = civilDateIn("Asia/Kolkata", now);
  if (today >= extraction.detailedNoticeDueOnOrBefore) throw new Error("Andhra detailed notice is due; brief-notice extraction must be replaced before application opens");
  const pdf = await fetchBytes(parsed.selected.url, { accept: "application/pdf" });
  const hash = createHash("sha256").update(pdf.bytes).digest("hex");
  if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || hash !== extraction.sha256 || pdf.evidence.sha256 !== hash || pdf.evidence.url !== extraction.documentUrl) throw new Error("Andhra 16/2026 PDF bytes changed; old dates and language evidence withheld");
  const cycle = makeCycle({
    id: "andhra-psc-2026-16-forest-range-officers", sourceId: source.id,
    title: extraction.post, cycleLabel: `Notification ${extraction.notification}`, authority: source.authority,
    pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-AP"],
    scopeLabel: "Andhra Pradesh Forest Service recruitment; applicant residence and local status need detailed-notice review",
    outcome: `Forest Range Officer appointment (${extraction.provisionalVacancies} provisional vacancies; number may change)`,
    status: "upcoming", statusNote: "Brief notice announces future application window. Detailed notice is due by 16 October; founder review pending.",
    applicationWindow: { opensOn: extraction.opensOn, closesOn: extraction.closesOn, cutoffLocalTime: extraction.cutoffLocalTime, officialTimeZone: null, precision: "minute", note: "Dates and clock from original brief notice, page 1; governing timezone is not established. Detailed notification may revise conditions and must be checked before opening." },
    qualifications: "Brief notice page 1 lists bachelor's degrees in named science, engineering and related fields or equivalent qualifications. Full qualification and physical requirements await detailed notice.",
    citizenshipRule: "International applicant eligibility is not established by the brief notice. Await detailed notification and service rules.",
    residenceRule: "Andhra Pradesh hiring scope does not establish an applicant domicile rule. Await detailed notification.",
    selectionStages: [
      "Single-level online computer-based recruitment test; no screening test stated in brief notice.",
      "English and Telugu each have a qualifying test at SSC Standard; no CEFR level is stated.",
      "Walking test and Medical Board examination arranged by the Forest Department for eligible candidates at the stated 1:3 ratio; detailed physical standards await the detailed notice.",
      "Computer Proficiency Test is a separate qualifying test for eligible candidates at the stated 1:3 ratio.",
    ],
    rules: { complete: false, asOn: null, languages: [
      { language: "en", requirement: "General English qualifying test, 50 marks, SSC Standard; must qualify separately.", stage: "selection", evidence: "Brief Notification 16/2026, annexure, written-examination scheme and qualifying-test syllabus (pages 3–4).", sourceUrl: extraction.documentUrl },
      { language: "te", requirement: "General Telugu qualifying test, 50 marks, SSC Standard; must qualify separately.", stage: "selection", evidence: "Brief Notification 16/2026, annexure, written-examination scheme and qualifying-test syllabus (pages 3–4).", sourceUrl: extraction.documentUrl },
    ] },
    sources: [
      { ...evidenceSource(source, index.evidence, "Recruitment notifications index", "HTML", "English"), lastValidatedAt: null },
      { ...evidenceSource(source, pdf.evidence, "Brief Notification 16/2026 and examination scheme", "PDF", "English"), lastValidatedAt: null },
    ],
    applicationUrl: null,
  });
  return { cycles: [cycle], evidence: [index.evidence, pdf.evidence], warnings: [`Index contains ${parsed.count2026} numbered 2026 notices; this document-bound pilot stages only 16/2026. Remaining notices and departments remain gaps.`, "Detailed notice is due by 16 October 2026. Nationality, residence, age and physical eligibility are unverified; passing the language test alone does not establish eligibility."] };
};
