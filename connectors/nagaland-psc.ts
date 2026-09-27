/** Nagaland PSC Stenographer 2026: one exam application, exact notice text, draft only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn, clockIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  advertisement: string; archiveUrl: string; noticeUrl: string; noticeTextSha256: string;
  opensOn: string; closesOn: string; cutoffLocalTime: string; otrClosesOn: string;
  vacancies: number; ageAsOn: string;
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/npsc-steno-2026.json", import.meta.url), "utf8")) as Extraction;
export const NAGALAND_ARCHIVE = extraction.archiveUrl;
export const NAGALAND_NOTICE = extraction.noticeUrl;

function officialNoticeUrl(href: string): string {
  const url = new URL(href, NAGALAND_ARCHIVE);
  if (url.origin !== "https://npsc.nagaland.gov.in" || !/^\/advertisement\/\d+$/.test(url.pathname) || url.search || url.hash) throw new Error("Nagaland advertisement link outside official notice archive");
  return url.href;
}

export function parseNagalandArchive(html: string): { url: string; itemSha256: string } {
  if (!/Advertisements/.test(stripTags(html))) throw new Error("Nagaland advertisement archive changed");
  const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ href: match[1], label: stripTags(match[2]).replace(/\s+/g, " ") }));
  const selected = links.filter((link) => /NPSC\/EXAM-18\/2023.*(?:Stenographer Recruitment Examination 2026|19\.08\.2026)/i.test(link.label));
  if (selected.length !== 1 || !/Stenographer Recruitment Examination 2026/i.test(selected[0].label)) throw new Error("Nagaland Stenographer 2026 notice missing, duplicated or amended");
  const related = links.filter((link) => link !== selected[0] && /(?:NPSC\/EXAM-18\/2023.*2026|Stenographer.*2026|STENO-2026)/i.test(link.label));
  if (related.length) throw new Error("Nagaland Stenographer 2026 may have an amendment; review required");
  const url = officialNoticeUrl(selected[0].href);
  if (url !== NAGALAND_NOTICE) throw new Error("Nagaland Stenographer 2026 notice URL changed");
  return { url, itemSha256: createHash("sha256").update(JSON.stringify({ url, label: selected[0].label })).digest("hex") };
}

/** Isolate official notice body; page visitor count and anonymous form token change per fetch. */
export function extractNagalandNoticeText(html: string): string {
  const opening = /<div\b(?=[^>]*class="[^"]*\bmt-3\b[^"]*\boverflow-auto\b)[^>]*>/i.exec(html);
  if (!opening || opening.index === undefined) throw new Error("Nagaland notice body missing");
  const start = opening.index + opening[0].length;
  let depth = 1;
  for (const match of html.slice(start).matchAll(/<\/?div\b[^>]*>/gi)) {
    depth += /^<\/div/i.test(match[0]) ? -1 : 1;
    if (depth === 0) {
      const body = html.slice(start, start + match.index);
      return stripTags(body).replace(/\s+/g, " ").trim();
    }
  }
  throw new Error("Nagaland notice body malformed");
}

export function verifyNagalandNotice(html: string): { text: string; sha256: string; vacancies: number } {
  if (!/Advertisement NO\. NPSC\/EXAM-18\/2023 dt\. 19\.08\.2026 \(Stenographer Recruitment Examination 2026\)/i.test(stripTags(html))) throw new Error("Nagaland notice identity changed");
  const text = extractNagalandNoticeText(html);
  const sha256 = createHash("sha256").update(text).digest("hex");
  if (sha256 !== extraction.noticeTextSha256) throw new Error("Nagaland Stenographer notice wording changed; extracted rules withheld");
  if (!text.includes(extraction.advertisement)) throw new Error("Nagaland advertisement number changed");
  const items = [...text.matchAll(/Item No\.\s*(\d+):\s*(\d+)\s*\([^)]*\)\s*posts? of Stenographer/gi)];
  const numbers = items.map((item) => Number(item[1]));
  const vacancies = items.reduce((total, item) => total + Number(item[2]), 0);
  if (items.length !== 12 || numbers.some((number, index) => number !== index + 1) || vacancies !== extraction.vacancies) throw new Error("Nagaland Stenographer item count changed");
  return { text, sha256, vacancies };
}

