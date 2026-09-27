/** Manipur PSC advertisement 04/2026: exact scanned notice, draft only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

export const MANIPUR_INDEX = "https://mpscmanipur.gov.in/whats_new.html";
interface Extraction {
  advertisement: string; documentUrl: string; sha256: string; post: string; vacancies: number;
  opensOn: string; closesOn: string; cutoffLocalTime: string; eligibilityAsOn: string;
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/manipur-04-2026.json", import.meta.url), "utf8")) as Extraction;

export function parseManipurIndex(html: string) {
  const body = /<tbody\b[^>]*id="notificationTableBody"[^>]*>([\s\S]*?)<\/tbody>/i.exec(html)?.[1];
  if (!body) throw new Error("Manipur notice table changed");
  const rows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  const selected = rows.filter((row) => /Dental Surgeon|(?:Advt|Advertisement)\.?\s*(?:No\.?)?\s*04\s*\/\s*2026/i.test(stripTags(row)));
  if (selected.length !== 1) throw new Error("Manipur Dental Surgeon notice missing or amended; review required");
  const links = [...selected[0].matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ url: new URL(match[1], MANIPUR_INDEX), title: stripTags(match[2]).replace(/\s+/g, " ") }));
  for (const link of links) {
    if (link.url.origin !== "https://mpscmanipur.gov.in" || !/^\/files\/[^/]+\.pdf$/i.test(link.url.pathname) || link.url.search || link.url.hash) throw new Error("Manipur notice document outside official PDF archive");
  }
  const notices = links.filter((link) => /Notification for recruitment of 13 posts of Dental Surgeon/i.test(link.title));
  if (notices.length !== 1 || notices[0].url.href !== extraction.documentUrl) throw new Error("Manipur 04/2026 notice changed; review required");
  if (!/23-09-2026/.test(selected[0])) throw new Error("Manipur 04/2026 upload date changed; review required");
  return { notice: notices[0], syllabusUrl: links.find((link) => /^Syllabus$/i.test(link.title))?.url.href ?? null };
}

export const manipurPsc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("Manipur scanned PDF evidence fetch required");
  const index = await fetchText(MANIPUR_INDEX, { accept: "text/html" });
  const parsed = parseManipurIndex(index.text);
  const pdf = await fetchBytes(parsed.notice.url.href, { accept: "application/pdf" });
  const hash = createHash("sha256").update(pdf.bytes).digest("hex");
  if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || hash !== extraction.sha256 || pdf.evidence.sha256 !== hash || pdf.evidence.url !== extraction.documentUrl) throw new Error("Manipur 04/2026 PDF changed; old eligibility and dates withheld");
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today < extraction.opensOn ? "upcoming" : today > extraction.closesOn ? "closed" : "open";
  const cycle = makeCycle({
    id: "manipur-psc-2026-04-dental-surgeon", sourceId: source.id,
    title: extraction.post, cycleLabel: `Advertisement ${extraction.advertisement}`, authority: source.authority,
    pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-MN"],
    scopeLabel: "Manipur Health Service recruitment; applicant citizenship and residence rules are separate",
    outcome: `Dental Surgeon appointment (${extraction.vacancies} posts: 9 unreserved, 4 Scheduled Tribe)`,
    status, statusNote: "Draft transcription from scanned advertisement; founder verification pending.",
    applicationWindow: { opensOn: extraction.opensOn, closesOn: extraction.closesOn, cutoffLocalTime: extraction.cutoffLocalTime, officialTimeZone: "Asia/Kolkata", precision: "minute", note: "Advertisement 04/2026, page 2. Notice states 11:59 PM without printing a timezone; Asia/Kolkata is the local Manipur time interpretation. Apply through official eMPSC portal." },
    qualifications: "Recognised dental qualification under the First or Third Schedule of the Indian Dentist Act, 1948, and registration with a State Dental Council. Required documents must be held by 23 September 2026 (advertisement page 1).",
    citizenshipRule: "Candidate must be a citizen of India (advertisement page 1). Foreign citizens do not match this published criterion.",
    residenceRule: "Permanent Manipur residence required, with stated exception when parent or direct-line ancestor is a permanent resident of Manipur. Proper documentary proof required; domicile certificates alone are not accepted (advertisement page 1).",
    selectionStages: ["Written MCQ examination: 85 marks; two hours; wrong-answer penalty 0.33 mark.", "Interview/viva voce: 15 marks. Written-exam schedule and venue will be announced later."],
    fee: "₹600 General/OBC; ₹400 SC/ST; no fee for persons with disabilities (advertisement page 2).",
    salary: "Level 12 (₹53,100–₹167,800), advertisement page 1.",
    rules: { complete: false, asOn: extraction.eligibilityAsOn,
      nationality: { allowed: ["IN"], evidence: "Advertisement 04/2026, page 1, eligibility condition 3(i): candidate must be a citizen of India." },
      languages: [{ language: "mni", requirement: "Must be able to speak Manipuri (Meetei/Meitei Lon) or any tribal dialect of Manipur; no formal level stated.", stage: "apply", evidence: "Advertisement 04/2026, page 1, eligibility condition 3(ii).", sourceUrl: extraction.documentUrl }],
      manualChecks: [
        { stage: "apply", text: "Verify permanent residence or parent/direct-ancestor exception with accepted proof; domicile certificate alone is not accepted (page 1)." },
        { stage: "apply", text: "Verify age 21–38 on 23 September 2026 and applicable category, disability or service relaxation (page 1)." },
        { stage: "apply", text: "Verify recognised dental qualification, State Dental Council registration and certificates held by notice date (page 1)." },
      ],
    },
    venues: [{ kind: "unknown", name: "Written examination venue to be notified later (advertisement page 3)" }],
    sources: [
      { ...evidenceSource(source, index.evidence, "MPSC latest-notifications table", "HTML", "English"), lastValidatedAt: null },
      { ...evidenceSource(source, pdf.evidence, "Advertisement 04/2026: Dental Surgeon", "scanned PDF", "English"), lastValidatedAt: null },
    ],
    applicationUrl: "https://empsconline.gov.in/",
  });
  return { cycles: [cycle], evidence: [index.evidence, pdf.evidence], warnings: ["One document-bound Dental Surgeon draft only; other Manipur authorities and notices remain coverage gaps.", `Separate syllabus ${parsed.syllabusUrl ?? "link missing"} is retained for manual review; no language proficiency scale inferred.`, "Residence exception, age relaxations, dental registration and scanned transcription require founder review before publication."] };
};
