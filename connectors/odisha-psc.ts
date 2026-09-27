/** Odisha PSC APP advertisement 09/2026-27: scanned official bundle, draft only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn, clockIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { cityVenue, decodeEntities, evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  advertisement: string; homepage: string; pdfSha256: string; post: string; vacancies: number;
  opensOn: string; closesOn: string; cutoffLocalTime: string; preliminaryExamDate: string;
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/opsc-app-09-2026.json", import.meta.url), "utf8")) as Extraction;
export const ODISHA_HOME = extraction.homepage;
const NOTICE = "Assistant Public Prosecutor (Advt. No. 09 of 2026-27) - 2nd Corrigendum notice to Advertisement for Recruitment to the Posts";

/** Web Forms sends transient hidden state back to the same public page. Never log it. */
export function parseOdishaPostback(html: string): URLSearchParams {
  const rows = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((match) => match[1]);
  const selected = rows.filter((row) => stripTags(row).includes(NOTICE));
  const related = rows.filter((row) => /Assistant Public Prosecutor/i.test(stripTags(row)) && /09\s+of\s+2026-27/i.test(stripTags(row)));
  if (related.length !== 1) throw new Error("Odisha APP may have another notice or amendment; review required");
  if (selected.length !== 1 || !/22\s+Sep\s+-\s+2026/i.test(stripTags(selected[0]))) {
    throw new Error("Odisha APP second corrigendum missing, duplicated or date changed; review required");
  }
  const links = [...selected[0].matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .filter((match) => /View Pdf/i.test(stripTags(match[2])));
  if (links.length !== 1) throw new Error("Odisha APP PDF action missing or duplicated");
  const action = decodeEntities(links[0][1]);
  const target = /^javascript:__doPostBack\('([^']+)',''\)$/.exec(action)?.[1];
  if (!target || !/^ctl00\$generic_masterpage1\$ctl\d+$/.test(target)) throw new Error("Odisha APP PDF action changed");
  const fields = new URLSearchParams();
  for (const match of html.matchAll(/<input\b[^>]*type="hidden"[^>]*>/gi)) {
    const name = /\bname="([^"]+)"/i.exec(match[0])?.[1];
    const value = /\bvalue="([^"]*)"/i.exec(match[0])?.[1];
    if (name && value !== undefined && /^__(?:VIEWSTATE(?:GENERATOR|ENCRYPTED|FIELDCOUNT|\d+)?|EVENTVALIDATION|LASTFOCUS)$/.test(name)) fields.set(name, decodeEntities(value));
  }
  if (!fields.get("__VIEWSTATE") || !fields.get("__VIEWSTATEGENERATOR")) throw new Error("Odisha form state missing");
  fields.set("__EVENTTARGET", target);
  fields.set("__EVENTARGUMENT", "");
  return fields;
}

