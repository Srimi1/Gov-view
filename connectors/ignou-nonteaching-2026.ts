/** Exact-document, review-only IGNOU non-teaching advertisement 69/2026/Admn. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle } from "./util.ts";

interface Post {
  number: number; title: string; vacancies: number; ageMax: number;
  experienceYears: number; specialty: string;
}
interface Extraction {
  indexUrl: string; documentUrl: string; documentSha256: string;
  advertisement: string; postedOn: string; opensOn: string; closesOn: string;
  cutoffLocalTime: string; hardCopyClosesOn: string; posts: Post[];
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/ignou-nonteaching-69-2026.json", import.meta.url), "utf8")) as Extraction;

/** A changed row or added correction requires a new document and human review. */
export function verifyIgnouNonteachingIndex(html: string): void {
  const title = "Recruitment for Non-Teaching posts";
  const start = html.indexOf(title);
  const block = html.slice(start, start + 5_000);
  const documentPath = new URL(notice.documentUrl).pathname;
  if (start < 0 || html.indexOf(title, start + title.length) < 0 ||
      !block.includes(`href="${documentPath}"`) ||
      !block.includes("From 03.10.2026 to 02.11.2026 23:59:59 HRS.") ||
      !block.includes("23-09-2026") ||
      [...html.matchAll(/href="\/viewFile\/ad\/notification\/Detailed_Advertisement\.pdf"/g)].length !== 1 ||
      /(?:corrigendum|addendum|extension)[^<]{0,200}(?:69\/2026|non-teaching)/i.test(html)) {
    throw new Error("IGNOU non-teaching index or amendment set changed; review required");
  }
}

