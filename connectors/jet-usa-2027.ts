/** Japan JET 2027 jobs through US citizenship route; official HTML only. */
import { readFileSync } from "node:fs";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  timelineUrl: string; eligibilityUrl: string; programmeUrl: string; howToUrl: string;
  guidelinesUrl: string; applicationUrl: string; opensOn: string; closesOn: string;
  cutoffLocalTime: string; officialTimeZone: string; cycleLabel: string;
}
const data = JSON.parse(readFileSync(new URL("../data/extractions/jet-usa-2027.json", import.meta.url), "utf8")) as Extraction;
const plain = (html: string) => stripTags(html).replace(/\s+/g, " ");

/** Critical claims must still be present in the current, named 2027 pages. */
export function verifyJetUsa2027Pages(pages: Record<"timeline" | "eligibility" | "programme" | "howTo", string>): void {
  const timeline = plain(pages.timeline);
  const section = timeline.split("TIMELINE (2027 JET Program Cycle)")[1]?.split("MAIN ARRIVALS (2027 JET Program Cycle)")[0] ?? "";
  const deadlines = [...section.matchAll(/Application Deadline:\s*([\s\S]*?)(?=\s+Interviews:|$)/gi)].map((match) => match[1].trim());
  if (!/Application Available: Monday, September 21, 2026/.test(section) ||
      deadlines.length !== 1 || deadlines[0] !== "Friday, November 13, 2026 at 11:59pm HST") {
    throw new Error("JET USA 2027 application dates changed; review required");
  }
  const eligibility = plain(pages.eligibility);
  if (!eligibility.includes("All applicants for the 2027 Program must:") ||
      !eligibility.includes("Be a citizen of the United States by the application deadline") ||
      !eligibility.includes("Hold at least a Bachelor’s degree or obtain such qualifications by June 25th, 2027") ||
      !eligibility.includes("Have excellent standard pronunciation, rhythm, intonation in the English language") ||
      !eligibility.includes("CIR applicants must:") ||
      !eligibility.includes("Japanese Language Proficiency Test Level N1 or N2 is desirable")) {
    throw new Error("JET USA 2027 citizenship, qualification or language wording changed; review required");
  }
  const programme = plain(pages.programme);
  if (!programme.includes("Assistant Language Teachers (ALTs)") ||
      !programme.includes("Coordinators for International Relations (CIRs)") ||
      !programme.includes("public and private schools throughout Japan")) {
    throw new Error("JET USA 2027 position types changed; review required");
  }
  const howTo = plain(pages.howTo);
  if (!howTo.includes("100% paperless online application") || !howTo.includes("jetapplication.com")) {
    throw new Error("JET USA application route changed; review required");
  }
}

