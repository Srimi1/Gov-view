/** Two exact Jharkhand child-protection appointment notices; founder review only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { OpportunityCycle } from "../lib/opportunities.ts";
import type { Connector, Evidence, SourceConfig } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Notice {
  id: string; documentUrl: string; sha256: string; noticeNumber: string;
  closesOn: string; indexDeadline: string; vacancies: number; type: "JJB" | "JJB_CWC";
}
interface Extraction { indexUrl: string; applicationUrl: string; notices: Notice[] }
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/jharkhand-jjb-cwc-2026.json", import.meta.url), "utf8")) as Extraction;

/** No new JJB/CWC row may silently inherit previously reviewed PDF fields. */
export function verifyJharkhandChildProtectionIndex(html: string): void {
  const section = /<h2>Recruitment<\/h2>([\s\S]*?)<h2>Notice<\/h2>/i.exec(html)?.[1] ?? "";
  const otherNotices = /<h2>Notice<\/h2>([\s\S]*?)<\/div>\s*<\/div>/i.exec(html)?.[1] ?? "";
  if (/JUVENILE JUSTICE BOARD|CHILD WELFARE COMMITTEE|\bJJB\b|\bCWC\b/i.test(stripTags(otherNotices))) {
    throw new Error("Jharkhand JJB/CWC later notice requires founder review");
  }
  const rows = [...section.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => match[1])
    .filter((row) => /JUVENILE JUSTICE BOARDS|CHILD WELFARE COMMITTEES|\bJJB\b|\bCWC\b/i.test(stripTags(row)));
  if (rows.length !== extraction.notices.length) throw new Error("Jharkhand JJB/CWC notice set changed; review required");
  for (const notice of extraction.notices) {
    const matching = rows.filter((row) => {
      const href = /<a\b[^>]*href=["']([^"']+)["']/i.exec(row)?.[1];
      return href && new URL(href, extraction.indexUrl).href === notice.documentUrl;
    });
    if (matching.length !== 1) throw new Error(`Jharkhand ${notice.noticeNumber} notice link changed; review required`);
    const rowText = stripTags(matching[0]).replace(/\s+/g, " ");
    const expectedTitle = notice.type === "JJB_CWC" ? /JUVENILE JUSTICE BOARDS.*CHILD WELFARE COMMITTEES/i : /JUVENILE JUSTICE BOARDS \(JJBs\) IN THE STATE OF JHARKHAND/i;
    if (!expectedTitle.test(rowText) || !rowText.includes(`Last date to apply - ${notice.indexDeadline}`)) {
      throw new Error(`Jharkhand ${notice.noticeNumber} title or deadline changed; review required`);
    }
  }
}

function statusForDate(closesOn: string, now: Date): OpportunityCycle["status"] {
  if (civilDateIn("Etc/GMT+12", now) > closesOn) return "closed";
  if (civilDateIn("Pacific/Kiritimati", now) < closesOn) return "open";
  return "uncertain";
}

