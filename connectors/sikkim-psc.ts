/** Sikkim PSC Village Level Worker 2026: one scan-bound draft cycle. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector, Evidence } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Document { key: string; url: string; sha256: string }
interface Extraction {
  advertisement: string; indexUrl: string; noticesUrl: string; applicationUrl: string;
  documents: Document[]; closesOn: string; ageAsOn: string; vacancies: number;
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/spsc-vlw-2026.json", import.meta.url), "utf8")) as Extraction;
export const SIKKIM_INDEX = extraction.indexUrl;
export const SIKKIM_NOTICES = extraction.noticesUrl;

function officialDocument(href: string): string {
  const url = new URL(href, SIKKIM_INDEX);
  if (url.origin !== "https://spsc.sikkim.gov.in" || !/^\/Advertisements\/[^/]+\.pdf$/i.test(url.pathname) || url.search || url.hash) throw new Error("Sikkim VLW PDF outside official advertisement archive");
  return url.href;
}

export function parseSikkimIndex(html: string): Map<string, string> {
  if (!/Latest Advertisements Issued By the Commission/i.test(stripTags(html))) throw new Error("Sikkim advertisement index identity changed");
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  const selected = rows.filter((row) => row.includes(extraction.advertisement));
  if (selected.length !== 1 || !/Village Level Workers? \(VLW\)/i.test(stripTags(selected[0]))) throw new Error("Sikkim VLW advertisement row missing or duplicated");
  const links = [...selected[0].matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/gi)].map((match) => match[1]);
  const pdfs = links.filter((href) => /\.pdf(?:$|[?#])/i.test(href)).map(officialDocument);
  if (pdfs.length !== extraction.documents.length || new Set(pdfs).size !== pdfs.length) throw new Error("Sikkim VLW document set changed; review required");
  for (const document of extraction.documents) if (!pdfs.includes(document.url)) throw new Error(`Sikkim VLW ${document.key} PDF missing or replaced`);
  const application = links.filter((href) => href === extraction.applicationUrl);
  if (application.length !== 1) throw new Error("Sikkim VLW official application link changed");
  return new Map(extraction.documents.map((document) => [document.key, document.url]));
}

export function checkSikkimNotices(html: string): void {
  if (!/Latest Notices Issued By the Commission/i.test(stripTags(html))) throw new Error("Sikkim notice index identity changed");
  const links = [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => `${match[1]} ${stripTags(match[2])}`);
  if (links.some((item) => /(?:Village[ _-]*Level[ _-]*Workers?|\bVLW\b|23\/SPSC\/EXAM\/2026)/i.test(item))) throw new Error("Sikkim VLW may have a later notice; review required");
}

export const sikkimPsc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("Sikkim exact official PDF bytes required");
  const index = await fetchText(SIKKIM_INDEX, { accept: "text/html" });
  const parsed = parseSikkimIndex(index.text);
  const notices = await fetchText(SIKKIM_NOTICES, { accept: "text/html" });
  if (index.evidence.url !== SIKKIM_INDEX || notices.evidence.url !== SIKKIM_NOTICES) throw new Error("Sikkim index redirected; review required");
  checkSikkimNotices(notices.text);
  const documents = new Map<string, Evidence>();
  for (const document of extraction.documents) {
    const url = parsed.get(document.key)!;
    const pdf = await fetchBytes(url, { accept: "application/pdf" });
    const hash = createHash("sha256").update(pdf.bytes).digest("hex");
    if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== url || pdf.evidence.sha256 !== hash || hash !== document.sha256) throw new Error(`Sikkim VLW ${document.key} PDF changed; extracted fields withheld`);
    documents.set(document.key, pdf.evidence);
  }
  const closed = civilDateIn("Asia/Kolkata", now) > extraction.closesOn;
  const cycle = makeCycle({
    id: "sikkim-psc-2026-village-level-worker", sourceId: source.id,
    title: "Village Level Worker (Agriculture and Horticulture)", cycleLabel: `Advertisement ${extraction.advertisement}`,
    authority: source.authority, pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-SK"],
    scopeLabel: "Sikkim State Subordinate Agriculture Service; one recruitment application for 69 posts",
    outcome: "69 temporary-regular Village Level Worker posts under Sikkim Agriculture and Horticulture Department, subject to notice reservation categories",
    status: closed ? "closed" : "uncertain",
    statusNote: `${closed ? "Application deadline passed" : "Exact cutoff time is unknown"}; scanned advertisement and related documents retained. Founder review pending.`,
    applicationWindow: { opensOn: null, closesOn: extraction.closesOn, cutoffLocalTime: null, officialTimeZone: "Asia/Kolkata", precision: "date", note: "Scanned advertisement page 2 gives 31 August 2026 as final date. Opening date and cutoff clock time are not printed; issue date is not used as opening date." },
    qualifications: "B.Sc. Agriculture or Horticulture from an ICAR-recognized university or institute; an M.Sc. does not replace required B.Sc. Must read, write and speak one Sikkim State language and know local customs/traditions. All qualifications held by closing date; final-result-awaiting candidates excluded.",
    citizenshipRule: "Advertisement invites eligible local candidates but states no explicit national citizenship rule. Foreign-citizen ability to obtain required Sikkim Subject Certificate or Certificate of Identification and Local Employment Card needs official confirmation.",
    residenceRule: "Must hold either Sikkim Subject Certificate or Certificate of Identification, plus valid Local Employment Card issued by Sikkim authorities at application; current address alone does not prove eligibility.",
    selectionStages: ["Written examination", "Document scrutiny for shortlisted candidates; examination venue and date to be notified"],
    fee: "₹200 online, nonrefundable (advertisement page 2).",
    salary: "Pay Matrix Level 9; probation, apprenticeship or training pay follows separate notification (advertisement page 1).",
    rules: { complete: false, asOn: extraction.ageAsOn, manualChecks: [
      { stage: "apply", text: "Verify Sikkim Subject Certificate or Certificate of Identification and Local Employment Card; notice gives no explicit nationality rule, so international eligibility needs official confirmation (advertisement pages 1-2)." },
      { stage: "apply", text: "Verify B.Sc. Agriculture/Horticulture from ICAR-recognized institution; final results must be available by 31 August 2026 (advertisement page 2)." },
      { stage: "apply", text: "Verify age 18–40 on 31 August 2026 and any applicable relaxation under cited service notification (advertisement page 2)." },
      { stage: "selection", text: "Verify ability to read, write and speak one Sikkim State language and familiarity with local customs. Notice names no language or formal proficiency level (advertisement page 2)." },
    ] },
    venues: [{ kind: "unknown", name: "Written examination venue not announced in advertisement" }],
    sources: [
      evidenceSource(source, index.evidence, "SPSC advertisement register", "HTML", "English"),
      evidenceSource(source, notices.evidence, "SPSC subsequent-notice register", "HTML", "English"),
      ...extraction.documents.map((document) => evidenceSource(source, documents.get(document.key)!, `SPSC VLW ${document.key}`, "PDF", "English")),
    ],
    applicationUrl: extraction.applicationUrl,
  });
  return { cycles: [cycle], evidence: [index.evidence, notices.evidence, ...documents.values()], complete: false, warnings: [
    "One Sikkim VLW 2026 advertisement staged. Other SPSC advertisements, departments and local authorities remain uncollected gaps.",
    "Scanned advertisement pages 1-2 were read with OCR and page 2 visually checked; founder must verify transcription, document interpretation and notice status before publication.",
    "Eligible local candidates need Sikkim Subject/Identification Certificate and Local Employment Card; notice gives no explicit nationality rule. Foreign-citizen eligibility needs official confirmation.",
    "One Sikkim State language is required, but the advertisement does not name the language or formal level. No CEFR equivalence is inferred.",
    "Application opening and clock cutoff are not printed; no time was invented.",
  ] };
};
