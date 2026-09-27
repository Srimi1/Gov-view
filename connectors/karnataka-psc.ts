/** KPSC 2026–27 Gazetted Probationers: one exact-document, draft-only intake. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector, Evidence } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Document { key: string; url: string; sha256: string }
interface Extraction {
  cycleId: string; indexUrl: string; applyPageUrl: string; applicationUrl: string;
  vacancies: number; opensOn: string; originalClosesOn: string; closesOn: string;
  documents: Document[];
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/kpsc-gp-2026.json", import.meta.url), "utf8")) as Extraction;
export const KPSC_INDEX = extraction.indexUrl;
export const KPSC_APPLY_PAGE = extraction.applyPageUrl;

function anchors(html: string, base: string): { url: string; text: string; at: number }[] {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({
    url: new URL(match[1], base).href,
    text: stripTags(match[2]).replace(/\s+/g, " ").trim(),
    at: match.index!,
  }));
}

/** New or changed intake links stop reuse of extracted dates and eligibility. */
export function checkKarnatakaIndex(html: string): void {
  const links = anchors(html, KPSC_INDEX);
  const intake = links.filter((link) => /Gazetted\s+Prob(?:ationers?|rationers?)\b/i.test(link.text) && /2026-27/.test(link.text));
  const actualPdfs = intake.filter((link) => /\.pdf$/i.test(link.url)).map((link) => link.url).sort();
  const expectedPdfs = extraction.documents.map((document) => document.url).sort();
  if (JSON.stringify(actualPdfs) !== JSON.stringify(expectedPdfs)) throw new Error("KPSC 2026-27 notice PDF set changed; review required");
  const extension = intake.find((link) => link.url === extraction.documents.find((document) => document.key === "extension")?.url);
  const original = intake.find((link) => link.url === extraction.documents.find((document) => document.key === "main")?.url);
  const apply = intake.find((link) => link.url === KPSC_APPLY_PAGE);
  const extensionDates = extension?.text.match(/\b\d{2}-\d{2}-\d{4}\b/g) ?? [];
  if (!extension || !extensionDates.length || extensionDates.some((date) => date !== "07-09-2026") || !original || !/319\s+posts/i.test(original.text) || !apply || !/319\s+posts/i.test(apply.text)) {
    throw new Error("KPSC 2026-27 intake, vacancy count or extension changed; review required");
  }
  const olderNoExtension = intake.find((link) => /last date not extended/i.test(link.text));
  if (olderNoExtension && olderNoExtension.at < extension.at) throw new Error("KPSC new no-extension notice appears above extension; review required");
}

export function checkKarnatakaApplyPage(html: string): void {
  const links = anchors(html, KPSC_APPLY_PAGE).filter((link) => /GAZETTED\s+PROBATIONER\s*-\s*2026-27\s+GROUP\s+A\s*&\s*B\s+319\s+POSTS/i.test(link.text));
  if (links.length !== 1 || links[0].url !== extraction.applicationUrl) throw new Error("KPSC 2026-27 application link changed; review required");
}

