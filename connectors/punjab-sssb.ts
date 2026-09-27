/** Punjab SSSB Group D advertisement 04/2026. Signed amendments override stale index dates. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle } from "./util.ts";

interface Document { key: string; url: string; sha256: string; title: string; language: string }
interface Extraction {
  cycleId: string; indexUrl: string; detailUrl: string; amendmentsUrl: string; documents: Document[];
  reopenedOn: string; finalClosesOn: string; correctionOpensOn: string; correctionClosesOn: string;
  correctionCutoffLocalTime: string; vacancies: number; ageAsOn: string;
}
const details = JSON.parse(readFileSync(new URL("../data/extractions/psssb-group-d-04-2026.json", import.meta.url), "utf8")) as Extraction;
export const PSSSB_PAGES = [details.indexUrl, details.detailUrl, details.amendmentsUrl] as const;
export const PSSSB_PDFS = details.documents.map((document) => document.url);

function links(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)]
    .map((match) => match[1].replaceAll("&#038;", "&").replaceAll("&amp;", "&"));
}

export function checkPsssbPages(index: string, detail: string, amendments: string): void {
  if (!links(index).includes(details.detailUrl) || !index.includes("Advertisement No. 04 of 2026")) {
    throw new Error("Punjab SSSB Group D index changed; review required");
  }
  if (!links(detail).includes(details.documents[0].url) || !links(detail).includes(details.amendmentsUrl) ||
      !detail.includes("Correction Portal Advt No. 04 of 2026") || !detail.includes("24-09-2026") || !detail.includes("27-09-2026")) {
    throw new Error("Punjab SSSB Group D vacancy detail changed; review required");
  }
  const amendmentLinks = links(amendments).filter((url) => url.startsWith("https://sssb.punjab.gov.in/wp-content/uploads/") && url.endsWith(".pdf"));
  const expected = details.documents.slice(1).map((document) => document.url);
  if (JSON.stringify(amendmentLinks.sort()) !== JSON.stringify(expected.sort())) {
    throw new Error("Punjab SSSB Group D amendments changed; review required");
  }
}

export const punjabSssb: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("Punjab SSSB original PDF byte fetch required");
  const [index, detail, amendments] = await Promise.all(PSSSB_PAGES.map((url) => fetchText(url, { accept: "text/html" })));
  PSSSB_PAGES.forEach((url, position) => {
    if ([index, detail, amendments][position].evidence.url !== url) throw new Error("Punjab SSSB page redirected; review required");
  });
  checkPsssbPages(index.text, detail.text, amendments.text);
  const documents = await Promise.all(details.documents.map((document) => fetchBytes(document.url, { accept: "application/pdf" })));
  details.documents.forEach((document, position) => {
    const fetched = documents[position];
    const hash = createHash("sha256").update(fetched.bytes).digest("hex");
    if (fetched.bytes.subarray(0, 5).toString() !== "%PDF-" || fetched.evidence.url !== document.url ||
        fetched.evidence.sha256 !== hash || hash !== document.sha256) {
      throw new Error("Punjab SSSB PDF changed; extracted fields withheld");
    }
  });
  const today = civilDateIn("Asia/Kolkata", now);
  const original = details.documents[0].url;
  const final = details.documents[3].url;
  const correction = details.documents[4].url;
  const cycle = makeCycle({
    id: details.cycleId, sourceId: source.id,
    title: "Punjab Group D government recruitment 2026",
    cycleLabel: "PSSSB advertisement 04/2026",
    programme: "Punjab Subordinate Services Selection Board Group D common recruitment",
    authority: source.authority, pathway: "recruitment",
    jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-PB"],
    scopeLabel: "Punjab government departments; department and post rows are positions within one application cycle, not separate cycles or examination venues",
    outcome: `${details.vacancies.toLocaleString("en-IN")} Group D positions across Punjab government departments, including Sewadar, Chowkidar and Safai Sewak roles, subject to category and department allocation`,
    status: today > details.finalClosesOn ? "closed" : "open",
    statusNote: `Signed 17 September corrigendum extends new applications and fee payment to 21 September. Correction portal ${details.correctionOpensOn}–${details.correctionClosesOn} at ${details.correctionCutoffLocalTime} IST is for existing applicants only; it does not reopen recruitment. Older HTML date row is superseded. Founder review pending.`,
    applicationWindow: {
      opensOn: details.reopenedOn, closesOn: details.finalClosesOn,
      officialTimeZone: "Asia/Kolkata", cutoffLocalTime: null, precision: "date",
      note: "Original window was 27 February–20 March 2026; reopened 25 August. Signed 17 September corrigendum gives final 21 September application and fee deadline without a cutoff time. Correction window through 27 September at 17:00 is only for previously submitted forms.",
    },
    qualifications: "Original notice generally requires Matriculation with Punjabi as a subject. It names education exceptions for blind and riot/terror affected persons and sweeper appointments. Role-specific qualification and exception evidence need founder review.",
    citizenshipRule: "Notice does not state whether foreign citizens may apply, enter the test, or receive a Punjab government appointment. International applicants must confirm each stage directly with PSSSB.",
    residenceRule: "Original notice's reservation section says every category must present a Punjab domicile/residence certificate issued within five years at counselling. Scope for unreserved and international applicants needs authority confirmation; do not infer that foreign residence alone determines eligibility.",
    selectionStages: ["Online application and category-based fee", "Part A Matric-equivalent Punjabi qualifying test, minimum 50%", "Part B scored objective examination with negative marking", "Common merit list, document verification and counselling", "Recommendation to hiring department and appointment checks"],
    fee: "Original notice: ₹1,000 general/freedom-fighter/sports; ₹250 SC/BC/EWS; ₹200 ex-servicemen/dependents; ₹500 persons with disabilities. Fee paid once is non-refundable. Correction may require category fee difference.",
    salary: "Original notice lists Group D Level 1 pay scale ₹18,000–₹56,900 under 7th CPC; actual appointment terms vary by role and department.",
    rules: { complete: false, asOn: details.ageAsOn,
      age: { min: 18, evidence: "Original advertisement page 4: minimum 18 on 1 January 2026. General maximum 37 and several category/employee/disability/widow/ex-service exceptions require individual verification." },
      languages: [{ language: "pa", stage: "selection", requirement: "Mandatory Punjabi qualifying test equivalent to Matriculation standard; at least 50% required for final merit. Matric Punjabi subject is general educational requirement with stated role/person exceptions. No CEFR level.", evidence: "Original advertisement pages 3–5, quoted service rule and examination scheme.", sourceUrl: original }],
      manualChecks: [
        { stage: "apply", text: "Confirm whether PSSSB accepts foreign citizens and whether this post's education, Punjabi-subject and age exception rules apply to you; notice gives no international route." },
        { stage: "selection", text: "Verify Punjabi Part A score of at least 50%, role-specific qualification and current Punjab domicile/residence certificate required at counselling according to original notice. Authority must clarify how this applies to unreserved and international applicants." },
        { stage: "outcome", text: "Confirm foreign-citizen Punjab government appointment permission and all department/category document checks with PSSSB." },
      ],
    },
    venues: [{ kind: "unknown", name: "Examination venue not published in the reviewed notices" }],
    sources: [
      evidenceSource(source, index.evidence, "PSSSB Group D advertisement index", "HTML", "English"),
      evidenceSource(source, detail.evidence, "PSSSB advertisement 04/2026 application timeline", "HTML", "English"),
      evidenceSource(source, amendments.evidence, "PSSSB amendment register", "HTML", "English"),
      ...documents.map((document, position) => evidenceSource(source, document.evidence, details.documents[position].title, "PDF", details.documents[position].language)),
    ],
    applicationUrl: details.detailUrl,
    changes: [
      { at: "2026-08-24T00:00:00+05:30", kind: "updated", summary: "Board reopened application and revised vacancy count; original advertisement remains same cycle." },
      { at: "2026-09-17T00:00:00+05:30", kind: "extended", summary: `Signed corrigendum raised total to ${details.vacancies.toLocaleString("en-IN")} and extended application/fee deadline to 21 September.` },
      { at: "2026-09-23T00:00:00+05:30", kind: "updated", summary: "Existing applicants may correct specified form fields through 27 September at 17:00 IST; new applications remain closed." },
    ],
  });
  return { cycles: [cycle], evidence: [index.evidence, detail.evidence, amendments.evidence, ...documents.map((document) => document.evidence)], complete: false, warnings: [
    "Only Group D advertisement 04/2026 extracted; PSSSB other groups, departments and future notices remain gaps.",
    "Original Punjabi notice and later signed amendments override older vacancy-detail HTML date. Latest signed notice closes new applications on 21 September, despite correction portal through 27 September.",
    "International applicant/appointment permission is unstated. Punjab domicile certificate wording is in reservation section but refers to every category; founder must confirm implications before publication.",
    "No official cutoff hour is printed for new applications on 21 September. The 17:00 time applies only to the correction portal.",
    `Critical deadline and vacancy fields depend on pinned signed PDF ${final}; correction status depends on ${correction}. Any byte change withholds extraction.`,
  ] };
};