export const jetUsa2027: Connector = async ({ source, fetchText, now }) => {
  const urls = { timeline: data.timelineUrl, eligibility: data.eligibilityUrl, programme: data.programmeUrl, howTo: data.howToUrl };
  const responses = {} as Record<keyof typeof urls, Awaited<ReturnType<typeof fetchText>>>;
  for (const [key, url] of Object.entries(urls) as [keyof typeof urls, string][]) {
    const response = await fetchText(url, { accept: "text/html" });
    if (response.evidence.url !== url) throw new Error(`JET USA ${key} redirected; review required`);
    responses[key] = response;
  }
  verifyJetUsa2027Pages(Object.fromEntries(Object.entries(responses).map(([key, response]) => [key, response.text])) as Record<keyof typeof urls, string>);
  const opens = Date.parse(`${data.opensOn}T00:00:00-10:00`);
  const closes = Date.parse("2026-11-14T00:00:00-10:00"); // 23:59 HST is the last published minute.
  const status = now.getTime() < opens ? "upcoming" as const : now.getTime() >= closes ? "closed" as const : "open" as const;
  const cycle = makeCycle({
    id: "jet-usa-2027-alt-cir", sourceId: source.id,
    title: "JET Programme USA 2027 — ALT or CIR",
    programme: "Japan Exchange and Teaching Programme, US application route",
    cycleLabel: data.cycleLabel, authority: source.authority,
    pathway: "recruitment", jurisdictionCode: "JP", jurisdictionName: "Japan",
    scopeLabel: "Japanese government-managed exchange employment. US citizens apply through JET Program USA; selected ALTs work in public or private schools and CIRs mainly in local government offices. Exact placement is assigned later.",
    outcome: "One application route where candidates choose Assistant Language Teacher (ALT) or Coordinator for International Relations (CIR). Selection can lead to a one-year paid appointment by a Japanese contracting organisation; placement and appointment are not guaranteed.",
    status,
    statusNote: "JET Program USA official 2027 timeline and eligibility pages checked. First connector output awaits founder review; the linked 2027 guidelines PDF is not fetched because its path is disallowed by robots.txt.",
    applicationWindow: { opensOn: data.opensOn, closesOn: data.closesOn, cutoffLocalTime: data.cutoffLocalTime,
      cutoffInclusive: true, officialTimeZone: data.officialTimeZone, precision: "minute",
      note: "US route: application available 21 September 2026; deadline Friday 13 November 2026 at 11:59 pm Hawaii Standard Time. Other citizenship routes use their own embassy deadlines." },
    qualifications: "JET Program USA 2027 eligibility page says US citizenship by application deadline and a bachelor's degree by 25 June 2027. General 2027 guidelines link may allow a three-year teaching credential alternative for ALT; reconcile that with US-specific page before any exclusion based on education. Other health, history and Japan-residence conditions need review.",
    citizenshipRule: "Only US citizens may use this US application route; US permanent residence alone is insufficient. Citizens of India or other countries must use their own Japanese embassy or consulate route. This does not say they are barred from the JET Programme globally.",
    residenceRule: "US eligibility page excludes people who have lived in Japan for six or more years total since 2017. US residence itself is not stated as a requirement for US citizens; verify current interview and entry conditions.",
    languageNote: "All US applicants need excellent spoken and written English; no CEFR score is stated. ALT applicants do not have a mandatory Japanese level. CIR applicants need strong functional Japanese; ability around JLPT N1/N2 is desirable, but a JLPT certificate is not required. Role-specific language must be reviewed separately.",
    selectionStages: ["Online application through official JET portal, choosing ALT or CIR", "Application screening", "Interview scheduled by US JET offices in late January 2027", "Results in April 2027 and placement notification from May", "Contracting organisation appointment and work-visa arrangements"],
    fee: "Application fee not stated in the checked official US programme pages; verify on portal and linked guidelines.",
    rules: { complete: false, asOn: null,
      nationality: { allowed: ["US"], evidence: "JET Program USA, Eligibility Criteria, 2027: US citizenship required by application deadline; permanent residents who are not US citizens cannot apply through the US route." },
      languages: [{ language: "en", requirement: "Excellent standard pronunciation, rhythm and intonation and strong speaking and writing ability; no CEFR score published.", stage: "apply", evidence: "JET Program USA 2027 Eligibility Criteria, common language condition 6.", sourceUrl: data.eligibilityUrl }],
      manualChecks: [
        { stage: "apply", text: "Confirm bachelor's-degree date or any ALT teaching-credential alternative against the linked 2027 guidelines; choose one role, check Japan residence and prior JET history. US citizenship route cannot be transferred to other embassies." },
        { stage: "selection", text: "Confirm English ability; CIR additionally needs functional Japanese. N1/N2 equivalent is desirable, not a required JLPT certificate. Interview and documents require authority review." },
        { stage: "outcome", text: "Confirm Japanese contracting organisation placement, appointment, entry permission and any dual-nationality renunciation requirements." },
      ],
    },
    venues: [{ kind: "unknown", name: "Japan workplace assigned after selection; no location pin can be inferred" }],
    sources: [
      evidenceSource(source, responses.timeline.evidence, "JET Program USA 2027 application and departure timeline", "HTML", "English"),
      evidenceSource(source, responses.eligibility.evidence, "JET Program USA 2027 eligibility criteria", "HTML", "English"),
      evidenceSource(source, responses.programme.evidence, "JET Program USA ALT and CIR position descriptions", "HTML", "English"),
      evidenceSource(source, responses.howTo.evidence, "JET Program USA online application instructions", "HTML", "English"),
      evidenceSource(source, responses.timeline.evidence, "2027 JET USA application guidelines; linked for manual review", "PDF", "English", data.guidelinesUrl),
    ],
    applicationMethod: "online", applicationUrl: data.applicationUrl,
  });
  return { cycles: [cycle], evidence: Object.values(responses).map((response) => response.evidence), complete: false, warnings: [
    "US route is for US citizens only. India and other citizenship routes have separate embassy requirements and deadlines.",
    "One US application cycle offers ALT or CIR role choice; programme placements may be public or private, and no vacancy total is inferred.",
    "2027 guidelines PDF is linked but robots.txt disallows /wp-content/uploads/; founder must review it manually before approval, especially the ALT teaching-credential alternative.",
    "The how-to page still calls the portal form a 2026 application in one sentence despite its 2027 heading; current timeline and eligibility pages control the extracted 2027 facts pending review.",
  ] };
};