function makeNoticeCycle(notice: Notice, source: SourceConfig, index: Evidence, pdf: Evidence, now: Date): OpportunityCycle {
  const combined = notice.type === "JJB_CWC";
  return makeCycle({
    id: notice.id, sourceId: source.id,
    title: combined ? "Jharkhand Juvenile Justice Board and Child Welfare Committee members" : "Jharkhand Juvenile Justice Board social worker members",
    cycleLabel: `Notification ${notice.noticeNumber}/2026`,
    programme: "Jharkhand child-protection honorary appointments",
    authority: "Jharkhand State Child Protection Society, Department of Women, Child Development and Social Security",
    pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-JH"],
    scopeLabel: combined
      ? "One district-specific application can list preferences for JJB or CWC roles. Four JJB and seven CWC openings across different districts; districts are appointment locations, not exam venues."
      : "Six JJB openings in distinct districts listed in Annexure A. District choices are appointment locations, not exam venues.",
    outcome: `${notice.vacancies} tentative honorary child-protection board/committee positions, three-year term and ₹2,000 per sitting allowance. This is not a salaried government employee post.`,
    status: statusForDate(notice.closesOn, now),
    statusNote: "Official portal gives a 23:59 closing clock time; original notice gives the same date without time. Governing timezone is not printed. Founder review pending.",
    applicationWindow: { opensOn: null, closesOn: notice.closesOn, cutoffLocalTime: "23:59", officialTimeZone: null,
      precision: "minute", note: `Portal says ${notice.indexDeadline}; scanned English notice page 4 gives ${notice.closesOn} as final receipt date. No application opening time or official cutoff timezone is printed.` },
    qualifications: "JJB members: age 35–60 at appointment, recognised degree plus seven years' work with children in education, health, protection or welfare, or a specified practising professional degree. CWC notice has related but distinct qualification alternatives. Full statutory disqualifications and individual route need founder review.",
    citizenshipRule: "Neither checked notice states a citizenship criterion. Application form asks nationality and interview documents include Aadhaar; neither alone establishes that foreign citizens can or cannot hold these honorary appointments. Authority confirmation needed.",
    residenceRule: "Application asks present residence and distance to chosen district, but checked notices do not state a blanket Jharkhand-domicile condition. District preference is not residence eligibility.",
    languageNote: "Application form asks other languages known, if any. No mandatory language, proficiency level, certificate or language test is stated in the checked notices.",
    selectionStages: ["Online district-specific application", "Basic eligibility screening", "Selection Committee evaluation: interaction, qualifications and experience", "Document checks and state appointment decision"],
    fee: "No application fee stated in checked notices. An undertaking on non-judicial stamp paper of at least ₹100 is required; this is a document cost, not an application fee.",
    salary: "₹2,000 per sitting allowance; honorary engagement, not a monthly salary.",
    rules: { complete: false, asOn: null, manualChecks: [
      { stage: "apply", text: "Confirm nationality permission, age at appointment, degree/professional route, experience, conflict rules, district choice and stamp-paper undertaking from original notice." },
      { stage: "selection", text: "Confirm ability to attend interaction and provide documents. No mandatory language level is published in checked notices." },
      { stage: "outcome", text: "Confirm foreign-citizen appointment permission, statutory disqualifications and honorary three-year service conditions with authority." },
    ] },
    venues: [{ kind: "unknown", name: "Selection interaction venue not published in checked notices" }],
    sources: [
      evidenceSource(source, index, "Jharkhand recruitment portal current notice rows", "HTML", "English/Hindi"),
      evidenceSource(source, pdf, `Notification ${notice.noticeNumber}/2026 and annexures`, "scanned PDF", "English"),
    ],
    applicationMethod: "online", applicationUrl: extraction.applicationUrl,
  });
}

export const jharkhandJjbCwc2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("Jharkhand exact notice PDFs required");
  const index = await fetchText(extraction.indexUrl, { accept: "text/html" });
  if (index.evidence.url !== extraction.indexUrl) throw new Error("Jharkhand recruitment homepage redirected; review required");
  verifyJharkhandChildProtectionIndex(index.text);
  const evidence = [index.evidence];
  const cycles: OpportunityCycle[] = [];
  for (const notice of extraction.notices) {
    const pdf = await fetchBytes(notice.documentUrl, { accept: "application/pdf" });
    const hash = createHash("sha256").update(pdf.bytes).digest("hex");
    if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== notice.documentUrl ||
        pdf.evidence.sha256 !== hash || hash !== notice.sha256) {
      throw new Error(`Jharkhand ${notice.noticeNumber} PDF changed; extracted fields withheld`);
    }
    evidence.push(pdf.evidence);
    cycles.push(makeNoticeCycle(notice, source, index.evidence, pdf.evidence, now));
  }
  return { cycles, evidence, complete: false, warnings: [
    "Two district-disjoint honorary appointment notices staged. JJB and CWC preferences under notification 3062 are one application cycle, not separate counts.",
    "Home Guard notice is excluded: original Hindi PDF says volunteer service is neither daily government employment nor a livelihood channel.",
    "Neither nationality permission nor formal language level is printed. Aadhaar and nationality fields on the form cannot decide foreign-citizen eligibility.",
    "Notification 2979 is dated 1 September while its annexure says vacancies as of 22 September; founder must resolve its revision history.",
    "Only two named notices are checked; other Jharkhand portal, JPSC and district recruitment remain coverage gaps.",
  ] };
};
