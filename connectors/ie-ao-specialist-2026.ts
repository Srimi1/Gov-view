/** One Irish AO competition with four mutually exclusive specialist choices. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector, Evidence } from "./types.ts";
import { decodeEntities, evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Document { key: string; title: string; url: string; sha256: string }
interface Extraction {
  homepage: string; detailUrl: string; detailTextSha256: string; cardTextSha256: string;
  bookletFileIds: string[]; bookletSha256: string; documents: Document[];
  specialistQualifications: { name: string; summary: string }[];
}
const data = JSON.parse(readFileSync(new URL("../data/extractions/ie-ao-specialist-2026.json", import.meta.url), "utf8")) as Extraction;
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const compact = (html: string) => stripTags(html).replace(/\s+/g, " ").trim();

function officialPlatformUrl(raw: string, base: string): string {
  const url = new URL(decodeEntities(raw), base);
  if (url.protocol !== "https:" || url.hostname !== "publicjobs.tal.net" || url.username || url.password || url.port) {
    throw new Error("Irish AO linked recruitment host changed; review required");
  }
  return url.href;
}

export function ieAoJobBoardLink(html: string): string {
  const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .filter((match) => compact(match[2]) === "Job Search" && match[1].includes("/jobboard/vacancy/3/adv/"));
  const urls = [...new Set(links.map((match) => officialPlatformUrl(match[1], data.homepage)))];
  if (urls.length !== 1) throw new Error("Publicjobs published job board link missing or ambiguous");
  return urls[0];
}

export function ieAoCardText(html: string): string {
  const cards = [...html.matchAll(/<li\b[^>]*id="oppid-9005"[^>]*>([\s\S]*?)<\/li>/g)];
  if (cards.length !== 1) throw new Error("Irish AO 9005 card missing or duplicated; no closure inferred");
  const link = /<a\b[^>]*href="([^"]+)"/.exec(cards[0][1]);
  if (!link || !new URL(officialPlatformUrl(link[1], data.homepage)).pathname.includes("/opp/9005-")) {
    throw new Error("Irish AO competition identity changed");
  }
  return compact(cards[0][1]);
}

export function ieAoDetailText(html: string): string {
  const start = html.indexOf('<h1 class="section">');
  const end = html.indexOf("<!-- END CANDIDATE/VIEW_OPPORTUNITY.TT -->", start);
  if (start < 0 || end < 0) throw new Error("Irish AO opportunity content missing");
  return compact(html.slice(start, end));
}

export function ieAoBookletLinks(html: string): { fileId: string; url: string }[] {
  return [...html.matchAll(/<a\b[^>]*class="file_application_pdf"[^>]*href="([^"]+)"/g)].map((match) => {
    const url = officialPlatformUrl(match[1], data.detailUrl);
    const fileId = /\/download_file_opp\/9005\/(\d+)\//.exec(new URL(url).pathname)?.[1];
    if (!fileId) throw new Error("Irish AO booklet opportunity identity changed");
    return { fileId, url };
  });
}

function verifyPdf(bytes: Buffer, evidence: Evidence, url: string, expectedHash: string): void {
  if (evidence.url !== url || bytes.subarray(0, 5).toString() !== "%PDF-" ||
      hash(bytes) !== expectedHash || evidence.sha256 !== expectedHash || evidence.bytes !== bytes.length) {
    throw new Error("Irish AO original PDF changed or redirected; critical fields withheld");
  }
}

export const ieAoSpecialist2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("Irish AO original PDF bytes required");
  const home = await fetchText(data.homepage, { accept: "text/html" });
  if (home.evidence.url !== data.homepage) throw new Error("Publicjobs homepage redirected; review required");
  const boardUrl = ieAoJobBoardLink(home.text);
  const board = await fetchText(boardUrl, { accept: "text/html" });
  if (board.evidence.url !== boardUrl || hash(ieAoCardText(board.text)) !== data.cardTextSha256) {
    throw new Error("Irish AO public job board card changed; amendment review required");
  }
  const detail = await fetchText(data.detailUrl, { accept: "text/html" });
  const booklets = ieAoBookletLinks(detail.text);
  if (detail.evidence.url !== data.detailUrl || hash(ieAoDetailText(detail.text)) !== data.detailTextSha256 ||
      JSON.stringify(booklets.map((item) => item.fileId)) !== JSON.stringify(data.bookletFileIds)) {
    throw new Error("Irish AO details or booklet editions changed; review required");
  }
  // Session route components are discovered anew from public HTML, never guessed.
  // Both language-labelled links must retain accepted bytes; changing either stops extraction.
  const evidence = [home.evidence, board.evidence, detail.evidence];
  const sources = [
    evidenceSource(source, home.evidence, "Official publicjobs homepage and linked job board", "HTML", "English"),
    evidenceSource(source, board.evidence, "Publicjobs board: exact competition 9005 card", "HTML", "English"),
    evidenceSource(source, detail.evidence, "Administrative Officer Specialist 9005 official competition detail", "HTML", "English"),
  ];
  for (let i = 0; i < booklets.length; i++) {
    const item = booklets[i];
    const pdf = await fetchBytes(item.url, { accept: "application/pdf" });
    verifyPdf(pdf.bytes, pdf.evidence, item.url, data.bookletSha256);
    evidence.push(pdf.evidence);
    sources.push(evidenceSource(source, pdf.evidence, i === 0 ? "English candidate booklet" : "Irish-labelled candidate booklet: identical English PDF; translation unverified", "PDF", "English"));
  }
  for (const document of data.documents) {
    const pdf = await fetchBytes(document.url, { accept: "application/pdf" });
    verifyPdf(pdf.bytes, pdf.evidence, document.url, document.sha256);
    evidence.push(pdf.evidence);
    sources.push(evidenceSource(source, pdf.evidence, document.title, "PDF", "English"));
  }
  const lastDate = civilDateIn("Etc/GMT+12", now);
  const firstDate = civilDateIn("Pacific/Kiritimati", now);
  const status = lastDate > "2026-10-13" ? "closed" as const :
    firstDate >= "2026-10-13" || lastDate < "2026-09-25" ? "uncertain" as const : "open" as const;
  const eligibility = data.documents.find((document) => document.key === "eligibility")!;
  const qualifications = data.specialistQualifications.map((item) => `${item.name}: ${item.summary}`).join(" ");
  const cycle = makeCycle({
    id: "ie-ao-specialist-9005-2026", sourceId: source.id,
    title: "Graduate Opportunities 2026 — Administrative Officer Specialist",
    programme: "Irish Civil Service Administrative Officer Specialist competition", cycleLabel: "2026 · vacancy 9005",
    authority: "Publicjobs, on behalf of the Civil Service of Ireland", pathway: "recruitment", appointmentType: "permanent",
    jurisdictionCode: "IE", jurisdictionName: "Ireland",
    scopeLabel: "Civil Service competition; mostly Dublin appointments with possible regional vacancies. Work location is not an applicant residence rule.",
    outcome: "One competition and one application choosing exactly one of four specialist roles: Energy, Environment and Climate; Finance Policy; Health Policy Analyst; Human Resources. Merit panels fill current/future permanent posts, with nine-month probation. No appointment guarantee or published vacancy count; appointments not expected after January 2028.",
    status, statusNote: "Official card, detail, both language-labelled booklet downloads and six incorporated PDFs retained. First output awaits review; Irish-labelled download is identical English content.",
    applicationWindow: { opensOn: null, closesOn: "2026-10-13", cutoffLocalTime: "15:00", officialTimeZone: null, precision: "minute",
      note: "Completed application due 13 October 2026 at 3pm. Official timezone is not printed; no UTC cutoff inferred. Advertising date 25 September is not a confirmed application opening timestamp." },
    qualifications: `${qualifications} Essential specialist qualifications must be held by 13 October 2026; original transcripts including semesters abroad and equivalence need authority review. Admission to tests does not confirm eligibility.`,
    citizenshipRule: "By any job-offer date: EEA, UK or Swiss citizenship, or non-EEA citizenship with Stamp 4 or Stamp 5 permission; 50 TEU permission accepted as Stamp 4 equivalent. Non-Irish applicants can qualify. Nationality alone does not establish a non-EEA route; no promise of sponsored permission.",
    residenceRule: "No general applicant residence-country condition is printed. Non-EEA immigration permission by job-offer date is distinct from residence country; willingness to take a Dublin post is required.",
    languageNote: "General campaign has no printed standardized English or Irish proficiency threshold. Only candidates opting into specialist Irish-language posts must pass assessments through Irish and demonstrate minimum B2 on the linked Europass self-assessment framework before consideration for such a post. This is not a blanket B2 rule. English/Irish application choice controls communications, not eligibility; Irish-labelled booklet currently downloads identical English PDF.",
    salary: "Starting €41,176; PPC scale effective 1 June 2026 rises to €76,546 including long-service increments. Entry normally at scale minimum; serving civil/public servants may have different terms.",
    fee: "No application fee stated in retained competition documents; confirm with publicjobs.",
    selectionStages: [
      "Submit one complete online application, choosing one specialist role; registration alone is not submission",
      "Provisional online assessment: 5–10 November 2026; invitations and actual stages communicated to candidates",
      "Provisional capability-based interview and exercise: 18–22 January 2027; shortlisting or other assessments may also apply",
      "Irish-language opt-in posts: additional Irish assessments at external centre and minimum Europass B2 before consideration",
      "Verify specialist qualifications, citizenship/permission by offer date, health, character, references, any security/Garda clearance and prior public-service restrictions",
      "Merit panel does not guarantee offer; permanent appointment subject to nine-month probation",
    ],
    rules: { complete: false, asOn: "2026-10-13",
      nationality: { allowed: ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH"], stage: "outcome", uncertain: ["*"],
        uncertainReason: "Non-EEA candidates need verified Stamp 4, Stamp 5 or accepted 50 TEU equivalent by job-offer date; profile has no permission field. Nationality alone cannot confirm or reject this conditional route.",
        evidence: `Incorporated citizenship document accepts EEA, UK, Switzerland or non-EEA Stamp 4/5; 50 TEU equivalent accepted. Must meet one route by any job-offer date. ${eligibility.url}` },
      manualChecks: [
        { stage: "apply", text: "Choose only one specialist role; verify its exact NFQ qualification alternatives, grades, module proportions or professional membership by 13 October, and prior public-service retirement/redundancy restrictions. No generic education-level match can replace these alternatives." },
        { stage: "selection", text: "Confirm capabilities, qualification documents, invited assessments and schedule. Irish B2 and Irish assessments apply only to opt-in Irish-language positions; application-interface language is not a proficiency test." },
        { stage: "outcome", text: "Verify immigration/citizenship route by any offer date, health/character, references, clearance, Dublin availability, pension/re-employment restrictions and probation. Panel membership guarantees no job." },
      ],
    },
    workLocations: ["Mainly Dublin; possible other regional locations"],
    venues: [{ kind: "online", name: "Provisional online assessment; later candidate instructions govern" },
      { kind: "unknown", name: "Interview/exercise and optional Irish assessment centre not published" }],
    sources, applicationMethod: "online", applicationUrl: data.detailUrl,
  });
  return { cycles: [cycle], evidence, complete: false, warnings: [
    "One vacancy ID and one application choosing one specialist role count once; four choices, merit panels and possible work locations do not multiply application cycles.",
    "Only competition 9005 extracted. Current board mixes external employers and other jurisdictions; no board total is treated as verified Irish government-job coverage.",
    "Citizenship/permission criteria apply by job-offer date. Non-EEA Stamp 4/5 or accepted 50 TEU equivalent needs documentary verification, not a nationality-only rejection.",
    "Irish B2 is conditional on opting into Irish-language posts. General campaign has no standardized language level; both labelled booklet downloads currently contain identical English bytes.",
    "NFQ routes include professional membership and HR CIPD alternatives; generic degree/experience filters cannot safely determine eligibility. Desirable HR experience is not essential.",
    "Timezone and interview centres are unstated; provisional tests/interviews and panel availability are not guaranteed appointments. Changed original documents or card/details stop extraction for review.",
  ] };
};
