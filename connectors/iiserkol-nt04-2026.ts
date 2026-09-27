/** Seven separately applied IISER Kolkata posts from one exact notice; draft only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector, Evidence } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  indexUrl: string; englishUrl: string; englishSha256: string; hindiUrl: string; hindiSha256: string;
  applicationUrl: string; advertisement: string; opensOn: string; closesOn: string; cutoffLocalTime: string;
  hardCopyDueOn: string; hardCopyCutoffLocalTime: string;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/iiserkol-nt04-2026.json", import.meta.url), "utf8")) as Extraction;

const posts = [
  { id: "senior-superintendent", title: "Senior Superintendent", vacancies: 1, group: "B", pay: 7, age: 38,
    qualifications: "Master's degree in any discipline with at least 50% marks or equivalent grade; at least five years at Pay Level 6 or above as Junior Superintendent or equivalent in specified administration, finance, academic, legal, audit, stores or establishment work at an eligible public or higher-education institution." },
  { id: "counsellor", title: "Counsellor", vacancies: 1, group: "B", pay: 7, age: 40,
    qualifications: "Master's degree with 50% in Clinical/Counselling Psychology or Medical & Psychiatric Social Work; five years counselling students on academic, psychosocial and emotional issues at a reputed academic institute or organization." },
  { id: "junior-engineer-civil", title: "Junior Engineer (Civil)", vacancies: 1, group: "B", pay: 6, age: 35,
    qualifications: "First-class Civil Engineering bachelor's degree plus five years field experience in civil construction or maintenance, or first-class Civil Engineering diploma plus eight years; relevant CPWD/PWD/Government-norm experience preferred. One OBC vacancy." },
  { id: "nursing-assistant", title: "Nursing Assistant", vacancies: 1, group: "C", pay: 5, age: 33,
    qualifications: "Four-year B.Sc. Nursing; Indian or State Nursing Council registration; five years clinical experience in a hospital of at least 50 beds, including eligible public or recognized private facilities." },
  { id: "junior-office-assistant-ms", title: "Jr. Office Assistant (MS)", vacancies: 2, group: "C", pay: 4, age: 33,
    qualifications: "Bachelor's degree in any discipline with 50%; excellent Word, Excel and PowerPoint proficiency; four years relevant office experience." },
  { id: "junior-assistant-ms", title: "Jr. Assistant (MS)", vacancies: 10, group: "C", pay: 3, age: 30,
    qualifications: "Bachelor's degree in any discipline with 50%; excellent office-application proficiency; three years relevant office-practice, hospitality or catering experience. Four unreserved, two OBC, three SC and one EWS vacancies; one ex-serviceman and one PwBD reservation are noted in the advertisement." },
  { id: "attendant", title: "Attendant", vacancies: 1, group: "C", pay: 1, age: 32,
    qualifications: "Matriculation or three-year diploma in a relevant field; three years relevant experience handling scientific, laboratory, research, IT, classroom or catering equipment at an establishment of national or international repute." },
] as const;

/** Fail closed when date, links or notice set changes. Portal's heading has a typo (IIISER); PDF has IISER. */
export function verifyIiserkolNt04Index(html: string): void {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  const matches = rows.filter((row) => /NT-04\/2026/i.test(stripTags(row)));
  if (matches.length !== 1 || (html.match(/NT-04\/2026/gi)?.length ?? 0) !== 1) {
    throw new Error("IISER Kolkata NT-04 notice set changed; review required");
  }
  const row = matches[0];
  const text = stripTags(row).replace(/\s+/g, " ");
  if (!/19\.09\.2026/.test(text) || !/19\.10\.2026,?\s*5\.30\s*pm/i.test(text) ||
      !row.includes(`href="docs/09_2026/Advt-NT-04-2026_19.09.2026.pdf"`) ||
      !row.includes(`href="docs/09_2026/Advt-NT-04-2026_19.09.2026_hindi.pdf"`) ||
      !/Recruitment Notice for Non-Teaching Position/i.test(text) || /corrigendum|addendum|extension|revised/i.test(text)) {
    throw new Error("IISER Kolkata NT-04 dated row or deadline changed; review required");
  }
}