export const nagalandPsc: Connector = async ({ source, fetchText, now }) => {
  const archive = await fetchText(NAGALAND_ARCHIVE, { accept: "text/html" });
  const archiveItem = parseNagalandArchive(archive.text);
  const notice = await fetchText(archiveItem.url, { accept: "text/html" });
  if (archive.evidence.url !== NAGALAND_ARCHIVE || notice.evidence.url !== NAGALAND_NOTICE) throw new Error("Nagaland source redirected; review required");
  const verified = verifyNagalandNotice(notice.text);
  const today = civilDateIn("Asia/Kolkata", now);
  const closed = today > extraction.closesOn || (today === extraction.closesOn && clockIn("Asia/Kolkata", now) >= extraction.cutoffLocalTime);
  const cycle = makeCycle({
    id: "nagaland-psc-2026-steno-3", sourceId: source.id,
    title: "Stenographer (Grade III)", cycleLabel: `Advertisement ${extraction.advertisement}`,
    authority: source.authority, pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-NL"],
    scopeLabel: "Nagaland Government Stenographer examination; twelve item numbers share one advertised exam application",
    outcome: `${verified.vacancies} Grade III Stenographer posts across departments; three are 2021 backlog positions reserved for persons with benchmark disabilities`,
    status: closed ? "closed" : today < extraction.opensOn ? "upcoming" : "uncertain",
    statusNote: "Notice wording is document-bound; founder review, reservation interpretation and current application status remain pending.",
    applicationWindow: { opensOn: extraction.opensOn, closesOn: extraction.closesOn, cutoffLocalTime: extraction.cutoffLocalTime, officialTimeZone: "Asia/Kolkata", precision: "minute", note: `Advertisement paragraph 15 states online applications from noon 21 August to noon 3 September 2026. OTR registration closes separately on ${extraction.otrClosesOn} at noon. Notice does not print a timezone; Asia/Kolkata is local Kohima time.` },
    qualifications: "Graduate in any discipline; six-month Diploma in Computer Operation; one-year shorthand course with 80 words-per-minute speed shown on marksheet or completion certificate (advertisement qualification and paragraphs 7(i), 10).",
    citizenshipRule: "Advertisement does not state a nationality test or permission for foreign citizens. Every advertised vacancy is reserved for specified indigenous inhabitants of Nagaland; a foreign applicant must not be treated as eligible without official confirmation of that condition.",
    residenceRule: "Paragraph 2 says 100% of vacancies are reserved for Naga Tribe, Kuki, Kachari, Garo or Mikir persons who are Indigenous Inhabitants of Nagaland; paragraph 8 specifies certificate authority. This is a reservation/certificate condition, not a general current-address test.",
    selectionStages: ["Stenographer Recruitment Examination 2026; examination date, detailed stages and venue are not stated in this advertisement."],
    fee: "₹300 examination fee, ₹25 convenience fee and applicable payment-gateway charges; OTR registration free (paragraph 17).",
    salary: "Pay Band ₹28,700–₹91,300, Level 8 (advertisement scale-of-pay table).",
    rules: { complete: false, asOn: extraction.ageAsOn, manualChecks: [
      { stage: "apply", text: "Verify 100% indigenous-inhabitant reservation and required certificate for the applicant; the notice states no nationality rule (paragraphs 2, 7(ii)(b), 8)." },
      { stage: "apply", text: "Verify age 21–32 on 1 January 2026 and applicable SC/ST or serving-government-employee relaxation (age clause and note 1)." },
      { stage: "apply", text: "Verify graduation, six-month computer diploma and one-year shorthand certificate showing 80 wpm, held by application deadline (qualification and paragraphs 7(i), 10)." },
      { stage: "selection", text: "Shorthand language, test format and any language level are not specified in this notice; check later examination instructions." },
    ] },
    venues: [{ kind: "unknown", name: "Examination venue not stated in advertisement" }],
    sources: [
      { ...evidenceSource(source, archive.evidence, "NPSC advertisement archive", "HTML", "English"), itemSha256: archiveItem.itemSha256 },
      { ...evidenceSource(source, notice.evidence, "Advertisement NPSC-3/STENO-2026", "HTML", "English"), itemSha256: verified.sha256 },
    ],
    applicationUrl: "https://npsc.nagaland.gov.in/",
  });
  return { cycles: [cycle], evidence: [archive.evidence, notice.evidence], complete: false, warnings: [
    "One closed Stenographer 2026 examination cycle only; other Nagaland advertisements, notifications and authorities remain gaps.",
    "Notice has twelve item numbers and 26 vacancies but advertises one Stenographer exam application; item numbers and departments do not inflate cycle count.",
    "All vacancies carry indigenous-inhabitant reservation. Notice does not state citizenship or a shorthand language/CEFR level; founder must verify international-applicant outcome and certificates.",
    "Notice body hash excludes dynamic visitor counter and anonymous form token. A matching new archive amendment or changed notice body blocks old extracted fields; separate notification feed still needs review.",
  ] };
};
