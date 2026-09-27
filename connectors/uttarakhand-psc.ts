/** UKPSC combined civil service 2026: exact 81-page notice, draft only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn, clockSecondIn } from "../lib/time.ts";
import type { Connector, Evidence } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Document { key: string; url: string; sha256: string }
interface Extraction {
  advertisement: string; indexUrl: string; applicationUrl: string; publishedOn: string;
  opensOn: string; closesOn: string; cutoffLocalTime: string; ageAsOn: string;
  vacancies: number; postCodes: number; precedingDocumentUrls: string[]; documents: Document[];
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/ukpsc-pcs-a1-2026-27.json", import.meta.url), "utf8")) as Extraction;
export const UKPSC_RECRUITMENT_INDEX = extraction.indexUrl;

/** Outer listing rows contain nested tables, so count tr depth instead of matching a closing tag. */
function listingRows(html: string): string[] {
  const tableAt = html.search(/<table\b[^>]*id=["']recruitments["']/i);
  if (tableAt < 0) throw new Error("UKPSC recruitment table missing");
  const bodyAt = html.indexOf("<tbody>", tableAt);
  const bodyEnd = html.indexOf("</tbody>", bodyAt);
  if (bodyAt < 0 || bodyEnd < 0) throw new Error("UKPSC recruitment table body missing");
  const body = html.slice(bodyAt + 7, bodyEnd);
  const tags = [...body.matchAll(/<\/?tr\b[^>]*>/gi)];
  const rows: string[] = [];
  let depth = 0;
  let start = 0;
  for (const tag of tags) {
    if (/^<tr\b/i.test(tag[0])) {
      if (depth === 0) start = tag.index!;
      depth += 1;
    } else {
      depth -= 1;
      if (depth < 0) throw new Error("UKPSC recruitment row nesting changed");
      if (depth === 0) rows.push(body.slice(start, tag.index! + tag[0].length));
    }
  }
  if (depth !== 0 || !rows.length) throw new Error("UKPSC recruitment rows incomplete");
  return rows;
}

function pdfLinks(row: string): string[] {
  return [...row.matchAll(/<a\b[^>]*href=["']([^"']+\.pdf)["'][^>]*>/gi)].map((match) => new URL(match[1], UKPSC_RECRUITMENT_INDEX).href);
}

export function checkUttarakhandIndex(html: string): void {
  const rows = listingRows(html);
  const wanted = extraction.documents.map((document) => document.url);
  const candidates = rows.filter((row) => wanted.some((url) => row.includes(url)));
  if (candidates.length !== 1) throw new Error("UKPSC PCS 2026 index row missing or split; review required");
  const row = candidates[0];
  const actual = pdfLinks(row);
  if (actual.length !== wanted.length || new Set(actual).size !== actual.length || actual.some((url) => !wanted.includes(url))) throw new Error("UKPSC PCS 2026 PDF set changed; review required");
  const dates = [...row.matchAll(/\b\d{2}-\d{2}-\d{4}\b/g)].map((match) => match[0]);
  if (JSON.stringify(dates) !== JSON.stringify(["09-09-2026", "09-09-2026", "07-10-2026", "29-09-2026", "29-09-2026", "16-10-2026"])) throw new Error("UKPSC PCS 2026 application or correction dates changed");
  const apply = /<a\b[^>]*href=["']([^"']*)["'][^>]*class=["']apply-link["']/i.exec(row)?.[1];
  if (apply !== extraction.applicationUrl) throw new Error("UKPSC PCS 2026 application link changed");
  const position = rows.indexOf(row);
  const preceding = rows.slice(0, position).flatMap(pdfLinks);
  if (position !== extraction.precedingDocumentUrls.length || JSON.stringify(preceding) !== JSON.stringify(extraction.precedingDocumentUrls)) throw new Error("UKPSC new earlier notice may amend PCS 2026; founder review required");
}

export const uttarakhandPsc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("UKPSC official PDF bytes required");
  const index = await fetchText(UKPSC_RECRUITMENT_INDEX, { accept: "text/html" });
  if (index.evidence.url !== UKPSC_RECRUITMENT_INDEX) throw new Error("UKPSC recruitment index redirected");
  checkUttarakhandIndex(index.text);
  const documents = new Map<string, Evidence>();
  for (const document of extraction.documents) {
    const pdf = await fetchBytes(document.url, { accept: "application/pdf" });
    const hash = createHash("sha256").update(pdf.bytes).digest("hex");
    if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== document.url || pdf.evidence.sha256 !== hash || hash !== document.sha256) throw new Error(`UKPSC PCS ${document.key} PDF changed; extracted fields withheld`);
    documents.set(document.key, pdf.evidence);
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today < extraction.opensOn ? "upcoming" : today > extraction.closesOn || (today === extraction.closesOn && clockSecondIn("Asia/Kolkata", now) > extraction.cutoffLocalTime) ? "closed" : "open";
  const cycle = makeCycle({
    id: "uttarakhand-psc-2026-a1-combined-civil-service", sourceId: source.id,
    title: "Uttarakhand Combined State Civil / Upper Subordinate Services Examination 2026",
    cycleLabel: `Advertisement ${extraction.advertisement}`, authority: source.authority,
    pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-UT"],
    scopeLabel: `One online application and later post preference for ${extraction.vacancies} vacancies across ${extraction.postCodes} post codes; duplicate PDF links are one notice`,
    outcome: "67 Group A/B vacancies across 16 post codes, including Deputy Collector, Deputy Superintendent of Police, District Commandant, Finance Officer, Assistant Commissioner and other state services. Post-specific appointment rules apply.",
    status, statusNote: "Original 81-page Hindi notice and one-page summary retained; first extraction requires founder review. Two newer index rows are unrelated Lecturer and veterinary edit-window notices, not changed PCS application dates.",
    applicationWindow: { opensOn: extraction.opensOn, closesOn: extraction.closesOn, cutoffLocalTime: extraction.cutoffLocalTime, cutoffInclusive: true, officialTimeZone: "Asia/Kolkata", precision: "second", note: "Advertisement page 1 and summary page 1: applications 9–29 September 2026, through 23:59:59. Pages 1 and 15: 7–16 October is a later edit window only. Notice does not print timezone; Asia/Kolkata is Uttarakhand local interpretation." },
    qualifications: "Most posts require a degree from a university established by law in India; several post codes require specific degrees or experience. General age 21–42 on 1 July 2026, subject to state-category, disability and service relaxations. Police and Home Guards posts have physical/medical standards (advertisement pages 6–10).",
    citizenshipRule: "Advertisement page 13 accepts Indian citizens; Tibetan refugees who came to India before 1 January 1962 intending permanent settlement; and persons of Indian origin migrating for permanent settlement from Pakistan, Myanmar, Sri Lanka, Kenya, Uganda or Tanzania. Non-citizen routes need a state-government eligibility certificate, and appointment can be provisional until it is produced. Other foreign-citizen eligibility is not established by this notice.",
    residenceRule: "Uttarakhand residence is not a blanket application condition in the retained notice. State residence and category certificates control reservation and age-relaxation benefits; a non-resident may apply for unreserved consideration subject to all other criteria (advertisement pages 10–12).",
    selectionStages: ["Preliminary objective examination: General Studies and qualifying General Aptitude Test", "Main written examination: eight compulsory papers, including General Hindi with 35% minimum", "Interview/personality test", "Post-specific document, physical and medical checks; post preferences collected after successful preliminary stage"],
    fee: "Unreserved and Uttarakhand OBC/EWS: ₹166.36 total; Uttarakhand SC/ST and eligible disability categories: ₹76.36; qualifying Uttarakhand orphan candidates: no fee. Other category rules require notice review (page 16).",
    rules: { complete: false, asOn: extraction.ageAsOn,
      education: { minLevel: "bachelor", evidence: "Advertisement pages 6–7: general degree requirement for most posts, with listed post-specific degrees; equivalence and exceptions require review." },
      age: { min: 21, evidence: "Advertisement page 9: age at least 21 on 1 July 2026; general upper limit 42 with category and service relaxations on page 10." },
      languages: [{ language: "hi", stage: "selection", requirement: "Main examination has compulsory General Hindi paper worth 150 marks; minimum 35% required. No CEFR or other standard level is stated.", evidence: "Advertisement page 26 and English syllabus page 46.", sourceUrl: extraction.documents[1].url }],
      manualChecks: [
        { stage: "apply", text: "Verify Indian citizenship or the narrow Tibetan-refugee/person-of-Indian-origin exception and required eligibility certificate. Nationality alone cannot decide those documentary routes (advertisement page 13)." },
        { stage: "apply", text: "Verify post-specific degree, professional qualification and experience; one form permits multiple post choices (advertisement pages 6–8 and 14)." },
        { stage: "apply", text: "Verify general age 21–42 on 1 July 2026, plus applicable state-category/disability/service relaxations and certificates (advertisement pages 9–12)." },
        { stage: "selection", text: "Qualify General Hindi main paper at 35% of 150 marks; other written answers may use permitted Hindi or English medium, without mixed-language answers (advertisement pages 20, 26 and 46)." },
        { stage: "outcome", text: "Confirm eligibility certificate for conditional non-citizen categories and post-specific physical, medical, character and appointment checks (advertisement pages 8–13)." },
      ],
    },
    venues: [{ kind: "unknown", name: "Preliminary examination city choices appear in Appendix 1; individual centre assignment and street venue require official confirmation." }],
    sources: [
      evidenceSource(source, index.evidence, "UKPSC recruitment register", "HTML", "Hindi/English"),
      ...extraction.documents.map((document) => evidenceSource(source, documents.get(document.key)!, `UKPSC PCS 2026 ${document.key}`, "PDF", "Hindi/English")),
    ],
    applicationUrl: extraction.applicationUrl,
  });
  return { cycles: [cycle], evidence: [index.evidence, ...documents.values()], complete: false, warnings: [
    "One combined PCS application covers 67 vacancies across 16 post codes. Two official links contain byte-identical 81-page advertisements; they do not create duplicate cycles.",
    "Index End Date cells can represent a correction or result notice, not an application deadline. The unrelated 22 and 24 September rows are bound as current preceding rows; any new row forces founder review.",
    "Non-citizen eligibility exists only for narrow refugee/migrant categories with a state certificate; all other foreign applicants require official confirmation. Residence-based reservation is separate.",
    "General Hindi main paper requires 35% but no CEFR level. Hindi source text and post-specific conditions need founder visual review before publication.",
    "Other UKPSC notices, departmental and local recruitment remain uncollected coverage gaps.",
  ] };
};
