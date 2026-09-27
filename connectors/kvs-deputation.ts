/** Exact-document KVS advertisement 03/2026; two deputation post applications. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector, Evidence } from "./types.ts";
import { dayFirstDate, evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  indexUrl: string; advertisementUrl: string; advertisementSha256: string;
  extensionUrl: string; extensionSha256: string; noticeNumber: string;
  noticeDate: string; extensionDate: string; originalClosesOn: string;
  closesOn: string; officialTimeZone: string;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/kvs-deputation-03-2026.json", import.meta.url), "utf8")) as Extraction;

/** Both register entries must still identify the same two posts and exact documents. */
export function verifyKvsIndex(html: string): void {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  const related = rows.map((row) => ({
    row,
    title: stripTags(/<strong\b[^>]*>([\s\S]*?)<\/strong>/i.exec(row)?.[1] ?? ""),
  })).filter(({ title }) => /\b03\/2026\b|Executive Engineer and Assistant Director \(Official Language\)/i.test(title));
  if (related.length !== 2) throw new Error("KVS 03/2026 register entries changed; manual review required");
  const expected = [
    { url: notice.advertisementUrl, date: notice.noticeDate, title: /Advertisement No\. 03\/2026.*Executive Engineer and Assistant Director/i },
    { url: notice.extensionUrl, date: notice.extensionDate, title: /Extension of last date.*Executive Engineer and Assistant Director/i },
  ];
  for (const item of expected) {
    const matching = related.filter(({ row, title }) => {
      const urls = [...row.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)]
        .map((match) => new URL(match[1], notice.indexUrl).href);
      return item.title.test(title) && urls.includes(item.url) && dayFirstDate(stripTags(row)) === item.date;
    });
    if (matching.length !== 1) throw new Error("KVS 03/2026 document, date or post identity changed; manual review required");
  }
}

function verifyPdf(bytes: Buffer, evidence: Evidence, url: string, expectedHash: string): void {
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (bytes.subarray(0, 5).toString() !== "%PDF-" || evidence.url !== url ||
      evidence.sha256 !== hash || hash !== expectedHash) {
    throw new Error("KVS 03/2026 scanned PDF changed; extracted fields withheld");
  }
}

