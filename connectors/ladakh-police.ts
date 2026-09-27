/** Ladakh Police constable 02/2026: one scanned-notice-bound draft cycle. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector, Evidence } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Document { key: string; url: string; sha256: string | null; indexDate: string; linkedOnly?: boolean }
interface Extraction {
  indexUrl: string; applicationUrl: string; advertisement: string;
  opensOn: string; closesOn: string; ageAsOn: string; vacancies: number; documents: Document[];
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/ladakh-police-constable-02-2026.json", import.meta.url), "utf8")) as Extraction;
export const LADAKH_POLICE_INDEX = extraction.indexUrl;

/** Known constable rows include an admit-card update; unknown later rows force review. */
export function checkLadakhPoliceIndex(html: string): void {
  if (!/RECRUITMENT ORDER\/NOTICE/i.test(stripTags(html))) throw new Error("Ladakh Police recruitment index identity changed");
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  const relevant = rows.filter((row) => /Constables?\b/i.test(stripTags(row)) && /2026/.test(stripTags(row)) && /Ladakh Police/i.test(stripTags(row)));
  if (relevant.length !== extraction.documents.length) throw new Error("Ladakh Police 2026 constable notice set changed; review required");
  const seen = new Set<string>();
  for (const row of relevant) {
    const links = [...row.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
    if (links.length !== 1) throw new Error("Ladakh Police constable row link changed");
    const url = new URL(links[0], LADAKH_POLICE_INDEX);
    if (url.origin !== "https://police.ladakh.gov.in" || !/^\/pages\/pdf\/[^/]+\.pdf$/i.test(url.pathname) || url.search || url.hash) throw new Error("Ladakh Police constable PDF outside official archive");
    const document = extraction.documents.find((candidate) => candidate.url === url.href);
    if (!document || seen.has(document.key) || !stripTags(row).includes(document.indexDate)) throw new Error("Ladakh Police constable notice changed or duplicated; review required");
    seen.add(document.key);
  }
  if (seen.size !== extraction.documents.length) throw new Error("Ladakh Police original or related notice missing");
}

export const ladakhPolice: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("Ladakh Police scanned PDF bytes required");
  const index = await fetchText(LADAKH_POLICE_INDEX, { accept: "text/html" });
  if (index.evidence.url !== LADAKH_POLICE_INDEX) throw new Error("Ladakh Police recruitment index redirected");
  checkLadakhPoliceIndex(index.text);
  const documents = new Map<string, Evidence>();
  for (const document of extraction.documents.filter((item) => !item.linkedOnly)) {
    const pdf = await fetchBytes(document.url, { accept: "application/pdf" });
    const hash = createHash("sha256").update(pdf.bytes).digest("hex");
    if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== document.url || pdf.evidence.sha256 !== hash || hash !== document.sha256) throw new Error(`Ladakh Police ${document.key} PDF changed; extracted fields withheld`);
    documents.set(document.key, pdf.evidence);
  }
  const closed = civilDateIn("Asia/Kolkata", now) > extraction.closesOn;
  const cycle = makeCycle({
    id: "ladakh-police-2026-02-constable", sourceId: source.id,
    title: "Constable, General Cadre — Ladakh Police", cycleLabel: `Advertisement ${extraction.advertisement}`,
    authority: source.authority, pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-LA"],
    scopeLabel: "One constable application across Executive/Armed/IRP/SDRF, Border Battalion and Women Battalion options",
    outcome: `${extraction.vacancies} Constable posts: 141 Executive/Armed/IRP/SDRF, 168 Border Battalion and 22 Women Battalion. Battalion and district vacancy rows are not separate application cycles.`,
    status: closed ? "closed" : "uncertain",
    statusNote: `Original and 11 September notices set 15 September application date. 22 September notice reschedules physical tests for a subset; it does not reopen applications. Scanned transcription requires founder review.`,
    applicationWindow: { opensOn: extraction.opensOn, closesOn: extraction.closesOn, cutoffLocalTime: null, officialTimeZone: "Asia/Kolkata", precision: "date", note: "Advertisement page 1 and no-further-extension notice: applications 29 August–15 September 2026. No cutoff clock time or timezone label printed; Asia/Kolkata is Ladakh local time. 22 September notice changes only physical-test timing." },
    qualifications: "Class 10/Matriculation from a recognised board by application close. Serving Ladakh Police Special Police Officers with at least three years' continuous engagement may qualify with Class 8 instead. General age 18–28 on 1 January 2026, subject to cited relaxations. Physical, medical and document checks apply.",
    citizenshipRule: "No national citizenship test was identified in the retained scanned advertisement or standing order. OCR may miss text; founder must verify. Foreign-citizen permission to apply, enter selection or receive appointment needs official confirmation. A valid UT Ladakh domicile certificate is explicitly required regardless of nationality uncertainty.",
    residenceRule: "Valid UT Ladakh domicile certificate from competent authority is required by application deadline. Women/Border Battalion applicants are limited to vacancies in their qualifying domicile district; Border Battalion preference additionally needs eligible border-village proof.",
    selectionStages: ["Physical Standard Test (PST)", "Physical Endurance Test (PET)", "Original-document scrutiny", "Desired qualification/NCC incentive assessment where applicable", "Written examination: English/Hindi bilingual paper; no formal language-proficiency level printed", "Medical examination and final appointment verification"],
    fee: "₹600 for unreserved/EWS; ₹500 for SC, ST and ALC. Online payment required (advertisement page 13); other exemptions need founder check.",
    salary: "Pay Matrix Level 2; detailed remuneration and allowances require review.",
    rules: { complete: false, asOn: extraction.ageAsOn, manualChecks: [
      { stage: "apply", text: "Verify valid UT Ladakh domicile certificate by 15 September 2026, plus district or border-village proof for Women/Border Battalion choices (advertisement pages 2, 5; standing order pages 1–2)." },
      { stage: "apply", text: "Verify nationality and foreign-citizen appointment permission with Ladakh Police; OCR/manual research has not established a citizenship rule in the scanned advertisement or standing order." },
      { stage: "apply", text: "Verify Class 10 qualification or narrow serving-SPO Class 8 exception, age 18–28 on 1 January 2026 and all applicable relaxations (advertisement pages 5–6)." },
      { stage: "selection", text: "Pass post-specific physical/medical requirements. Written paper is in English and Hindi, but notice states no language proficiency threshold or CEFR level (advertisement pages 7–10)." },
      { stage: "outcome", text: "Confirm final domicile/district, document, character and medical checks; selection does not itself establish appointment eligibility." },
    ] },
    venues: [{ kind: "unknown", name: "Individual physical-test venue appears on admit card. NDS Stadium Leh postponement applies only to specified 24/25 September candidates; no all-applicant exam pin." }],
    sources: [
      evidenceSource(source, index.evidence, "Ladakh Police recruitment notice register", "HTML", "English"),
      ...extraction.documents.filter((document) => !document.linkedOnly).map((document) => evidenceSource(source, documents.get(document.key)!, `Ladakh Police ${document.key} 2026`, "scanned PDF", "English")),
    ],
    applicationUrl: extraction.applicationUrl,
  });
  return { cycles: [cycle], evidence: [index.evidence, ...documents.values()], complete: false, warnings: [
    "One application cycle covers 331 Constable posts across unit and district rows; those rows are not separate opportunities.",
    "Applications closed 15 September. The later PST/PET postponement affects specified candidates only and is not a deadline extension or cancellation.",
    "UT Ladakh domicile certificate is mandatory. No national citizenship rule was identified from scanned evidence; OCR uncertainty and foreign-citizen appointment permission require official confirmation.",
    "Written paper is bilingual English/Hindi, with no published proficiency level or CEFR equivalence.",
    "The scanned notice and standing order need founder visual review. Other Ladakh Police and administration recruitments remain gaps.",
  ] };
};
