/** One official Canada.ca student-programme card; GC Jobs poster needs founder review. */
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  indexUrl: string; title: string; authority: string; closesOn: string; applicationUrl: string;
  workStartsOn: string; workEndsOn: string;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/ca-fswep-great-lakes-2027.json", import.meta.url), "utf8")) as Extraction;

/** Require this exact programme, organisation, date and poster ID on the official page. */
export function verifyGreatLakesCard(html: string): void {
  const cards = [...html.matchAll(/<details>\s*<summary>([^<]+)<\/summary>([\s\S]*?)<\/details>/gi)]
    .filter((match) => stripTags(match[1]).trim() === notice.title);
  const card = cards[0]?.[2] ?? "";
  const text = stripTags(card).replace(/\s+/g, " ");
  const link = /<a\b[^>]*href="([^"]+)"[^>]*role="button"[^>]*>\s*Apply\s*<\/a>/i.exec(card)?.[1];
  const url = link ? new URL(link.replaceAll("&amp;", "&"), notice.indexUrl).href : null;
  const page = stripTags(html).replace(/\s+/g, " ");
  if (cards.length !== 1 || !text.includes(`Organization : ${notice.authority}`) ||
      !text.includes("Deadline to apply : October 28, 2026") ||
      !text.includes("Full time (April 26, 2027 to September 3, 2027)") ||
      url !== notice.applicationUrl ||
      !/registered as a full-time student in a secondary or post-secondary accredited academic institution/i.test(page) ||
      !/minimum age requirement in the province or territory of work/i.test(page) ||
      !/Preference will be given to Canadian citizens and permanent residents/i.test(page)) {
    throw new Error("Canada FSWEP Great Lakes card or general criteria changed; review required");
  }
}

export const caFswepGreatLakes: Connector = async ({ source, fetchText, now }) => {
  const page = await fetchText(notice.indexUrl, { accept: "text/html" });
  if (page.evidence.url !== notice.indexUrl) throw new Error("Canada FSWEP official page redirected; review required");
  verifyGreatLakesCard(page.text);
  // Canada.ca gives a calendar date but no governing deadline zone. Use the
  // world's last civil date only for safe closure; never label an official zone.
  const definitelyPast = civilDateIn("Etc/GMT+12", now) > notice.closesOn;
  const cycle = makeCycle({
    id: "ca-fswep-great-lakes-student-2027", sourceId: source.id,
    title: "Great Lakes Area Summer Fisheries Student Program — 2027",
    programme: "Federal Student Work Experience Program — Great Lakes fisheries",
    cycleLabel: "Summer 2027 · GC Jobs poster 2042",
    authority: source.authority,
    pathway: "recruitment", jurisdictionCode: "CA", jurisdictionName: "Canada",
    scopeLabel: "Federal student work programme in the Great Lakes area. Exact work sites are not printed on the checked Canada.ca card.",
    outcome: `Potential full-time summer student assignment with Fisheries and Oceans Canada, ${notice.workStartsOn} to ${notice.workEndsOn}; applying to the inventory does not guarantee a placement.`,
    status: definitelyPast ? "closed" : "open",
    statusNote: "Canada.ca lists this specialized student programme and 28 October 2026 deadline. GC Jobs poster and exact cutoff timezone could not be collected; founder review pending.",
    applicationWindow: { opensOn: null, closesOn: notice.closesOn, officialTimeZone: null, cutoffLocalTime: null,
      precision: "date", note: "Official Canada.ca FSWEP card prints 28 October 2026 only. It gives neither an application opening date nor a governing cutoff time or timezone." },
    qualifications: "General FSWEP criteria: full-time student at an accredited secondary or post-secondary institution; minimum age for the province or territory of work; return to full-time studies next term, unless a final-year applicant has prior FSWEP, Co-op/Internship or Research Affiliate Program employment. Programme-specific study, work permit and security requirements need the linked GC Jobs poster.",
    citizenshipRule: "Canada.ca gives preference to Canadian citizens and permanent residents meeting job requirements. It does not state that every foreign citizen may apply, enter selection or be appointed to this specific programme. Confirm GC Jobs poster, work authorization and selection rules.",
    residenceRule: "The checked card states no applicant residence restriction. Great Lakes area describes the programme's work region, not a domicile eligibility rule.",
    languageNote: "The checked Canada.ca card states no language test, bilingual requirement or proficiency level for this programme. Verify the linked GC Jobs poster before judging English/French or other language eligibility.",
    selectionStages: ["Submit specialized FSWEP application through GC Jobs", "Possible inventory match and agency screening", "Test or interview if invited", "Security and employment eligibility checks", "Summer 2027 work assignment if selected"],
    fee: "No fee stated on the checked Canada.ca FSWEP card; verify the linked job poster.",
    rules: { complete: false, asOn: null, manualChecks: [
      { stage: "apply", text: "Verify full-time accredited student status, provincial/territorial minimum work age, return-to-study or final-year prior-programme exception, and exact poster-specific application conditions. Foreign-citizen permission is unresolved." },
      { stage: "selection", text: "Confirm programme-specific education, language, security and work-authorization rules in GC Jobs poster 2042; Canada.ca gives Canadian citizens and permanent residents preference." },
      { stage: "outcome", text: "Confirm legal work authorization, any security screening and agency appointment criteria. Inventory application does not guarantee employment." },
    ] },
    venues: [{ kind: "unknown", name: "Great Lakes area; exact work sites and selection venues not published on checked card" }],
    sources: [evidenceSource(source, page.evidence, "Canada.ca Federal Student Work Experience Program — Great Lakes 2027 card", "HTML", "English")],
    applicationMethod: "online", applicationUrl: notice.applicationUrl,
  });
  return { cycles: [cycle], evidence: [page.evidence], complete: false, warnings: [
    "GC Jobs poster 2042 did not respond to this collector; programme-specific conditions and cutoff timezone need founder review.",
    "Canada.ca's citizen/permanent-resident preference is not a blanket ban on foreign applicants and does not establish work authorization.",
    "Other FSWEP specialized programmes and the year-round student inventory remain source coverage gaps.",
  ] };
};
