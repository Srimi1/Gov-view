/** TPSC advertisements 01–03/2026: scanned notices and one addendum; draft only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { OpportunityCycle } from "../lib/opportunities.ts";
import type { EligibilityRules } from "../lib/eligibility/types.ts";
import { civilDateIn, clockIn } from "../lib/time.ts";
import type { Connector, Evidence } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Document { key: string; url: string; sha256: string }
interface CycleExtraction { number: string; post: string; vacancies: number; opensOn: string; closesOn: string; originalClosesOn?: string; cutoffLocalTime: string; ageAsOn: string }
interface Extraction { indexUrl: string; documents: Document[]; cycles: CycleExtraction[] }
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/tpsc-2026-01-03.json", import.meta.url), "utf8")) as Extraction;
export const TRIPURA_INDEX = extraction.indexUrl;

/** Only the official advertisement list; footer/news references are separate follow-up feeds. */
export function parseTripuraIndex(html: string): Map<string, string> {
  const start = html.indexOf("THEME HOOK: 'views_view_list'");
  const list = start >= 0 ? /<ul\b[^>]*>([\s\S]*?)<\/ul>/i.exec(html.slice(start))?.[1] : null;
  if (!list) throw new Error("Tripura advertisement list changed");
  const found = new Map<string, string>();
  const relevant: string[] = [];
  for (const match of list.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = stripTags(match[2]).replace(/\s+/g, " ");
    if (!/(?:Advt|Advertisement)\.?\s*No[.\s-]*0[1-3]\s*\/\s*2026/i.test(title)) continue;
    const url = new URL(match[1].replace(/&amp;/g, "&"), TRIPURA_INDEX);
    if (url.origin !== "https://tpsc.tripura.gov.in" || !/^\/sites\/default\/files\/[A-Za-z0-9_.%()\/-]+\.pdf$/i.test(url.pathname) || url.search || url.hash) throw new Error("Tripura advertisement document outside official PDF archive");
    relevant.push(title);
    const key = /Addendum/i.test(title) ? "01/2026-addendum" : /0([1-3])\s*\/\s*2026/i.exec(title)?.[0]?.replace(/\s/g, "") ?? "";
    if (!key || found.has(key)) throw new Error("Tripura advertisement duplicate or unsupported correction; review required");
    found.set(key, url.href);
  }
  if (relevant.length !== extraction.documents.length || found.size !== extraction.documents.length) throw new Error("Tripura 2026 advertisement set changed; review required");
  for (const document of extraction.documents) if (found.get(document.key) !== document.url) throw new Error("Tripura 2026 advertisement link changed; review required");
  return found;
}

function draftRules(number: string, documentUrl: string, asOn: string): EligibilityRules {
  const page = number === "03/2026" ? "pages 1–2" : "page 1";
  return {
    complete: false, asOn,
    nationality: { allowed: ["IN"], evidence: `TPSC advertisement ${number}, ${page}: online applications invited from bonafide citizens of India.` },
    ...(number === "02/2026" ? { languages: [{ language: "en", stage: "selection" as const, requirement: "Written-examination answers must be in English only; notice gives no CEFR or equivalent proficiency level.", evidence: "Advertisement 02/2026, attached examination rules, PDF page 9.", sourceUrl: documentUrl }] } : {}),
    manualChecks: [
      { stage: "apply", text: `Verify Permanent Resident Certificate of Tripura (PRTC) required by advertisement ${number}; current address alone does not prove certificate eligibility.` },
      { stage: "apply", text: `Verify age on ${asOn}, all category/disability/government-service relaxations, and grade-specific qualifications where applicable.` },
      { stage: "apply", text: "Verify educational qualification and certificates by advertised application closing date." },
      { stage: "selection", text: "Bengali or Kokborok is desirable, not a published mandatory language level; review later test/interview instructions." },
    ],
  };
}

