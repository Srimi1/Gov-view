/** One exact-notice ACTREC recruitment pilot; every revision requires founder review. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Connector } from "./types.ts";
import { civilDateIn } from "../lib/time.ts";
import { dayFirstDate, evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  advertisement: string; indexUrl: string; pdfUrl: string; applicationUrl: string; pdfSha256: string;
  indexFrom: string; closesOn: string; cutoffLocalTime: string;
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/actrec-sr-198-2026.json", import.meta.url), "utf8")) as Extraction;

/** Bind title, application route and date range to one public ACTREC table row. */
export function parseActrecSeniorResidentIndex(html: string) {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => match[1])
    .filter((row) => stripTags(row).includes(extraction.advertisement));
  if (rows.length !== 1) throw new Error("ACTREC 198/2026 index row missing or duplicated; review required");
  const row = rows[0];
  const links = [...row.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ url: new URL(match[1], extraction.indexUrl).href, title: stripTags(match[2]) }));
  const pdf = links.filter((link) => link.url === extraction.pdfUrl);
  const application = links.filter((link) => link.url === extraction.applicationUrl);
  const dates = [...row.matchAll(/<time\b[^>]*>([\s\S]*?)<\/time>/gi)]
    .map((match) => dayFirstDate(stripTags(match[1])));
  if (pdf.length !== 1 || application.length !== 1 ||
      !/Senior Resident.*Transfusion Medicine/i.test(pdf[0].title) ||
      JSON.stringify(dates) !== JSON.stringify([extraction.indexFrom, extraction.closesOn])) {
    throw new Error("ACTREC 198/2026 PDF, application link or date range changed; review required");
  }
  return { pdfUrl: pdf[0].url, applicationUrl: application[0].url, indexFrom: dates[0], closesOn: dates[1] };
}

export const actrecSeniorResident: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("ACTREC original PDF byte fetch required");
  const index = await fetchText(extraction.indexUrl, { accept: "text/html" });
  if (index.evidence.url !== extraction.indexUrl) throw new Error("ACTREC jobs index redirected; review required");
  parseActrecSeniorResidentIndex(index.text);
  const pdf = await fetchBytes(extraction.pdfUrl, { accept: "application/pdf" });
  const hash = createHash("sha256").update(pdf.bytes).digest("hex");
  if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== extraction.pdfUrl ||
      pdf.evidence.sha256 !== hash || hash !== extraction.pdfSha256) {
    throw new Error("ACTREC 198/2026 PDF changed; extracted fields withheld");
  }
  const cutoff = Date.parse(`${extraction.closesOn}T${extraction.cutoffLocalTime}:00+05:30`);
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today < extraction.indexFrom ? "uncertain" as const : now.getTime() >= cutoff ? "closed" as const : "open" as const;
  const cycle = makeCycle({
    id: "actrec-senior-resident-transfusion-198-2026", sourceId: source.id,
    title: "Senior Resident — Transfusion Medicine (ACTREC)", cycleLabel: extraction.advertisement,
    authority: source.authority, pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India",
    subdivisionCodes: ["IN-MH"],
    scopeLabel: "Tata Memorial Centre ACTREC, a Department of Atomic Energy grant-in-aid institution; tenured, non-permanent residency. Appointment may rotate to other TMC centres; those are job placements, not examination venues.",
    outcome: "Senior Resident appointment in Transfusion Medicine through 31 July 2027; vacancy count not printed",
    status,
    statusNote: "Original PDF and live index retained. Advertisement dated 24 September and index links online application; opening clock time and vacancy count are unknown. Founder review pending.",
    applicationWindow: { opensOn: null, closesOn: extraction.closesOn, cutoffLocalTime: extraction.cutoffLocalTime, officialTimeZone: "Asia/Kolkata", precision: "minute", note: "PDF page 2: online applications close 8 October 2026 at 17:30 IST. Index displays 24 September–8 October; first date is not explicitly labelled application opening." },
    qualifications: "MD in Immuno-Haematology and Blood Transfusion or Transfusion Medicine, or equivalent postgraduate degree; all degrees must be National Medical Commission recognized. Maharashtra Medical Council registration is mandatory on appointment.",
    citizenshipRule: "Original ACTREC advertisement page 1 invites Indian nationals. Foreign citizens do not meet this published application criterion. Foreign education or overseas work does not change the nationality condition.",
    residenceRule: "No applicant domicile requirement is printed. Placement can rotate among TMC centres; work location is not an applicant residence rule.",
    selectionStages: ["Online application and ₹100 fee", "Qualification and document screening", "MCQ if applicant numbers trigger one", "Interview in person or online by request", "Maharashtra Medical Council registration and joining checks"],
    fee: "₹100 online application fee. Separate ₹133,623 refundable caution deposit applies at joining or via five salary deductions, subject to notice conditions; it is not an application fee.",
    salary: "₹133,623–₹145,530 per month, depending on experience, per original PDF.",
    rules: { complete: false, asOn: extraction.closesOn,
      education: { minLevel: "master", fields: ["Immuno-Haematology and Blood Transfusion", "Transfusion Medicine"], evidence: "ACTREC 198/2026 PDF page 1: MD in named Transfusion Medicine subjects or equivalent PG degree; NMC recognition also required." },
      nationality: { allowed: ["IN"], evidence: "ACTREC 198/2026 PDF page 1: applications invited from Indian Nationals." },
      manualChecks: [
        { stage: "apply", text: "Confirm NMC-recognized MD or equivalent postgraduate degree, age 40 or relevant relaxation as of 8 October 2026, and documents. Foreign citizens do not meet printed Indian-national criterion." },
        { stage: "selection", text: "Confirm degree proof and any required employer NOC; MCQ may be held before interview based on applicant numbers." },
        { stage: "outcome", text: "Confirm Maharashtra Medical Council registration, joining deposit, service terms and any placement rotation." },
      ],
    },
    venues: [{ kind: "online", name: "Interview may be attended online if shortlisted candidate requests a link" }, { kind: "unknown", name: "MCQ or in-person interview venue not yet published" }],
    sources: [evidenceSource(source, index.evidence, "ACTREC public jobs index, advertisement 198/2026", "HTML", "English"), evidenceSource(source, pdf.evidence, "ACTREC advertisement 198/2026 original notice", "PDF", "English")],
    applicationUrl: extraction.applicationUrl,
  });
  return { cycles: [cycle], evidence: [index.evidence, pdf.evidence], complete: false, warnings: [
    "Only ACTREC advertisement 198/2026 is bound here; other permanent and walk-in rows on this feed remain coverage gaps.",
    "Vacancy count, application opening instant and any language proficiency level are not printed in the reviewed notice.",
    "Caution deposit applies at joining; it is separate from the ₹100 application fee.",
  ] };
};
