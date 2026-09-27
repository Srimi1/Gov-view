/**
 * Staff Selection Commission (India) — the exam calendar behind ssc.gov.in.
 * The calendar gives each exam's planned application window. Dates are the
 * Commission's tentative schedule until the notice is published, so records
 * say so and link to the notice board.
 */
import type { EducationLevel } from "../lib/eligibility/types.ts";
import type { OpportunityStatus } from "../lib/opportunities.ts";
import { civilDateIn, daysBetween, isIsoDate } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, itemHash, makeCycle, shortHash, slug } from "./util.ts";

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

export function statusFor(_entry: SscCalendarEntry, _today: string): OpportunityStatus {
  // This feed is a tentative calendar, not a published application notice.
  return "uncertain";
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
  const legacyCounts = new Map<string, number>();
  for (const entry of entries) {
    const oldId = `ssc-${slug(entry.headline.replace(/\s+/g, " ").trim())}`;
    legacyCounts.set(oldId, (legacyCounts.get(oldId) ?? 0) + 1);
  }
  const cycles = entries.map((entry) => {
    const title = entry.headline.replace(/\s+/g, " ").trim();
    const oldId = `ssc-${slug(title)}`;
    const status = statusFor(entry, today);
    const level = levelFromName(title);
    return makeCycle({
      id: `ssc-${slug(title, 48)}-${slug(entry.examYear || /(?:19|20)\d{2}/.exec(title)?.[0] || "unknown", 8)}-${shortHash(entry.id, 12)}`,
      legacyIds: legacyCounts.get(oldId) === 1 ? [oldId] : [],
      title,
      cycleLabel: entry.examYear ?? "",
      authority: "Staff Selection Commission",
      pathway: "recruitment",
      status,
      statusNote: "Tentative SSC exam calendar entry. Application dates require the official examination notice.",
      jurisdictionCode: "IN",
      jurisdictionName: "India",
      scopeLabel: "SSC examination; appointing body and job locations require the examination notice.",
      outcome: "Recruitment through the named examination; posts and appointment conditions require the examination notice.",
      applicationWindow: {
        opensOn: null,
        closesOn: null,
        officialTimeZone: "Asia/Kolkata",
        cutoffLocalTime: null,
        precision: "unknown",
        note: `Tentative calendar: applications ${entry.startDate ?? "date not given"} to ${entry.endDate ?? "date not given"}.${entry.content ? ` Exam planned for ${entry.content.trim()}${entry.desc ? ` (${entry.desc.trim()})` : ""}.` : ""}`,
      },
      qualifications: level ? `The calendar names this ${level.quote} examination. Exact degree, final-year, subject, age and post conditions require the notice.` : "The calendar does not state applicant qualifications; check the examination notice.",
      citizenshipRule: "Calendar does not state nationality or foreign-citizen eligibility; check the examination notice.",
      residenceRule: "Calendar does not state residence requirements; check the examination notice.",
      languageNote: "Calendar does not establish any language proficiency requirement or level; check the examination notice.",
      selectionStages: ["Calendar does not establish the full selection process; check the examination notice."],
      fee: "Calendar does not state application fee or exemptions; check the examination notice.",
      rules: { asOn: null, manualChecks: [{ stage: "apply", text: "Tentative calendar alone cannot determine eligibility. Verify the examination notice for nationality, residence, age, qualifications, language, fee and application dates." }] },
      venues: [{ kind: "unknown", name: "Exam venue not given in the calendar" }],
      sources: [
        { ...evidenceSource(source, response.evidence, "SSC exam calendar entry", "JSON", "English"), itemSha256: itemHash(entry) },
        evidenceSource(source, response.evidence, "Examination notices (linked; not checked for this entry)", "HTML", "English", "https://ssc.gov.in/"),
      ],
      applicationUrl: null,
    });
  });
  return { cycles, evidence: [response.evidence], complete: true, warnings: [] };
};