export const tripuraPsc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("Tripura exact scanned PDF evidence fetch required");
  const index = await fetchText(TRIPURA_INDEX, { accept: "text/html" });
  if (index.evidence.url !== TRIPURA_INDEX) throw new Error("Tripura advertisement index redirected");
  const found = parseTripuraIndex(index.text);
  const pdfs = new Map<string, Evidence>();
  for (const document of extraction.documents) {
    const url = found.get(document.key)!;
    const fetched = await fetchBytes(url, { accept: "application/pdf" });
    const hash = createHash("sha256").update(fetched.bytes).digest("hex");
    if (fetched.bytes.subarray(0, 5).toString() !== "%PDF-" || fetched.evidence.url !== url || fetched.evidence.sha256 !== hash || hash !== document.sha256) throw new Error(`Tripura ${document.key} PDF changed; old applicant fields withheld`);
    pdfs.set(document.key, fetched.evidence);
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const cycles = extraction.cycles.map((entry): OpportunityCycle => {
    const document = extraction.documents.find((item) => item.key === entry.number)!;
    const evidence = pdfs.get(entry.number)!;
    const closed = today > entry.closesOn || (today === entry.closesOn && clockIn("Asia/Kolkata", now) >= entry.cutoffLocalTime);
    const original = evidenceSource(source, evidence, `TPSC advertisement ${entry.number}`, "scanned PDF", "English");
    const sources = [evidenceSource(source, index.evidence, "TPSC advertisement register", "HTML", "English"), original];
    if (entry.number === "01/2026") sources.push(evidenceSource(source, pdfs.get("01/2026-addendum")!, "TPSC 01/2026 vacancy and deadline addendum", "scanned PDF", "English"));
    const common = {
      id: `tripura-psc-2026-${entry.number.slice(0, 2)}`, sourceId: source.id,
      title: entry.post, cycleLabel: `Advertisement ${entry.number}`, authority: source.authority,
      pathway: "recruitment" as const, jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-TR"],
      status: closed ? "closed" as const : today < entry.opensOn ? "upcoming" as const : "uncertain" as const,
      statusNote: "Scanned official advertisement transcribed as a review draft; no founder acceptance yet.",
      applicationWindow: { opensOn: entry.opensOn, closesOn: entry.closesOn, cutoffLocalTime: entry.cutoffLocalTime, officialTimeZone: "Asia/Kolkata", precision: "minute" as const, note: `TPSC advertisement ${entry.number}${entry.originalClosesOn ? " and 27 March addendum" : ""} state 5:30 PM closing time without a timezone; Asia/Kolkata is local Tripura interpretation.` },
      citizenshipRule: `TPSC advertisement ${entry.number} invites bonafide citizens of India. Foreign citizens do not meet this published criterion.`,
      residenceRule: "Permanent Resident Certificate of Tripura (PRTC) required at application. Current address is insufficient proof.",
      venues: [{ kind: "unknown" as const, name: "Exact examination venue not stated in advertisement" }],
      sources, applicationUrl: "https://tpsc.onlinetripura.in/",
      rules: draftRules(entry.number, document.url, entry.ageAsOn),
    };
    if (entry.number === "01/2026") return makeCycle({ ...common,
      scopeLabel: "Tripura Tourism Department, Assistant Tourist Officer recruitment",
      outcome: "2 Assistant Tourist Officer posts: one Scheduled Tribe, one unreserved after addendum",
      qualifications: "Bachelor's degree in Travel/Tourism Management or Tourism Administration from a recognized university; PRTC. Bengali or Kokborok knowledge desirable, with no stated level (original page 1; addendum page 1).",
      selectionStages: ["170-mark MCQ written test, including English, general knowledge and tourism subjects", "30-mark interview/personality test"],
      fee: "₹350 general; ₹250 ST/SC, BPL cardholders and persons with disabilities (original page 4).",
      changes: [{ at: "2026-03-27", kind: "extended", summary: "Addendum adds one unreserved vacancy and extends application deadline from 18 to 27 April 2026 at 5:30 PM; original 18 April age date unchanged." }],
    });
    if (entry.number === "02/2026") return makeCycle({ ...common,
      scopeLabel: "Tripura Information Technology Service, Group B gazetted recruitment",
      outcome: "220 Assistant Technical Officer posts; category reservation applies",
      qualifications: "BE/BTech in Computer Science, IT, Electronics, Electronics and Communication, or Electronics and Telecommunications; alternatively MCA, from an accepted institution. PRTC required. Bengali or Kokborok desirable, no level stated (page 1).",
      selectionStages: ["170-mark written MCQ examination; answers in English only", "30-mark interview/personality test"],
      fee: "₹350 general; ₹250 ST/SC, BPL cardholders and persons with disabilities (page 4).",
    });
    return makeCycle({ ...common,
      scopeLabel: "Combined Junior Engineer Electrical examination; Grade I degree and Grade II diploma positions",
      outcome: "8 Junior Engineer posts: Grade I has 5; Grade II has 3. Grade choice and application identity need portal review.",
      qualifications: "Grade I requires Electrical Engineering degree; Grade II requires Electrical Engineering diploma or equivalent. PRTC required for both; Bengali or Kokborok desirable without a stated level (pages 1–2).",
      selectionStages: ["100-mark preliminary MCQ screening", "500-mark main written examination, including English Composition", "50-mark interview/personality test"],
      fee: "Grade I Group B: ₹350 general / ₹250 ST/SC, BPL, disability. Grade II Group C: ₹200 general / ₹150 ST/SC, BPL, disability (page 5).",
    });
  });
  return { cycles, evidence: [index.evidence, ...pdfs.values()], complete: false, warnings: [
    "Three closed 2026 advertisement drafts only; other TPSC notices, departments and Tripura authorities remain coverage gaps.",
    "03/2026 advertises two Junior Engineer grades under one combined examination. Whether grade selection permits separate applications needs official portal review before publication.",
    "PRTC is a certificate rule, not an address comparison. Bengali/Kokborok is desirable without a published proficiency level. All scanned transcriptions require founder review.",
    "TPSC news and notifications include later exam schedules/results; this pilot checks the advertisement register only and does not claim complete current-cycle status.",
  ] };
};