export const odishaPsc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("Odisha scanned PDF evidence fetch required");
  const homepage = await fetchText(ODISHA_HOME, { accept: "text/html" });
  if (homepage.evidence.url !== ODISHA_HOME) throw new Error("Odisha homepage redirected; review required");
  const form = parseOdishaPostback(homepage.text);
  const pdf = await fetchBytes(ODISHA_HOME, {
    method: "POST", body: form.toString(), accept: "application/pdf",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: ODISHA_HOME },
  });
  const hash = createHash("sha256").update(pdf.bytes).digest("hex");
  if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || hash !== extraction.pdfSha256 || pdf.evidence.sha256 !== hash || pdf.evidence.url !== ODISHA_HOME) {
    throw new Error("Odisha APP official PDF bytes changed; old eligibility and dates withheld");
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const closed = today > extraction.closesOn || (today === extraction.closesOn && clockIn("Asia/Kolkata", now) >= extraction.cutoffLocalTime);
  const pdfSource = evidenceSource(source, pdf.evidence, "Advertisement 09/2026-27 with first and second corrigenda (official View Pdf action)", "scanned PDF", "English");
  pdfSource.itemSha256 = hash;
  const cycle = makeCycle({
    id: "odisha-psc-2026-09-assistant-public-prosecutor", sourceId: source.id,
    title: extraction.post, cycleLabel: `Advertisement ${extraction.advertisement}`,
    authority: source.authority, pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-OR"],
    scopeLabel: "Odisha State Prosecution Service recruitment; examination city Kataka (Cuttack)",
    outcome: `${extraction.vacancies} Assistant Public Prosecutor posts (Group B); category reservations require individual review`,
    status: closed ? "closed" : today < extraction.opensOn ? "upcoming" : "uncertain",
    statusNote: "Scanned notice and two corrigenda transcribed for founder review; official PDF response is bound to exact bytes.",
    applicationWindow: { opensOn: extraction.opensOn, closesOn: extraction.closesOn, cutoffLocalTime: extraction.cutoffLocalTime, officialTimeZone: "Asia/Kolkata", precision: "minute", note: "Advertisement pages 3 and 5 state 28 August–28 September 2026, 5:00 PM. Timezone not printed; Asia/Kolkata is Odisha local-time interpretation." },
    qualifications: "Bachelor's Degree in Law from a recognised university and at least two years as a practising advocate. District & Sessions Judge experience certificate and Bar Council enrolment certificate required. First corrigendum allows registration with a Bar Council outside Odisha (bundle pages 2 and 8).",
    citizenshipRule: "Candidate must be a citizen of India (long advertisement §10(a), bundle page 11). Foreign citizens do not match this published criterion.",
    residenceRule: "No general Odisha domicile condition identified in the extracted advertisement. Category and reservation certificates require individual review.",
    selectionStages: ["Preliminary examination rescheduled to 22 November 2026 by second corrigendum; examination time pending.", "Main written examination, including General English and English–Odia translation.", "Interview."],
    fee: "₹700 except SC, ST and persons with disabilities; fee refunded only to candidates who appear in preliminary examination (long advertisement page 8).",
    salary: "Initial basic pay ₹44,900, Level 10 (advertisement page 3).",
    rules: { complete: false, asOn: "2026-01-01",
      nationality: { allowed: ["IN"], evidence: "Advertisement 09/2026-27, §10(a), bundle page 11: candidate must be a citizen of India." },
      languages: [
        { language: "or", stage: "apply", requirement: "Speak, read and write Odia; pass Board of Secondary Education Odisha Middle School standard Odia language test or Matriculation/Class X with Odia as a subject. No CEFR level stated.", evidence: "Advertisement 09/2026-27, §5, bundle page 8.", sourceUrl: ODISHA_HOME },
        { language: "en", stage: "selection", requirement: "Main written General English paper at Degree Course standard; papers answered in English except translation into Odia. No CEFR level stated.", evidence: "Advertisement 09/2026-27, main examination syllabus, bundle pages 18–19.", sourceUrl: ODISHA_HOME },
      ],
      manualChecks: [
        { stage: "apply", text: "Verify age 21–42 as of 1 January 2026, category relaxations, and qualifications at application close (advertisement pages 3 and 7–8)." },
        { stage: "apply", text: "Verify two years of practice, Judge's experience certificate and Bar Council enrolment. First corrigendum permits non-Odisha Bar Council registration in Annexure B." },
        { stage: "apply", text: "Verify Odia proof through prescribed Middle School test or Class X Odia subject; claimed language skill alone does not satisfy published proof route." },
      ],
    },
    venues: [cityVenue("Preliminary and main examinations in Kataka; exact venue later", "Cuttack", "IN", "IN-OR")],
    examEvents: [{ label: "Preliminary examination (rescheduled)", date: extraction.preliminaryExamDate, verified: false, sourceUrl: ODISHA_HOME, citation: { sourceId: pdfSource.id, url: ODISHA_HOME, documentSha256: hash, page: 1 } }],
    sources: [evidenceSource(source, homepage.evidence, "OPSC current notices and View Pdf action", "HTML", "English"), pdfSource],
    applicationUrl: "https://opscechayan.in/",
    changes: [{ at: "2026-09-22", kind: "updated", summary: "Second corrigendum moves preliminary examination from 1 November to 22 November 2026; founder review pending." }],
  });
  return { cycles: [cycle], evidence: [homepage.evidence, pdf.evidence], complete: false, warnings: [
    "One APP application cycle only; bundled short, long and repeated advertisements do not create separate opportunities. Other OPSC notices and Odisha authorities remain coverage gaps.",
    "Official PDF has no stable direct URL; its exact bytes were fetched through public homepage View Pdf action. Public source link opens that homepage.",
    "Scanned-page transcription, category rules, age relaxations, Odia proof, Bar Council corrigendum and exam schedule require founder review before publication.",
  ] };
};