export const iiserkolNt04: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("IISER Kolkata original PDF bytes required");
  const index = await fetchText(notice.indexUrl, { accept: "text/html" });
  if (index.evidence.url !== notice.indexUrl) throw new Error("IISER Kolkata jobs index redirected; review required");
  verifyIiserkolNt04Index(index.text);
  const documents = new Map<string, Evidence>();
  for (const [language, url, expected] of [["English", notice.englishUrl, notice.englishSha256], ["Hindi", notice.hindiUrl, notice.hindiSha256]] as const) {
    const pdf = await fetchBytes(url, { accept: "application/pdf" });
    const hash = createHash("sha256").update(pdf.bytes).digest("hex");
    if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== url || pdf.evidence.sha256 !== hash || hash !== expected) {
      throw new Error(`IISER Kolkata NT-04 ${language} PDF changed; extracted fields withheld`);
    }
    documents.set(language, pdf.evidence);
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today < notice.opensOn ? "upcoming" as const : today > notice.closesOn ? "closed" as const : "open" as const;
  const sources = [
    evidenceSource(source, index.evidence, "IISER Kolkata current openings, NT-04/2026 row", "HTML", "English"),
    evidenceSource(source, documents.get("English")!, "NT-04/2026 original recruitment notice", "PDF", "English"),
    evidenceSource(source, documents.get("Hindi")!, "NT-04/2026 original translated notice", "PDF", "Hindi"),
  ];
  const cycles = posts.map((post) => makeCycle({
    id: `iiserkol-nt04-2026-${post.id}`, sourceId: source.id,
    title: `${post.title} — IISER Kolkata`, programme: "IISER Kolkata non-teaching direct recruitment 2026",
    cycleLabel: `${notice.advertisement} · ${post.title}`, authority: source.authority,
    pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-WB"],
    scopeLabel: `One separately applied regular Group ${post.group} post type at IISER Kolkata, Mohanpur, West Bengal; job location is not an applicant domicile or test venue.`,
    outcome: `${post.vacancies} regular salaried ${post.title} ${post.vacancies === 1 ? "vacancy" : "vacancies"}; 7th CPC Pay Level ${post.pay}; one-year probation, subject to appointment.`,
    status,
    statusNote: "Official English and Hindi notices and current openings row retained. Founder review pending. Age/qualification reckoning date conflicts within English notice; applicants must seek authority clarification.",
    applicationWindow: { opensOn: notice.opensOn, closesOn: notice.closesOn, cutoffLocalTime: notice.cutoffLocalTime,
      officialTimeZone: null, precision: "minute", note: `Notice page 1 and page 11: online form opens 19 September and closes 19 October 2026 at 17:30. Required printed application and documents must then arrive by ${notice.hardCopyDueOn} at ${notice.hardCopyCutoffLocalTime}. Governing cutoff timezone is not printed; hard-copy deadline is a second required step, not a new online application window.` },
    qualifications: `${post.qualifications} Published upper age limit: ${post.age}, with applicable category relaxations. Age and qualification reckoning date conflicts: page 1 says 19 September; instruction 35 says online closing date (19 October). Do not calculate age automatically pending clarification.`,
    citizenshipRule: "Notice page 1 invites eligible Indian nationals; General Service Condition 3 says candidates must be citizens of India. Foreign citizens do not meet published application criterion. OCI status alone is not stated as an exception.",
    residenceRule: "No applicant residence or West Bengal domicile requirement is printed. Mohanpur is job and hard-copy destination, not an eligibility residence rule.",
    languageNote: "English and Hindi notices are available; English version prevails if translations conflict. Notice states no mandatory language proficiency level, language certificate or test medium. Publication language is not a candidate requirement.",
    selectionStages: ["Separate online application and fee for this post", "Send hard copy and self-attested documents to IISER Kolkata by 29 October 2026 at 17:30", "Scrutiny and shortlisting", "Possible qualifying computer skill or trade test", "100-mark written test (50 general, 50 specialization)", "Document and appointment checks"],
    fee: "₹500 total (₹450 application + ₹50 registration). SC/ST/PwBD/women/ex-servicemen/transgender categories pay ₹50 registration only, subject to notice conditions; each post needs a separate fee.",
    salary: `7th CPC Pay Level ${post.pay} plus admissible allowances; exact rupee salary not stated in notice.`,
    rules: { complete: false, asOn: null,
      nationality: { allowed: ["IN"], evidence: "NT-04/2026 English PDF page 1: eligible Indian nationals; page 4 General Service Condition 3: candidates must be citizens of India." },
      manualChecks: [
        { stage: "apply", text: `Confirm post-specific qualification/experience, reservation, fee and upper age ${post.age}. Notice conflicts on age/qualification reckoning date (19 September vs online close 19 October); obtain authority clarification. Foreign citizens fail explicit Indian-citizen criterion.` },
        { stage: "selection", text: "Confirm document screening, qualifying skill/trade test if held, written test and any post-specific syllabus. Test venue and language medium are not yet published." },
        { stage: "outcome", text: "Confirm document authenticity, medical fitness, appointment decision, one-year probation and service rules. No appointment is guaranteed by passing selection stages." },
      ],
    },
    venues: [{ kind: "unknown", name: "Written/skill test venue not published; Mohanpur is job and postal address" }],
    sources, applicationMethod: "online", applicationUrl: notice.applicationUrl,
  }));
  return { cycles, evidence: [index.evidence, ...documents.values()], complete: false, warnings: [
    "Seven post types require separate applications; 17 vacancies are not 17 application cycles.",
    "Page 1 sets age/qualification/experience crucial date at 19 September 2026, but instruction 35 sets it at online closing date 19 October 2026. Founder must resolve before approving critical eligibility fields.",
    "Online deadline and mandatory hard-copy receipt deadline are distinct; neither prints a governing cutoff timezone.",
    "Indian citizenship is explicit. No formal language proficiency level or test medium is published.",
    "Other IISER Kolkata non-teaching advertisements and later corrigenda remain coverage gaps.",
  ] };
};
