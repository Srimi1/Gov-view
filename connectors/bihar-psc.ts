/** BPSC TRE 4.0 advertisement 15/2026: official-search, exact-document draft. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector, Evidence } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Document { key: string; url: string; sha256: string }
interface Extraction {
  cycleId: string; homepage: string; feedUrl: string; feedForm: Record<string, string>;
  expectedSearchRows: number; expectedNoticeDate: string; expectedNoticeNumber: string;
  expectedAttachmentCount: number; attachmentSetSha256: string; applicationUrl: string;
  opensOn: string; closesOn: string; feeClosesOn: string; vacancies: number; documents: Document[];
}
interface FeedPost { fields?: Record<string, string> }
interface Feed { success?: boolean; data?: { total_records?: number; total_pages?: number; posts?: FeedPost[] } }
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/bpsc-tre4-15-2026.json", import.meta.url), "utf8")) as Extraction;
export const BPSC_HOME = extraction.homepage;
export const BPSC_FEED = extraction.feedUrl;
export const BPSC_FORM = new URLSearchParams(extraction.feedForm).toString();

export function checkBiharFeed(text: string): void {
  let feed: Feed;
  try { feed = JSON.parse(text) as Feed; } catch { throw new Error("BPSC TRE 4.0 search is not JSON; review required"); }
  if (feed.success !== true || feed.data?.total_records !== extraction.expectedSearchRows || feed.data.total_pages !== 1 || feed.data.posts?.length !== extraction.expectedSearchRows) {
    throw new Error("BPSC TRE 4.0 search rows changed; review required");
  }
  const [latest, ...older] = feed.data.posts;
  const fields = latest.fields;
  if (fields?.home_date !== extraction.expectedNoticeDate || fields.home_advertisement_no?.replace(/[^0-9/]/g, "") !== extraction.expectedNoticeNumber ||
      !/School Teacher.*Education Department.*TRE 4\.0/i.test(stripTags(fields.home_subject_details ?? "")) ||
      older.some((post) => (post.fields?.home_advertisement_no ?? "").includes(extraction.expectedNoticeNumber))) {
    throw new Error("BPSC 15/2026 notice identity changed; review required");
  }
  const links = [...new Set([...((fields.home_view_download ?? "").matchAll(/href=["'](https:\/\/bpsc\.bihar\.gov\.in\/[^"']+\.pdf)["']/gi))].map((match) => match[1]))].sort();
  const hash = createHash("sha256").update(JSON.stringify(links)).digest("hex");
  if (links.length !== extraction.expectedAttachmentCount || hash !== extraction.attachmentSetSha256 || extraction.documents.some((document) => !links.includes(document.url))) {
    throw new Error("BPSC 15/2026 attachment set changed; review required");
  }
}

export const biharPsc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("BPSC original PDF byte fetch required");
  const homepage = await fetchText(BPSC_HOME, { accept: "text/html" });
  if (homepage.evidence.url !== BPSC_HOME || !/fetch_category_data/.test(homepage.text) || !/bpsc-table/.test(homepage.text)) {
    throw new Error("BPSC official search page changed; review required");
  }
  const feed = await fetchText(BPSC_FEED, { method: "POST", body: BPSC_FORM,
    headers: { "Content-Type": "application/x-www-form-urlencoded" }, accept: "application/json" });
  if (feed.evidence.url !== BPSC_FEED) throw new Error("BPSC official search redirected; review required");
  checkBiharFeed(feed.text);
  const documents = new Map<string, Evidence>();
  for (const document of extraction.documents) {
    const pdf = await fetchBytes(document.url, { accept: "application/pdf" });
    const hash = createHash("sha256").update(pdf.bytes).digest("hex");
    if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== document.url || pdf.evidence.sha256 !== hash || hash !== document.sha256) {
      throw new Error(`BPSC 15/2026 ${document.key} PDF changed; extracted fields withheld`);
    }
    documents.set(document.key, pdf.evidence);
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today < extraction.opensOn ? "upcoming" : today > extraction.closesOn ? "closed" : "open";
  const cycle = makeCycle({
    id: extraction.cycleId,
    sourceId: source.id,
    title: "Bihar school teacher recruitment 2026 (TRE 4.0)",
    cycleLabel: "BPSC advertisement 15/2026",
    programme: "Bihar Teacher Recruitment Examination 4.0",
    authority: source.authority,
    pathway: "recruitment",
    jurisdictionCode: "IN",
    jurisdictionName: "India",
    subdivisionCodes: ["IN-BR"],
    scopeLabel: "Bihar education department; 32,388 posts across school levels and subjects in one replacement advertisement",
    outcome: "Selection for Bihar government school teacher appointments, class 1–12 and specialist subjects; 32,388 advertised vacancies total",
    status,
    statusNote: "Advertisement 15/2026 replaces 14/2026. Official PDF and important notice agree on 26 October 2026 online close; no cutoff clock printed. Founder review pending.",
    applicationWindow: {
      opensOn: extraction.opensOn,
      closesOn: extraction.closesOn,
      officialTimeZone: "Asia/Kolkata",
      cutoffLocalTime: null,
      precision: "date",
      note: "Original Hindi advertisement page 20 and important notice page 1: online application 25 September–26 October 2026. Fee payment ends 25 October. Neither document states a closing clock time; Asia/Kolkata is local interpretation.",
    },
    qualifications: "Class, subject and category determine degree, teacher training and STET/CTET conditions; original advertisement pages 7–15 and 20 require individual review. Subject names are not universal language levels.",
    citizenshipRule: "Advertisement page 1 invites eligible Indian candidates. It does not establish whether any foreign-national category may apply or obtain appointment; international applicant status needs official confirmation.",
    residenceRule: "Bihar residence/caste certificates govern specified reservation claims (advertisement page 17). State hiring scope alone does not prove a general domicile bar.",
    selectionStages: ["BPSC One Time Registration and online application", "Teacher eligibility or qualifying examinations as applicable", "Recruitment examination", "Document verification and appointment checks"],
    fee: "Payment window 25 September–25 October 2026; category-specific amount needs founder review against original notice.",
    rules: { complete: false, asOn: null, manualChecks: [
      { stage: "apply", text: "Confirm citizenship and any foreign-national route; page 1 invites eligible Indian candidates but does not settle foreign eligibility." },
      { stage: "apply", text: "Confirm chosen school level, subject, degree, teacher training, STET/CTET, age, fees and reservation certificates in original Hindi notice." },
      { stage: "apply", text: "Confirm whether class levels or subjects require separate application forms; one 15/2026 notice is provisionally one cycle." },
      { stage: "selection", text: "Confirm examination medium and any subject-specific Hindi, English, Sanskrit or Urdu proficiency rule; no common formal level was established." },
      { stage: "outcome", text: "Confirm nationality, teacher credential recognition, original documents and any claimed Bihar residence-based reservation before appointment." },
    ] },
    venues: [{ kind: "unknown", name: "Examination centres not verified; BPSC office address is not an exam venue" }],
    sources: [
      evidenceSource(source, homepage.evidence, "BPSC official homepage and advertisement search", "HTML", "English and Hindi"),
      ...extraction.documents.map((document) => evidenceSource(source, documents.get(document.key)!, `BPSC 15/2026 ${document.key}`, "PDF", "Hindi")),
    ],
    applicationUrl: extraction.applicationUrl,
  });
  return { cycles: [cycle], evidence: [homepage.evidence, feed.evidence, ...documents.values()], complete: false, warnings: [
    "Only BPSC TRE 4.0 advertisement 15/2026 is extracted; other advertisements, amendments and Bihar authorities remain coverage gaps.",
    "One replacement notice spans multiple school levels and subjects; founder must verify application-form grouping before publication.",
    "Indian applicants are invited, but foreign-national eligibility and any universal language level are not established; leave international and language assessments uncertain.",
    "Official PDFs render but their malformed streams prevent dependable text extraction. Original-language visual review is required before approval.",
    "Fee deadline 25 October does not change online application deadline 26 October; no cutoff clock is inferred.",
  ] };
};
