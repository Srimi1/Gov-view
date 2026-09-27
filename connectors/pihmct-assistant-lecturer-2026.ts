/** PIHMCT Puducherry Assistant Lecturer recruitment; exact official PDF, review-only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle } from "./util.ts";

interface Extraction {
  boardUrl: string; detailUrl: string; noticeUrl: string; noticeSha256: string;
  publishedOn: string; closesOn: string; ageAsOn: string; positions: number;
}
const data = JSON.parse(readFileSync(new URL("../data/extractions/pihmct-assistant-lecturer-2026.json", import.meta.url), "utf8")) as Extraction;

/** Source page and listed original must still identify same application. */
export function verifyPihmctPages(boardHtml: string, detailHtml: string): void {
  const board = boardHtml.split('class="newitem"')[1]?.split('</span>')[0] ?? "";
  if (!board.includes('href="/applications-invited-03-posts-assistant-lecturer-contractual-basis"') ||
      !board.includes("APPLICATIONS INVITED FOR 03 POSTS OF ASSISTANT LECTURER ON CONTRACTUAL BASIS") ||
      !board.includes("19-08-2026")) {
    throw new Error("PIHMCT notice board item changed; review required");
  }
  const detail = detailHtml.split('<h1 tabindex="0" class="h1classeng" >')[1]?.split('<div style="clear:both"></div>')[0] ?? "";
  if (!detail.includes("APPLICATIONS INVITED FOR 03 POSTS OF ASSISTANT LECTURER ON CONTRACTUAL BASIS") ||
      !detail.includes("<td>19-08-2026</td>") ||
      !detail.includes(`href="${new URL(data.noticeUrl).pathname}"`)) {
    throw new Error("PIHMCT Assistant Lecturer detail or PDF link changed; review required");
  }
}

export const pihmctAssistantLecturer2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("PIHMCT original recruitment PDF bytes required");
  const [board, detail] = await Promise.all([
    fetchText(data.boardUrl, { accept: "text/html" }),
    fetchText(data.detailUrl, { accept: "text/html" }),
  ]);
  if (board.evidence.url !== data.boardUrl || detail.evidence.url !== data.detailUrl) {
    throw new Error("PIHMCT page redirected; review required");
  }
  verifyPihmctPages(board.text, detail.text);
  const document = await fetchBytes(data.noticeUrl, { accept: "application/pdf" });
  const sha256 = createHash("sha256").update(document.bytes).digest("hex");
  if (document.bytes.subarray(0, 5).toString() !== "%PDF-" ||
      document.evidence.url !== data.noticeUrl || document.evidence.sha256 !== sha256 ||
      sha256 !== data.noticeSha256) {
    throw new Error("PIHMCT Assistant Lecturer PDF changed; extracted fields withheld");
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today < data.publishedOn ? "upcoming" as const
    : today > data.closesOn ? "closed" as const
    : today === data.closesOn ? "uncertain" as const : "open" as const;
  const cycle = makeCycle({
    id: "pihmct-assistant-lecturer-2026", sourceId: source.id,
    title: "Assistant Lecturer — PIHMCT Puducherry", programme: "PIHMCT Assistant Lecturer contract recruitment 2026",
    cycleLabel: "PIHMCT August 2026 Assistant Lecturer notice", authority: source.authority,
    pathway: "recruitment", appointmentType: "contract", jurisdictionCode: "IN", jurisdictionName: "India",
    subdivisionCodes: ["IN-PY"],
    scopeLabel: "Pondicherry Institute of Hotel Management and Catering Technology, sponsored by Government of India and Government of Puducherry. Murungapakkam is the application-delivery address, not a published test venue or applicant domicile rule.",
    outcome: `${data.positions} Assistant Lecturer contract positions; consolidated ₹35,000 per month. Contract duration and final work posting are not stated in retained PDF.`,
    status,
    statusNote: "Official PIHMCT notice board, detail and exact six-page PDF retained. First connector output awaits founder review; receipt hours and later amendments require confirmation.",
    applicationWindow: { opensOn: null, closesOn: data.closesOn, cutoffLocalTime: null, officialTimeZone: null, precision: "date",
      note: "Original notice says application and testimonials must reach PIHMCT Principal on or before 25 October 2026. No receipt clock time or official timezone is named. Notice-board date 19 August is publication, not application opening." },
    qualifications: "Alternative Category A: postgraduate Hospitality/Tourism or MBA plus a qualifying full-time hotel/hospitality/culinary degree or three-year diploma with at least 55%; recognized foreign equivalent may count with AIU recognition. Alternative Category B: qualifying full-time bachelor's with at least 55% and two years hospitality industry experience. NHTET with prescribed marks is normally required, but a qualifying Hospitality PhD after the base qualification removes that requirement. Exact equivalence and experience require review.",
    citizenshipRule: "PDF application form asks nationality, but notice gives no citizenship restriction or foreign-citizen acceptance rule. Recognition of a foreign qualification does not prove foreign-citizen permission. International applicants need institute confirmation before applying, selection, or appointment.",
    residenceRule: "No applicant domicile or residence condition is stated. Correspondence-address form field and Murungapakkam delivery address do not establish such a rule.",
    languageNote: "Notice and application form state no mandatory language or formal proficiency level. NHTET is a hospitality teaching eligibility test, not a language-level certificate.",
    selectionStages: ["Ensure official form, testimonial copies and recent passport-size photograph reach PIHMCT Principal by receipt deadline", "Skill test prescribed by NCHMCT, with applicable NHTET weightage", "Credential and eligibility verification before contract appointment"],
    fee: "No application fee stated in retained PIHMCT PDF; confirm with institute before submission.",
    salary: "Consolidated ₹35,000 per month.",
    rules: { complete: false, asOn: data.ageAsOn, manualChecks: [
      { stage: "apply", text: "Confirm nationality/work permission, category A or B qualification alternative, AIU foreign-equivalence route, 55% marks, NHTET or PhD exemption, age 35 maximum for general on 1 July 2026 and any category relaxation." },
      { stage: "selection", text: "Confirm NCHMCT skill test, NHTET weightage, original documents and test venue. No venue or language-level requirement is published in this PDF." },
      { stage: "outcome", text: "Confirm foreign-citizen work authorization if applicable, contract tenure, final workplace and appointment documents." },
    ] },
    venues: [{ kind: "unknown", name: "Skill-test venue not published; Murungapakkam is application-delivery address" }],
    sources: [
      evidenceSource(source, board.evidence, "PIHMCT official notice board, 19 August 2026", "HTML", "English"),
      evidenceSource(source, detail.evidence, "PIHMCT Assistant Lecturer notice detail", "HTML", "English"),
      evidenceSource(source, document.evidence, "PIHMCT Assistant Lecturer notification and application form", "PDF", "English"),
    ],
    applicationUrl: data.noticeUrl,
  });
  return { cycles: [cycle], evidence: [board.evidence, detail.evidence, document.evidence], complete: false, warnings: [
    "Three positions share one Assistant Lecturer application form; no duplicate opportunity count is created.",
    "Notice gives no nationality rule or formal language level; a nationality form field and foreign-degree equivalence clause do not establish foreign applicant acceptance.",
    "Category A/B qualifications, NHTET or Hospitality PhD exemption, age relaxation, skill-test details and contract duration need founder review.",
    "25 October is a physical receipt deadline with no published office cutoff hour or official timezone.",
    "Only this PIHMCT notice is collected; Puducherry government, DPAR and other institutes remain coverage gaps.",
  ] };
};
