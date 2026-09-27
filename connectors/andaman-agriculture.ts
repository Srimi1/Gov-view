/** A&N Administration 2026 Agriculture intake: exact scanned notice, draft only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  cycleId: string; indexUrl: string; applicationUrl: string;
  document: { url: string; sha256: string };
  opensOn: string; closesOn: string; vacancies: number;
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/andaman-agriculture-1055-2026.json", import.meta.url), "utf8")) as Extraction;
export const ANDAMAN_RECRUITMENT_INDEX = extraction.indexUrl;

/** Current live card must still refer to only the retained Agriculture notice. */
export function checkAndamanAgricultureIndex(html: string): void {
  const card = /<span\b[^>]*id=["']ContentPlaceHolder2_lbladv["'][^>]*>([\s\S]*?)<\/span>/i.exec(html)?.[1];
  if (!card) throw new Error("Andaman ongoing advertisement card missing; review required");
  const links = [...card.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({
    url: new URL(match[1], ANDAMAN_RECRUITMENT_INDEX).href,
    text: stripTags(match[2]).replace(/\s+/g, " "),
  }));
  if (links.length !== 1 || links[0].url !== extraction.document.url || !/Department of Agriculture, Andaman and Nicobar Administration/i.test(links[0].text)) {
    throw new Error("Andaman Agriculture live notice link changed or new live notice added; review required");
  }
  const dates = [...links[0].text.matchAll(/\b\d{2}-\d{2}-\d{4}\b/g)].map((match) => match[0]);
  if (JSON.stringify(dates) !== JSON.stringify(["24-09-2026", "23-10-2026"])) {
    throw new Error("Andaman Agriculture application dates changed; review required");
  }
}

export const andamanAgriculture: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("Andaman Agriculture scanned PDF fetch required");
  const index = await fetchText(ANDAMAN_RECRUITMENT_INDEX, { accept: "text/html" });
  if (index.evidence.url !== ANDAMAN_RECRUITMENT_INDEX) throw new Error("Andaman recruitment portal redirected");
  checkAndamanAgricultureIndex(index.text);
  const pdf = await fetchBytes(extraction.document.url, { accept: "application/pdf" });
  const hash = createHash("sha256").update(pdf.bytes).digest("hex");
  if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== extraction.document.url || pdf.evidence.sha256 !== hash || hash !== extraction.document.sha256) {
    throw new Error("Andaman Agriculture PDF changed; extracted fields withheld");
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today < extraction.opensOn ? "upcoming" : today > extraction.closesOn ? "closed" : "open";
  const cycle = makeCycle({
    id: extraction.cycleId,
    sourceId: source.id,
    title: "Andaman and Nicobar Agriculture Group B/C recruitment 2026",
    cycleLabel: "Agriculture vacancy notice · 21 September 2026",
    programme: "Andaman and Nicobar Agriculture 2026",
    authority: source.authority,
    pathway: "recruitment",
    jurisdictionCode: "IN",
    jurisdictionName: "India",
    subdivisionCodes: ["IN-AN"],
    scopeLabel: "A&N Agriculture Department: three post codes, ten tentative vacancies and one preference-based recruitment notice",
    outcome: "One Agriculture Officer (Group B), two Agriculture Engineering Assistants (Group B) and seven Agriculture Assistants (Group C); selection by CBT merit, post preference and document checks",
    status,
    statusNote: "Official portal shows 24 September–23 October 2026 applications. Scanned notice gives a 12:00 noon opening and ambiguous '12:00 Midnight' closing clock; founder review pending.",
    applicationWindow: {
      opensOn: extraction.opensOn,
      closesOn: extraction.closesOn,
      officialTimeZone: "Asia/Kolkata",
      cutoffLocalTime: null,
      precision: "date",
      note: "Portal and scanned notice page 2 agree on dates. Notice prints opening 12:00 noon and closing '12:00 Midnight' without clarifying whether that means start or end of 23 October. Asia/Kolkata is local interpretation; precise closing time withheld.",
    },
    qualifications: "Officer: master's in Agriculture/Horticulture. Engineering Assistant: Agriculture Engineering degree plus soil/water conservation training. Assistant: bachelor's in Agriculture/Horticulture. Notice page 5; category, equivalence and age relaxations need individual review.",
    citizenshipRule: "Scanned official notice page 4, eligibility condition 3(i): applicant must be an Indian citizen. A foreign citizen does not meet the published application criterion.",
    residenceRule: "No general A&N domicile condition for unreserved applicants appears in checked notice. Local ST and OBC status affects reserved vacancies; outside-UT ST/OBC candidates are considered for unreserved vacancies (notice page 1).",
    selectionStages: [
      "Online application with one or more post preferences",
      "Computer-based test: General Studies and post-specific paper; English Language questions appear in General Studies",
      "In-person original-certificate verification for shortlisted candidates",
      "Final selection by CBT merit and post preference, subject to recruitment rules",
    ],
    fee: "₹100; female, ST and eligible benchmark-disability candidates exempt (notice page 6).",
    rules: {
      complete: false,
      asOn: extraction.closesOn,
      nationality: { allowed: ["IN"], evidence: "Scanned Agriculture vacancy notice page 4, eligibility condition 3(i): applicant must be an Indian Citizen." },
      education: { minLevel: "bachelor", evidence: "Notice page 5: all three posts require at least a degree; Officer requires a master's and Engineering Assistant has additional training. Exact field and equivalence remain manual." },
      age: { min: 18, evidence: "Notice page 4: all three posts have minimum age 18 at application closing date; upper limits differ by post and sex, with category/service relaxations." },
      languages: [
        { language: "en", stage: "selection", requirement: "CBT General Studies contains English Language questions; question paper is in English and Hindi. No fixed English pass mark or standardized proficiency level is published.", evidence: "Scanned vacancy notice pages 6–7, CBT scheme and indicative syllabus.", sourceUrl: extraction.document.url },
        { language: "hi", stage: "apply", mandatory: false, requirement: "Only Agriculture Assistant: ability to read and write Hindi is desirable, not essential. No formal level or certificate is stated.", evidence: "Scanned vacancy notice page 5, Agriculture Assistant desirable-qualification column.", sourceUrl: extraction.document.url },
      ],
      manualChecks: [
        { stage: "apply", text: "Choose post code and confirm exact field, degree, Engineering Assistant training and any degree-equivalence decision (notice page 5)." },
        { stage: "apply", text: "Confirm post- and sex-specific upper age limit and applicable category, disability, service or ex-serviceman relaxation at 23 October 2026 (notice pages 4–5)." },
        { stage: "apply", text: "Confirm whether separate portal links require distinct applications for multiple post preferences (notice page 2)." },
        { stage: "selection", text: "Sit CBT in English/Hindi; General Studies includes English Language questions, with no stated formal level or fixed English-only pass threshold (notice pages 6–7)." },
        { stage: "outcome", text: "Verify original degree, age and category documents; final appointment follows CBT merit, preference and recruitment rules (notice pages 8–9)." },
      ],
    },
    venues: [{ kind: "unknown", name: "CBT is published for South Andaman; exact centre and exam date will be sent later (notice page 6)" }],
    sources: [
      evidenceSource(source, index.evidence, "A&N Administration ongoing recruitment card", "HTML", "English"),
      evidenceSource(source, pdf.evidence, "Agriculture Group B/C vacancy notice, 21 September 2026", "scanned PDF", "English"),
    ],
    applicationUrl: extraction.applicationUrl,
  });
  return { cycles: [cycle], evidence: [index.evidence, pdf.evidence], complete: false, warnings: [
    "This draft counts one preference-based recruitment notice covering three posts. Founder must confirm whether separate online application links create distinct cycles.",
    "The notice says closing 23 October '12:00 Midnight'; precise cutoff is ambiguous and withheld. Opening 24 September 12:00 noon is retained in text.",
    "Indian citizenship is explicit. Local ST/OBC reservation is not a blanket domicile rule. Post-specific qualifications, upper ages and relaxations remain manual.",
    "English Language appears in CBT and Hindi literacy is desirable only for Agriculture Assistant; no CEFR or other formal level is stated.",
    "Only this live Agriculture notice is extracted. Older A&N recruitment cycles, other departments and later amendments remain coverage gaps.",
  ] };
};
