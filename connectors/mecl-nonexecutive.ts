/** MECL's 16 post-code applications in one exact 2026 non-executive notice. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { EducationLevel, LanguageRequirement } from "../lib/eligibility/types.ts";
import type { Connector, Evidence } from "./types.ts";
import { cityVenue, evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Post { code: number; title: string; grade: "W-3" | "W-4" | "W-7"; vacancies: number; minEducation: EducationLevel; page: number; qualifications: string }
interface Extraction {
  indexUrl: string; advertisementUrl: string; advertisementSha256: string;
  instructionsUrl: string; instructionsSha256: string; applicationUrl: string;
  noticeNumber: string; opensOn: string; closesOn: string; asOn: string; officialTimeZone: string;
  posts: Post[];
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/mecl-nonexecutive-03-2026.json", import.meta.url), "utf8")) as Extraction;

/** New 03/2026 amendment or a changed application route blocks stale critical fields. */
export function verifyMeclIndex(html: string): void {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => ({ html: match[1], title: stripTags(match[1]).replace(/\s+/g, " ") }))
    .filter(({ title }) => /\b03\s*\/\s*Rectt\.?\s*\/\s*2026\b/i.test(title));
  if (rows.length !== 2) throw new Error("MECL 03/2026 notice set changed; manual amendment review required");
  const expected = [
    { title: /Important Instructions.*Online Examination.*03\/Rectt\.\/2026/i, url: notice.instructionsUrl },
    { title: /Detailed Advertisement.*03\/Rectt\.\/2026.*Non Executives/i, url: notice.advertisementUrl },
  ];
  for (const item of expected) {
    const matches = rows.filter((row) => item.title.test(row.title) && [...row.html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)]
      .some((link) => new URL(link[1], notice.indexUrl).href === item.url));
    if (matches.length !== 1) throw new Error("MECL 03/2026 original document link or title changed; manual review required");
  }
  const clean = html.replace(/<!--[\s\S]*?-->/g, "");
  const applicationLinks = [...clean.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .filter((match) => /register\/apply for Advertisement No\. 03\/Rectt\.\/2026/i.test(stripTags(match[2])))
    .map((match) => new URL(match[1], notice.indexUrl).href);
  if (applicationLinks.length !== 1 || applicationLinks[0] !== notice.applicationUrl) {
    throw new Error("MECL 03/2026 official application link changed; manual review required");
  }
}

function verifyPdf(bytes: Buffer, evidence: Evidence, url: string, expectedHash: string): void {
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (bytes.subarray(0, 5).toString() !== "%PDF-" || evidence.url !== url ||
      evidence.sha256 !== hash || hash !== expectedHash) {
    throw new Error("MECL 03/2026 PDF changed; extracted applicant terms withheld");
  }
}

const salaries = {
  "W-3": "₹19,600–₹47,900",
  "W-4": "₹20,200–₹49,300",
  "W-7": "₹22,900–₹55,900",
};
const englishDeclaration: LanguageRequirement = {
  language: "en", stage: "apply",
  requirement: "Exam instructions require the application declaration in the candidate's handwriting and in English only; a typed declaration is allowed for the specified visually impaired candidates. No formal English proficiency level or certificate is stated.",
  evidence: "MECL 03/Rectt./2026 online-exam instructions, page 5, before applying, clause (v).",
  sourceUrl: notice.instructionsUrl,
};

