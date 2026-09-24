/**
 * Staff Selection Commission (India) — the exam calendar behind ssc.gov.in.
 * The calendar gives each exam's planned application window. Dates are the
 * Commission's tentative schedule until the notice is published, so records
 * say so and link to the notice board.
 */
import type { EligibilityRules, EducationLevel } from "../lib/eligibility/types.ts";
import type { OpportunityStatus } from "../lib/opportunities.ts";
import { civilDateIn, daysBetween, isIsoDate } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, slug } from "./util.ts";

const API = "https://ssc.gov.in/api/general-website/portal";
const ATTRIBUTES = "id,headline,examId,examYear,desc,content,contentType,startDate,endDate,language,createdAt";

export interface SscCalendarEntry {
  id: string;
  headline: string;
  examYear?: string;
  desc?: string;
  content?: string;
  startDate: string | null;
  endDate: string | null;
}

/** Only levels stated in the exam's own name, e.g. "Combined Graduate Level". */
export function levelFromName(name: string): { level: EducationLevel; quote: string } | null {
  if (/graduate level/i.test(name)) return { level: "bachelor", quote: "Combined Graduate Level" };
  if (/higher secondary|10\s*\+\s*2/i.test(name)) return { level: "higher-secondary", quote: "Higher Secondary (10+2) Level" };
  if (/matric/i.test(name)) return { level: "secondary", quote: "Matriculation Level" };
  return null;
}

export function statusFor(entry: SscCalendarEntry, today: string): OpportunityStatus {
  if (entry.startDate && today < entry.startDate) return "upcoming";
  if (entry.endDate && today > entry.endDate) return "closed";
  return "open";
}

export function selectEntries(entries: SscCalendarEntry[], today: string): SscCalendarEntry[] {
  // Keep upcoming, open, and anything that closed in the last 60 days.
  return entries.filter((entry) => isIsoDate(entry.endDate) && daysBetween(entry.endDate!, today) <= 60);
}

export const ssc: Connector = async ({ source, fetchText, now }) => {
  const url = `${API}/ssc-calendar?page=1&limit=100&contentType=ssc-calendar&key=startDate&order=DESC&isPaginationRequired=false&isAttachment=true&language=english&attributes=${ATTRIBUTES}`;
  const response = await fetchText(url, { accept: "application/json" });
  const body = JSON.parse(response.text) as { statusCode: string; data?: SscCalendarEntry[] };
  if (body.statusCode !== "200" || !Array.isArray(body.data)) throw new Error(`SSC calendar answered ${body.statusCode}`);
  const today = civilDateIn("Asia/Kolkata", now);
  const entries = selectEntries(body.data, today);
  const cycles = entries.map((entry) => {
    const title = entry.headline.replace(/\s+/g, " ").trim();
    const status = statusFor(entry, today);
    const level = levelFromName(title);
    const rules: EligibilityRules = {
      asOn: null,
      nationality: {
        allowed: ["IN"],
        conditional: ["NP", "BT"],
        evidence: "SSC notices: a citizen of India, or a subject of Nepal or Bhutan (and certain others) with a certificate of eligibility.",
      },
      ...(level ? { education: { minLevel: level.level, finalYearAllowed: false, evidence: `Exam name: "${level.quote}". Exact subjects and cut-off dates are in the notice.` } } : {}),
    };
    return makeCycle({
      id: `ssc-${slug(title)}`,
      title,
      cycleLabel: entry.examYear ?? "",
      authority: "Staff Selection Commission",
      pathway: "recruitment",
      status,
      statusNote: "Dates come from SSC's published exam calendar and can move — the official notice has the final dates.",
      jurisdictionCode: "IN",
      jurisdictionName: "India",
      scopeLabel: "All-India recruitment to central government posts",
      outcome: "Group B and C posts in central government ministries, departments and forces",
      applicationWindow: {
        opensOn: entry.startDate,
        closesOn: entry.endDate,
        officialTimeZone: "Asia/Kolkata",
        cutoffLocalTime: null,
        precision: "date",
        note: entry.content ? `Exam planned for ${entry.content.trim()}${entry.desc ? ` (${entry.desc.trim()})` : ""}.` : undefined,
      },
      qualifications: level ? `${level.quote} — see the notice for accepted subjects.` : "See the notice.",
      citizenshipRule: "Citizen of India, or subject of Nepal/Bhutan with a certificate of eligibility.",
      residenceRule: "No residence requirement.",
      selectionStages: ["Computer-based exam", "Further tiers, skill test or physical test depending on post", "Document verification"],
      fee: "See the notice (women, SC, ST, PwBD and ex-servicemen are usually exempt).",
      rules,
      venues: [{ kind: "unknown", name: "Exam centres across India, listed in the notice" }],
      sources: [
        evidenceSource(source, response.evidence, "SSC exam calendar", "JSON", "English", "https://ssc.gov.in/"),
        { ...evidenceSource(source, response.evidence, "SSC notice board", "HTML", "English", "https://ssc.gov.in/"), id: `${source.id}:notices` },
      ],
      applicationUrl: status === "open" ? "https://ssc.gov.in/login" : null,
    });
  });
  return { cycles, evidence: [response.evidence], warnings: [] };
};