export const kvsDeputation: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("KVS scanned original and extension PDFs are required");
  const index = await fetchText(notice.indexUrl, { accept: "text/html" });
  if (index.evidence.url !== notice.indexUrl) throw new Error("KVS recruitment index redirected; manual review required");
  verifyKvsIndex(index.text);
  const original = await fetchBytes(notice.advertisementUrl, { accept: "application/pdf" });
  const extension = await fetchBytes(notice.extensionUrl, { accept: "application/pdf" });
  verifyPdf(original.bytes, original.evidence, notice.advertisementUrl, notice.advertisementSha256);
  verifyPdf(extension.bytes, extension.evidence, notice.extensionUrl, notice.extensionSha256);

  const today = civilDateIn(notice.officialTimeZone, now);
  const status = today < notice.noticeDate ? "uncertain" as const : today > notice.closesOn ? "closed" as const : "open" as const;
  const shared = {
    sourceId: source.id, authority: source.authority, pathway: "recruitment" as const,
    appointmentType: "deputation" as const,
    jurisdictionCode: "IN", jurisdictionName: "India", status,
    cycleLabel: `KVS advertisement ${notice.noticeNumber}`,
    applicationWindow: {
      opensOn: null, closesOn: notice.closesOn, cutoffLocalTime: null,
      officialTimeZone: notice.officialTimeZone, precision: "date" as const,
      note: "Original scanned advertisement page 2 set 14 September 2026 as last date for receipt. Signed 17 September extension moves receipt deadline to 5 October 2026. Neither states a cutoff hour or application opening date. Postal delivery must reach KVS by deadline.",
    },
    citizenshipRule: "No nationality rule is printed in advertisement 03/2026 or its extension. Both posts require an eligible serving officer and employer forwarding on deputation. International applicants need KVS confirmation for application, selection and appointment; nationality alone does not establish deputation eligibility.",
    residenceRule: "No domicile or residence condition is printed. New Delhi is the postal application address, not an applicant residence rule or confirmed work location.",
    selectionStages: ["Current employer checks service and forwards application with vigilance clearance and five years of ACRs/APARs", "KVS checks deputation eligibility and qualifications", "Further selection procedure is not stated in these notices"],
    fee: "No application fee stated in original advertisement or extension.",
    statusNote: "Signed deadline extension applied to original scanned advertisement. First connector output and transcription await founder review.",
    venues: [{ kind: "unknown" as const, name: "Selection venue or workplace not published in reviewed advertisement" }],
    sources: [
      evidenceSource(source, index.evidence, "KVS recruitment document register", "HTML", "English"),
      evidenceSource(source, original.evidence, "KVS advertisement 03/2026, four scanned pages", "scanned PDF", "English"),
      evidenceSource(source, extension.evidence, "KVS 17 September 2026 signed deadline extension", "scanned PDF", "English"),
    ],
    applicationUrl: notice.advertisementUrl,
  };
  const engineer = makeCycle({
    ...shared, id: "kvs-executive-engineer-deputation-03-2026",
    title: "Executive Engineer — KVS deputation",
    programme: "KVS Executive Engineer deputation 2026",
    scopeLabel: "One Executive Engineer deputation post. New Delhi mailing address does not establish appointment location; no examination venue is published.",
    outcome: "One Executive Engineer appointment by transfer on deputation, initial term three years subject to applicable rules.",
    qualifications: "Recognized Civil Engineering graduate degree plus one of three Annexure I service routes: analogous parent-cadre post with civil works experience; Assistant Engineer (Civil), seven years of civil works at pay Level 7; or Assistant Executive Engineer (Civil)/equivalent with four regular years at Level 10.",
    salary: "Pay Level 11, ₹67,700–₹2,08,700, per original advertisement page 1.",
    rules: { complete: false, asOn: notice.closesOn,
      education: { minLevel: "bachelor", fields: ["Civil Engineering"], evidence: "Original scanned advertisement Annexure I page 3: Civil Engineering degree and one qualifying service route." },
      manualChecks: [
        { stage: "apply", text: "Verify eligible serving-officer deputation status, one civil-engineering service route, age below 56 at receipt deadline, employer forwarding and foreign-citizen permission with KVS." },
        { stage: "selection", text: "KVS must check parent-cadre service records, vigilance clearance and five attested ACR/APAR years; selection method and any language test are not stated." },
        { stage: "outcome", text: "Confirm appointment permission, lending-employer release and applicable deputation terms." },
      ],
    },
  });
  const languageOfficer = makeCycle({
    ...shared, id: "kvs-assistant-director-official-language-deputation-03-2026",
    title: "Assistant Director (Official Language) — KVS deputation",
    programme: "KVS Assistant Director (Official Language) deputation 2026",
    scopeLabel: "One Assistant Director (Official Language) deputation post. Postal destination is not a confirmed job or selection venue.",
    outcome: "One Assistant Director (Official Language) appointment by transfer on deputation, initial term three years subject to applicable rules.",
    qualifications: "Central/State/UT government officer holding an analogous regular post or three regular years at pay Level 7, plus an accepted master's degree combination involving Hindi and English at degree level and three years of translation, terminology, teaching or research experience as specified in Annexure I.",
    salary: "Pay Level 10, ₹56,100–₹1,77,500, per original advertisement page 1.",
    rules: { complete: false, asOn: notice.closesOn,
      education: { minLevel: "master", evidence: "Original scanned advertisement Annexure I page 3: master's degree with listed Hindi/English study or examination-medium alternatives, and relevant three-year experience." },
      languages: [
        { language: "hi", stage: "apply", requirement: "Annexure I requires an accepted master's/degree-level subject or examination-medium combination involving Hindi and English, plus specified Hindi/English work experience. No CEFR or other standardized language level is given.", evidence: "KVS advertisement 03/2026, Annexure I page 3.", sourceUrl: notice.advertisementUrl },
        { language: "en", stage: "apply", requirement: "Annexure I requires an accepted master's/degree-level subject or examination-medium combination involving Hindi and English, plus specified Hindi/English work experience. No CEFR or other standardized language level is given.", evidence: "KVS advertisement 03/2026, Annexure I page 3.", sourceUrl: notice.advertisementUrl },
      ],
      manualChecks: [
        { stage: "apply", text: "Verify one accepted Hindi/English education combination, three years of specified language work, eligible government service, age below 56, employer forwarding and foreign-citizen permission with KVS." },
        { stage: "selection", text: "KVS must validate language education/work evidence, service history, vigilance clearance and five attested ACR/APAR years; no separate proficiency scale or selection test is stated." },
        { stage: "outcome", text: "Confirm appointment permission, lending-employer release and applicable deputation terms." },
      ],
    },
  });
  return { cycles: [engineer, languageOfficer], evidence: [index.evidence, original.evidence, extension.evidence], complete: false, warnings: [
    "Only advertisement 03/2026 and its 17 September extension are extracted; other KVS recruitments and later amendments remain coverage gaps.",
    "Deadline is date-only. Receipt by postal mail, not mailing or online submission, is required by 5 October; no cutoff hour or application opening date is printed.",
    "Foreign-citizen permission is unstated. Deputation requires qualified existing government service and employer release; language-education combinations require document review.",
    "All extracted text comes from visual reading of scanned PDFs and requires founder confirmation before publication.",
  ] };
};