export const meclNonexecutive: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("MECL original and exam-instruction PDF bytes required");
  const index = await fetchText(notice.indexUrl, { accept: "text/html" });
  if (index.evidence.url !== notice.indexUrl) throw new Error("MECL official Careers page redirected; manual review required");
  verifyMeclIndex(index.text);
  const original = await fetchBytes(notice.advertisementUrl, { accept: "application/pdf" });
  const instructions = await fetchBytes(notice.instructionsUrl, { accept: "application/pdf" });
  verifyPdf(original.bytes, original.evidence, notice.advertisementUrl, notice.advertisementSha256);
  verifyPdf(instructions.bytes, instructions.evidence, notice.instructionsUrl, notice.instructionsSha256);
  const codes = notice.posts.map((post) => post.code);
  if (codes.length !== 16 || new Set(codes).size !== 16 || codes.some((code, index) => code !== index + 1) ||
      notice.posts.reduce((sum, post) => sum + post.vacancies, 0) !== 122) {
    throw new Error("MECL 03/2026 post-code extraction needs review");
  }
  const today = civilDateIn(notice.officialTimeZone, now);
  const status = today < notice.opensOn ? "upcoming" as const : today > notice.closesOn ? "closed" as const : "open" as const;
  const venue = cityVenue("MECL written, skill and trade tests (exact centre on call letter)", "Nagpur", "IN", "IN-MH");
  const sources = [
    evidenceSource(source, index.evidence, "MECL official Careers notice and application register", "HTML", "English"),
    evidenceSource(source, original.evidence, "MECL detailed advertisement 03/Rectt./2026, 18 pages", "PDF", "English"),
    evidenceSource(source, instructions.evidence, "MECL 03/2026 online-examination and application instructions, 10 pages", "PDF", "English"),
  ];
  const cycles = notice.posts.map((post) => {
    const languages: LanguageRequirement[] = [{ ...englishDeclaration }];
    if (post.code === 7) languages.push({
      language: "en", stage: "apply",
      requirement: "English shorthand certificate at 80 words per minute is essential for Stenographer (English). This is a shorthand speed, not a CEFR level.",
      evidence: "MECL advertisement 03/Rectt./2026, Table I, post code 7, page 3.", sourceUrl: notice.advertisementUrl,
    });
    if (post.code === 8) languages.push({
      language: "hi", stage: "apply",
      requirement: "Degree with Hindi and English as subjects, or English degree plus equivalent Advanced Hindi examination, required for Assistant (Hindi). No standardized speaking level is stated.",
      evidence: "MECL advertisement 03/Rectt./2026, Table I, post code 8, page 3.", sourceUrl: notice.advertisementUrl,
    });
    return makeCycle({
      id: `mecl-03-2026-post-${String(post.code).padStart(2, "0")}`,
      sourceId: source.id, title: `${post.title} — MECL 2026`,
      cycleLabel: `MECL advertisement ${notice.noticeNumber}, post code ${post.code}`,
      programme: `MECL non-executive ${post.title} recruitment`,
      authority: source.authority, pathway: "recruitment",
      jurisdictionCode: "IN", jurisdictionName: "India",
      scopeLabel: `One post-code application under a 16-code central public-sector recruitment. MECL may assign staff across India; Nagpur is the published test city, not a domicile rule.`,
      outcome: `${post.vacancies} provisional ${post.title} ${post.grade} posts, including any fresh/backlog and category reservations stated in Table I; applicants must verify their post-code category allocation.`,
      status,
      statusNote: "Official Careers index and two exact PDFs checked. Recruitment and language details remain pending founder review; later 03/2026 amendments require a new extraction.",
      applicationWindow: { opensOn: notice.opensOn, closesOn: notice.closesOn, cutoffLocalTime: null,
        officialTimeZone: notice.officialTimeZone, precision: "date",
        note: "Detailed advertisement §10.2 and Important Dates page 18: online registration 12 September–11 October 2026. No closing hour is printed. Eligibility age/qualification cut-off is separately 1 September 2026." },
      qualifications: `${post.qualifications} Original advertisement Table I, printed page ${post.page}. Essential education normally needs Indian recognition; at least 45% marks applies to essential qualifications where stated. Higher education alone does not replace a required trade qualification.`,
      citizenshipRule: "Detailed MECL advertisement §8(i), page 13: only Indian nationals are eligible to apply. Foreign citizens do not meet this published application criterion; overseas residence alone is not the test.",
      residenceRule: "No applicant state domicile is stated. Aadhaar ID proof is listed among required uploads (page 17); identity-document suitability needs individual verification. MECL work assignments may be anywhere in India.",
      selectionStages: ["Online post-code registration and applicable fee", "Eligibility screening", "Written competitive examination in Nagpur", "Original document verification", "Qualifying skill/trade test in Nagpur, as applicable", "Medical and appointment checks where specified"],
      fee: "₹500 for General/OBC/EWS. SC, ST, PwD, ex-servicemen and departmental applicants are exempt under §8(xix). Online payment portal only.",
      salary: `${salaries[post.grade]} IDA basic scale (${post.grade}), plus applicable benefits; original Table I.`,
      rules: { complete: false, asOn: notice.asOn,
        age: { max: 30, relaxations: [{ category: "sc", years: 5 }, { category: "st", years: 5 }, { category: "obc", years: 3 }, { disability: true, years: 10 }],
          evidence: "Advertisement §1 and §3, pages 9–10: age max 30 for UR/EWS as on 1 September 2026; SC/ST +5, OBC-NCL +3, PwD +10 or combined +13/+15. Ex-serviceman and other routes require review." },
        nationality: { allowed: ["IN"], evidence: "Advertisement §8(i), page 13: only Indian nationals are eligible to apply." },
        education: { minLevel: post.minEducation, evidence: `Advertisement Table I, post code ${post.code}, printed page ${post.page}; exact discipline, certificate, mark and recognition rules require document review.` },
        languages,
        manualChecks: [
          { stage: "apply", text: `Verify post code ${post.code} essential credentials, marks, any experience/licence, eligible reservation/backlog category, Aadhaar upload, and specific age-relaxation documents.` },
          { stage: "selection", text: "Confirm exam call letter and exact Nagpur centre, written-test cut-off, and post-specific skill/trade test. English declaration and role-specific language credentials are not CEFR equivalents." },
          { stage: "outcome", text: "Confirm original qualifications, category/experience proof, any post-specific medical standards and MECL appointment checks." },
        ],
      },
      venues: [venue], sources, applicationUrl: notice.applicationUrl,
    });
  });
  return { cycles, evidence: [index.evidence, original.evidence, instructions.evidence], complete: false, warnings: [
    "Advertisement 03/2026 has 16 post codes and 122 provisional vacancies. Other MECL advertisements, result notices and any later 03/2026 corrections are separate coverage or review items.",
    "Only Indian nationals are permitted to apply. No general English CEFR level is printed; English declaration, shorthand speed and Hindi education requirements are separate conditions.",
    "Application deadline has date precision only; do not invent 23:59 or use 1 September eligibility cut-off as application close.",
    "Some positions are entirely category/backlog/ex-serviceman reserved. Category eligibility and medical/experience alternatives require founder review for each code.",
    "Advertisement §10.11 uses ambiguous wording about applying for more than one post. Portal form identity and one-post limit need founder confirmation.",
    "MECL robots.txt states Crawl-delay: 10; collector spaces requests to mecl.co.in by at least ten seconds.",
  ] };
};