export const ignouNonteaching2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("IGNOU original PDF bytes required");
  const index = await fetchText(notice.indexUrl, { accept: "text/html" });
  if (index.evidence.url !== notice.indexUrl) throw new Error("IGNOU career index redirected; review required");
  verifyIgnouNonteachingIndex(index.text);
  const document = await fetchBytes(notice.documentUrl, { accept: "application/pdf" });
  const hash = createHash("sha256").update(document.bytes).digest("hex");
  if (document.bytes.subarray(0, 5).toString() !== "%PDF-" ||
      document.evidence.url !== notice.documentUrl || document.evidence.sha256 !== hash ||
      hash !== notice.documentSha256) {
    throw new Error("IGNOU non-teaching PDF changed; extracted fields withheld");
  }
  if (notice.posts.length !== 12 || notice.posts.reduce((sum, post) => sum + post.vacancies, 0) !== 14 ||
      new Set(notice.posts.map((post) => post.number)).size !== 12) {
    throw new Error("IGNOU post manifest needs review");
  }

  const today = civilDateIn("Asia/Kolkata", now);
  const status = today < notice.opensOn ? "upcoming" as const : today > notice.closesOn ? "closed" as const : "uncertain" as const;
  const sources = [
    evidenceSource(source, index.evidence, "IGNOU official career register, non-teaching row", "HTML", "English"),
    evidenceSource(source, document.evidence, `IGNOU advertisement ${notice.advertisement}, 12 pages`, "PDF", "English", notice.documentUrl),
  ];
  const citizenshipEvidence = `IGNOU advertisement ${notice.advertisement} page 9, nationality/citizenship section 7: Indian citizens; Nepal/Bhutan subjects and specified Tibetan refugees or Indian-origin migrants only with Government of India eligibility certificate. Examination admission can precede certificate; appointment offer cannot.`;
  const cycles = notice.posts.map((post) => {
    const grade = post.number <= 6 ? "Technical Assistant" : post.number <= 10 ? "Technical Manager" : "Assistant Director";
    const level = post.number <= 6 ? 8 : 10;
    return makeCycle({
      id: `ignou-69-2026-post-${post.number}`, sourceId: source.id,
      title: `${post.title} — IGNOU`, programme: "IGNOU non-teaching recruitment 2026",
      cycleLabel: `${notice.advertisement} · post ${post.number}`, authority: source.authority,
      pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India",
      scopeLabel: "IGNOU recruitment; appointment may be at headquarters or regional centres across India. New Delhi mailing address is not a test venue or residence rule.",
      outcome: `${post.vacancies} ${post.vacancies === 1 ? "vacancy" : "vacancies"} for ${grade}, pay Level ${level}. This first advertised round uses direct recruitment; tenure or permanent status is not stated in the notice.`,
      status,
      statusNote: "Original career row and exact 12-page advertisement retained. First connector output, form identity and any later amendments need founder review.",
      applicationWindow: { opensOn: notice.opensOn, closesOn: notice.closesOn,
        cutoffLocalTime: notice.cutoffLocalTime, cutoffInclusive: true,
        officialTimeZone: null, precision: "second",
        note: `Advertisement page 1: online applications ${notice.opensOn} through ${notice.closesOn} at ${notice.cutoffLocalTime}. No governing timezone is named. Page 12 separately requires signed printout and self-attested documents by ${notice.hardCopyClosesOn}; that later receipt date does not reopen online applications.` },
      qualifications: `Recognized B.E./B.Tech. in CS/IT, M.Sc. in CS/IT, or MCA with at least 55% or equivalent grade, plus at least ${post.experienceYears} years of post-qualification work in ${post.specialty}. Exact specialty duties, desirable certificates and document proof vary by post in advertisement pages 1–9. Qualification result must be declared by online closing date.`,
      citizenshipRule: "Indian citizens may apply. Subjects of Nepal or Bhutan, qualifying pre-1962 Tibetan refugees, and specified Indian-origin migrants may follow narrow routes only with a Government of India eligibility certificate. A person needing that certificate may sit examination before it is issued, but cannot receive an appointment offer until issue. Nationality alone does not establish a refugee or migration route.",
      residenceRule: "No state domicile is specified in the advertisement. Posting may be at IGNOU headquarters or any regional centre; New Delhi is the hard-copy receipt address, not a residence rule.",
      languageNote: "Advertisement page 12 says any recruitment test may be in English only or English and Hindi; English version controls differences. It gives no formal proficiency level or language certificate for these posts.",
      selectionStages: ["Separate online application for each chosen post and online fee", `Signed printout and self-attested documents must reach IGNOU by ${notice.hardCopyClosesOn}`, "Shortlisting against post-specific education and experience", "Possible written/CBT, skill test and/or interview; syllabus and centres to be announced if a test is held", "Original-document and eligibility-certificate verification before appointment"],
      fee: "Online: ₹1,000 for UR/OBC(NCL)/EWS; ₹500 for SC/ST/PwBD/ex-servicemen/women, plus applicable bank charges. Fee is non-refundable. Reservation and fee eligibility need individual review.",
      salary: `7th CPC pay Level ${level}; advertisement also prints pre-revised ₹${level === 8 ? "9,300–34,800" : "15,600–39,100"} scale.`,
      rules: { complete: false, asOn: notice.closesOn,
        nationality: { allowed: ["IN"], conditional: ["NP", "BT"],
          conditionalReason: "Nepal or Bhutan subjects have a conditional route. Government of India eligibility certificate is required before appointment offer; confirm personal status and document timing with IGNOU.",
          uncertain: ["CN", "PK", "MM", "LK", "KE", "UG", "TZ", "ZM", "MW", "CD", "ET", "VN"],
          uncertainReason: "The notice permits only specified pre-1962 Tibetan refugees or Indian-origin migrants from listed countries, with a Government of India eligibility certificate. Nationality alone cannot establish this route; ask IGNOU to verify your circumstances.",
          evidence: citizenshipEvidence },
        education: { minLevel: "bachelor", fields: ["Computer Science", "Information Technology", "Computer Applications"],
          finalYearAllowed: false, evidence: `IGNOU advertisement ${notice.advertisement}, post ${post.number} and instruction 5: listed CS/IT degree or MCA, 55% and declared result by online close.` },
        experience: { minYears: post.experienceYears, evidence: `IGNOU advertisement ${notice.advertisement}, post ${post.number}: ${post.experienceYears} post-qualification years in the named specialty; instruction 13.` },
        manualChecks: [
          { stage: "apply", text: `Confirm post ${post.number} specialty, ${post.ageMax}-year ordinary upper age limit or documented relaxation, recognized education/55% and ${post.experienceYears} qualifying years. Confirm any conditional nationality route and certificate with IGNOU. Online form and signed hard copy have separate deadlines.` },
          { stage: "selection", text: "Verify original documents and any written/CBT, skill-test or interview requirements. Exam paper language and centres are not fixed yet; no standardized language level is published." },
          { stage: "outcome", text: "Confirm selection, posting and service conditions. Any required Government of India eligibility certificate must be issued before appointment offer." },
        ],
      },
      venues: [{ kind: "unknown", name: "Test centre not published; nationwide posting possibility is not an exam venue" }],
      sources, applicationMethod: "online", applicationUrl: null,
    });
  });
  return { cycles, evidence: [index.evidence, document.evidence], complete: false, warnings: [
    "Twelve separate post choices cover fourteen vacancies; vacancies do not multiply application-cycle counts.",
    "Online close is 2 November 23:59:59 without a named official timezone; 12 November is a separate hard-copy receipt deadline.",
    "Nepal/Bhutan and refugee/migrant routes need an issued Government of India eligibility certificate; candidate nationality alone cannot prove migration or refugee status.",
    "No formal Hindi/English proficiency level is published. Possible test-paper language is not a proficiency requirement.",
    "This exact-document connector does not cover IGNOU teaching, deputation or other career rows. Founder review and later-correction checks remain required.",
  ] };
};
