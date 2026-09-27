/** WBPSC Principal advertisement 05/2026, held for founder review. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle } from "./util.ts";

interface Document { key: string; url: string; sha256: string; title: string }
interface Extraction {
  cycleId: string; homeUrl: string; announcementsUrl: string; documents: Document[];
  actualOpensOn: null; finalClosesOn: string; cutoffLocalTime: string;
  editOpensOn: string; editClosesOn: string; vacancies: number; ageAsOn: string;
}
const details = JSON.parse(readFileSync(new URL("../data/extractions/wbpsc-principal-05-2026.json", import.meta.url), "utf8")) as Extraction;
export const WBPSC_PAGES = [details.homeUrl, details.announcementsUrl] as const;
export const WBPSC_PDFS = details.documents.map((document) => document.url);

function links(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)]
    .map((match) => new URL(match[1].replaceAll("&amp;", "&"), details.homeUrl).href);
}

export function checkWbpscPages(home: string, announcements: string): void {
  if (!links(home).includes(details.documents[0].url) || !/DETAILED ADVERTISEMENT TO THE POST OF PRINCIPAL[\s\S]{0,500}05\/2026/i.test(home)) {
    throw new Error("WBPSC Principal homepage advertisement changed; review required");
  }
  const rows = [...announcements.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)]
    .map((match) => match[0]).filter((row) => /05\/2026/i.test(row));
  const expected = [details.documents[1].url, details.documents[2].url].sort();
  const actual = rows.flatMap((row) => links(row)).filter((url) => url.includes("/Download?")).sort();
  if (rows.length !== 2 || JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("WBPSC advertisement 05/2026 announcements changed; review required");
  }
}

export const wbpsc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("WBPSC original PDF byte fetch required");
  const [home, announcements] = await Promise.all(WBPSC_PAGES.map((url) => fetchText(url, { accept: "text/html" })));
  if (home.evidence.url !== details.homeUrl || announcements.evidence.url !== details.announcementsUrl) {
    throw new Error("WBPSC official page redirected; review required");
  }
  checkWbpscPages(home.text, announcements.text);
  const documents = await Promise.all(details.documents.map((document) => fetchBytes(document.url, { accept: "application/pdf" })));
  details.documents.forEach((document, position) => {
    const fetched = documents[position];
    const hash = createHash("sha256").update(fetched.bytes).digest("hex");
    if (fetched.bytes.subarray(0, 5).toString() !== "%PDF-" || fetched.evidence.url !== document.url ||
        fetched.evidence.sha256 !== hash || hash !== document.sha256) {
      throw new Error("WBPSC Principal PDF changed; extracted fields withheld");
    }
  });
  const today = civilDateIn("Asia/Kolkata", now);
  const original = details.documents[0].url;
  const cycle = makeCycle({
    id: details.cycleId, sourceId: source.id,
    title: "West Bengal DIET Principal recruitment 2026",
    cycleLabel: "WBPSC advertisement 05/2026",
    programme: "Principal in District Institute of Education and Training",
    authority: source.authority, pathway: "recruitment",
    jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-WB"],
    scopeLabel: "West Bengal School Education Department; 12 positions in one advertised Principal application cycle",
    outcome: `${details.vacancies} temporary but likely permanent Principal positions in District Institutes of Education and Training`,
    status: today > details.finalClosesOn ? "closed" : "open",
    statusNote: `Signed extension moved new-application and fee deadline to 3 June 2026 at 15:00 IST. It says applications never began on the originally planned 30 April date; actual opening date is unverified. ${details.editOpensOn}–${details.editClosesOn} edit window is for existing applicants, not new submissions. Founder review pending.`,
    applicationWindow: {
      opensOn: details.actualOpensOn, closesOn: details.finalClosesOn,
      officialTimeZone: "Asia/Kolkata", cutoffLocalTime: details.cutoffLocalTime, precision: "minute",
      note: "Signed 14 May extension supersedes original 21 May 15:00 closing. It says the 30 April start never occurred; no actual opening date is supplied. Separate edit window ends 12 June at 15:00.",
    },
    qualifications: "Regular two-year master's in a school teaching subject with Honours at graduation and at least 55%; M.Ed/M.Ed Elementary at 55%, or MA Education at 55% plus Primary/Elementary diploma or degree at 55%; five years teaching in Primary/Elementary Teachers' Training Institute; spoken and written Bengali plus computer literacy. Founder must check qualification combinations and Nepali mother-tongue exception.",
    citizenshipRule: "Original notice invites Indian citizens and others declared eligible by Government of India. It gives no list of foreign nationalities or certificates. International applicants need authority confirmation for application, selection and appointment.",
    residenceRule: "West Bengal domicile controls specified reservation/age/fee benefits, not a blanket unreserved application condition in this notice. Out-of-state SC/ST/OBC candidates may apply for unreserved vacancies as general candidates.",
    selectionStages: ["Online application and applicable fee", "Eligibility and qualification screening, possibly a Screening Test", "Interview including Bengali knowledge assessment", "Document verification and recommendation for appointment"],
    fee: "₹210 plus applicable online service charges; West Bengal SC/ST and qualifying PwBD candidates are exempt. West Bengal OBC pay usual fee; SC/ST from other states receive no exemption.",
    salary: "Pay Level 17, ₹67,300–₹1,73,200 under WBS ROPA Rules 2019, plus admissible allowances.",
    rules: { complete: false, asOn: details.ageAsOn,
      education: { minLevel: "master", evidence: "Original advertisement page 1: regular two-year master's with Honours at graduation, specified Education qualification combination and 55% marks. Exact disciplines, marks and route need verification." },
      experience: { minYears: 5, evidence: "Original advertisement page 1: five years teaching experience in a Primary or Elementary Teachers' Training Institute; experience type and full-time proof require verification." },
      languages: [{ language: "bn", stage: "apply", requirement: "Bengali spoken and written is listed for Principal; general notice exempts Nepali mother-tongue candidates unless specifically mentioned. Authority must reconcile this post-specific clause and interview test. No CEFR level.", evidence: "Original advertisement page 1, general note and Principal qualifications; Bengali knowledge assessed at interview.", sourceUrl: original }],
      manualChecks: [
        { stage: "apply", text: "Confirm government declaration of eligibility for non-Indian nationality; verify exact master's/Honours/Education qualification combination, 55% marks, five years qualifying teaching and computer literacy." },
        { stage: "apply", text: "Age maximum 42 as of 1 January 2026 has West Bengal category and disability relaxations; confirm category, local certificate and applicable limit individually." },
        { stage: "selection", text: "Board must verify Bengali spoken/written interview performance and whether Nepali mother-tongue exception applies to this post." },
        { stage: "outcome", text: "Confirm appointment permission for non-Indian citizens and original certificates with WBPSC and hiring department." },
      ],
    },
    venues: [{ kind: "unknown", name: "Screening or interview venue not published in these notices; commission office address is not a venue" }],
    sources: [
      evidenceSource(source, home.evidence, "WBPSC official homepage advertisement register", "HTML", "English"),
      evidenceSource(source, announcements.evidence, "WBPSC announcement archive", "HTML", "English"),
      ...documents.map((document, position) => evidenceSource(source, document.evidence, details.documents[position].title, "PDF", "English")),
    ],
    applicationUrl: details.homeUrl,
    changes: [{ at: "2026-05-14T00:00:00+05:30", kind: "extended", summary: "Signed notice says planned 30 April opening did not occur and extends application and fee deadline from 21 May to 3 June at 15:00 IST; edit window rescheduled separately." }],
  });
  return { cycles: [cycle], evidence: [home.evidence, announcements.evidence, ...documents.map((document) => document.evidence)], complete: false, warnings: [
    "Only Principal advertisement 05/2026 extracted; other WBPSC advertisements, results, departments and local sources remain gaps.",
    "Actual opening date is unknown because signed notice says planned 30 April opening never began. Do not infer it from original advertisement.",
    "Nationality condition includes other persons declared eligible by Government of India but gives no classes. International applicant and appointment rules require authority confirmation.",
    "Bengali Principal clause and general Nepali mother-tongue exception need founder reconciliation; no formal proficiency framework is printed.",
    "Post-specific age relaxations require West Bengal category certificates; automated rejection above 42 would be unsafe.",
  ] };
};