export const karnatakaPsc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("KPSC PDF byte fetch required");
  const index = await fetchText(KPSC_INDEX, { accept: "text/html" });
  const applyPage = await fetchText(KPSC_APPLY_PAGE, { accept: "text/html" });
  if (index.evidence.url !== KPSC_INDEX || applyPage.evidence.url !== KPSC_APPLY_PAGE) throw new Error("KPSC official page redirected");
  checkKarnatakaIndex(index.text);
  checkKarnatakaApplyPage(applyPage.text);
  const documents = new Map<string, Evidence>();
  for (const document of extraction.documents) {
    const pdf = await fetchBytes(document.url, { accept: "application/pdf" });
    const hash = createHash("sha256").update(pdf.bytes).digest("hex");
    if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== document.url || pdf.evidence.sha256 !== hash || hash !== document.sha256) {
      throw new Error(`KPSC ${document.key} PDF changed; extracted fields withheld`);
    }
    documents.set(document.key, pdf.evidence);
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today < extraction.opensOn ? "upcoming" : today > extraction.closesOn ? "closed" : "extended";
  const mainUrl = extraction.documents.find((document) => document.key === "main")!.url;
  const cycle = makeCycle({
    id: extraction.cycleId,
    sourceId: source.id,
    title: "Karnataka Gazetted Probationers Group A/B 2026–27",
    cycleLabel: "2026–27 notification · 319 posts",
    authority: source.authority,
    programme: "Karnataka Gazetted Probationers",
    pathway: "recruitment",
    jurisdictionCode: "IN",
    jurisdictionName: "India",
    subdivisionCodes: ["IN-KA"],
    scopeLabel: "Karnataka state government posts; one application cycle covers 319 Group A/B posts",
    outcome: "Consideration for 319 Group A/B Gazetted Probationer posts; final role and appointment depend on selection and post-specific rules",
    status,
    statusNote: "Formal KPSC corrigendum extended online applications to 7 September 2026. Closing clock time unverified; founder review pending.",
    applicationWindow: {
      opensOn: extraction.opensOn,
      closesOn: extraction.closesOn,
      officialTimeZone: "Asia/Kolkata",
      cutoffLocalTime: null,
      precision: "date",
      note: "Original Kannada notice gives 1–31 August. Later KPSC corrigendum and bilingual index extend closing date to 7 September. No cutoff clock time verified.",
    },
    qualifications: "Post-specific degrees, age bands and category relaxations require Kannada notice review. An official 13 August press note changes age limits; no automated degree or age match is asserted.",
    citizenshipRule: "No reliable citizenship or foreign-national application rule was established from the checked Kannada notice. International applicants need official confirmation for application, selection and appointment.",
    residenceRule: "Karnataka residence and reservation conditions require Kannada notice review. State hiring scope does not itself establish applicant residence eligibility.",
    selectionStages: [
      "Preliminary examination; KPSC timetable needs founder confirmation",
      "Main written examination, including separate Kannada and English qualifying papers",
      "Personality test; candidates missing either qualifying-paper minimum cannot proceed to this stage",
      "Post-specific appointment verification",
    ],
    fee: "Fee bands and exemptions need Kannada notice review.",
    rules: { complete: false, asOn: null,
      languages: [
        { language: "kn", stage: "selection", requirement: "Qualifying Kannada paper: 150 marks, at least 35% (52.5); first-language Kannada standard at SSLC level. No CEFR-equivalent level stated.", evidence: "Original notification, PDF pages 18–19, bilingual examination scheme and note (1)/(4).", sourceUrl: mainUrl },
        { language: "en", stage: "selection", requirement: "Qualifying English paper: 150 marks, at least 35% (52.5); first-language English standard at SSLC level. No CEFR-equivalent level stated.", evidence: "Original notification, PDF pages 18–19, bilingual examination scheme and note (1)/(4).", sourceUrl: mainUrl },
      ],
      manualChecks: [
        { stage: "apply", text: "Confirm citizenship and whether an international applicant may apply; checked Kannada pages do not establish a safe rule." },
        { stage: "apply", text: "Confirm degree, age, category, residence and fee conditions, including the 13 August age amendment." },
        { stage: "selection", text: "Qualify both 150-mark Kannada and English papers at 35% each. Main written questions are bilingual; answers may use either language except on qualifying papers (original notice PDF pages 18–19)." },
        { stage: "outcome", text: "Confirm citizenship permission for appointment and post-specific service, character and document conditions." },
      ],
    },
    venues: [{ kind: "unknown", name: "Exam venues not verified in checked notice; Karnataka jurisdiction center is not an exam venue" }],
    sources: [
      evidenceSource(source, index.evidence, "KPSC 2026–27 notice index", "HTML", "Kannada and English"),
      evidenceSource(source, applyPage.evidence, "KPSC 2026–27 online application link", "HTML", "Kannada and English"),
      ...extraction.documents.map((document) => evidenceSource(source, documents.get(document.key)!, `KPSC ${document.key} 2026–27`, document.key === "main" ? "PDF" : "scanned PDF", "Kannada and English")),
    ],
    applicationUrl: extraction.applicationUrl,
  });
  return { cycles: [cycle], evidence: [index.evidence, applyPage.evidence, ...documents.values()], complete: false, warnings: [
    "One 319-post Group A/B intake, not 319 application cycles. Other KPSC notifications and Karnataka departments remain coverage gaps.",
    "An older KPSC press-note page says last date not extended; current notice index lists later formal corrigendum to 7 September. Founder must confirm chronology before approval.",
    "Main notice is largely Kannada; citizenship, residence, degree, age amendment, fee and venue details need bilingual/manual review. International applicant permission remains unknown.",
    "Kannada and English qualifying papers have published SSLC first-language standard and 35% threshold; no CEFR level or equivalence is inferred.",
  ] };
};
