/** DSSSB advertisement 03/2026 pilot. Each post code is a separate application cycle. */
import { readFileSync } from "node:fs";
import type { EligibilityRules } from "../lib/eligibility/types.ts";
import { civilDateIn } from "../lib/time.ts";
import type { Connector, Evidence } from "./types.ts";
import { decodeEntities, evidenceSource, makeCycle, stripTags } from "./util.ts";

export const DSSSB_INDEX = "https://dsssb.delhi.gov.in/dsssb-vacancies";
interface Extraction {
  advertisementUrl: string; advertisementSha256: string;
  corrigenda: { postCode: string; url: string; sha256: string; summary: string }[];
  opensOn: string; closesOn: string; cutoffLocalTime: string;
  postCodes: [string, string][];
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/dsssb-03-2026.json", import.meta.url), "utf8")) as Extraction;

function officialPdf(href: string): string {
  const url = new URL(decodeEntities(href), DSSSB_INDEX);
  if (url.origin !== "https://dsssb.delhi.gov.in" || url.username || url.password || !/^\/sites\/default\/files\/DSSSB\/circulars-orders\/[a-z0-9_\-.]+\.pdf$/i.test(url.pathname)) throw new Error("DSSSB document is outside official archive");
  return url.href;
}

export function parseDsssbIndex(html: string) {
  const notices: { title: string; url: string }[] = [];
  for (const row of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const title = /<div class="tab-title">([\s\S]*?)<\/div>/i.exec(row[1])?.[1];
    if (!title) continue;
    const label = stripTags(title);
    if (!/\b(?:advertisement|advt\.?)\s*(?:no\.?)?\s*03\/2026\b/i.test(label)) continue;
    const href = /<a\b[^>]*class="[^"]*\btab-view\b[^"]*"[^>]*href="([^"]+)"/i.exec(row[1])?.[1];
    if (!href) throw new Error(`DSSSB 03/2026 notice has no document: ${label}`);
    notices.push({ title: label, url: officialPdf(href) });
  }
  const expected = [extraction.advertisementUrl, ...extraction.corrigenda.map((item) => item.url)];
  if (notices.length !== expected.length || new Set(notices.map((item) => item.url)).size !== expected.length || expected.some((url) => !notices.some((item) => item.url === url))) {
    throw new Error("DSSSB 03/2026 archive changed; all documents and corrections need review");
  }
  const main = notices.find((item) => item.url === extraction.advertisementUrl)!;
  if (!/^VACANCY NOTICE\s*\/\s*ADVERTISEMENT NO\.\s*03\/2026/i.test(main.title)) throw new Error("DSSSB 03/2026 advertisement identity changed");
  for (const item of notices.filter((item) => item !== main)) if (!/corrigendum/i.test(item.title)) throw new Error("DSSSB correction identity changed");
  return notices;
}

function requirePdf(bytes: Buffer, evidence: Evidence, expectedHash: string) {
  if (bytes.subarray(0, 5).toString() !== "%PDF-" || evidence.sha256 !== expectedHash) throw new Error(`DSSSB notice bytes changed: ${evidence.url}; old extraction withheld`);
}

function applicantRules(documentUrl: string, postCode: string): EligibilityRules {
  const languages: NonNullable<EligibilityRules["languages"]> = [
    { language: "hi", stage: "selection", requirement: "Hindi language and comprehension questions form part of the advertised examination scheme. No CEFR or other standardized proficiency level is stated; question/mark allocation varies by post-code scheme.", evidence: "Advertisement 03/2026, examination schemes on printed pages 28–30; exact post-code scheme needs founder review.", sourceUrl: documentUrl },
    { language: "en", stage: "selection", requirement: "English language and comprehension questions form part of the advertised examination scheme. No CEFR or other standardized proficiency level is stated; question/mark allocation varies by post-code scheme.", evidence: "Advertisement 03/2026, examination schemes on printed pages 28–30; exact post-code scheme needs founder review.", sourceUrl: documentUrl },
  ];
  if (postCode === "32/26") languages.push({ language: "hi", stage: "apply", requirement: "Technical Assistant (Hindi) has several alternative Hindi/English degree and translation qualifications. The alternatives, including a translation diploma/certificate or government translation experience, require individual review. No CEFR-equivalent level is specified.", evidence: "Advertisement 03/2026, post code 32/26, printed pages 13–14.", sourceUrl: documentUrl });
  return { complete: false, asOn: "2026-07-15", nationality: { allowed: ["IN"], evidence: "Advertisement 03/2026, eligibility criterion 1(i), printed page 27: candidate must be a citizen of India. Rule applies to all 25 post codes in this advertisement." }, languages };
}

export const dsssb: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("DSSSB PDF evidence fetch is required");
  const index = await fetchText(DSSSB_INDEX, { accept: "text/html" });
  parseDsssbIndex(index.text);
  const documents = await Promise.all([{ url: extraction.advertisementUrl, sha256: extraction.advertisementSha256 }, ...extraction.corrigenda].map(async ({ url, sha256 }) => {
    const fetched = await fetchBytes(url, { accept: "application/pdf" });
    requirePdf(fetched.bytes, fetched.evidence, sha256);
    return fetched.evidence;
  }));
  const evidence = [index.evidence, ...documents];
  const correctionEvidence = new Map(extraction.corrigenda.map((item, index) => [item.postCode, documents[index + 1]]));
  const today = civilDateIn("Asia/Kolkata", now);
  const codes = extraction.postCodes.map(([code]) => code);
  if (codes.length !== 25 || new Set(codes).size !== 25 || codes.some((code, index) => code !== `${index + 21}/26`)) throw new Error("DSSSB post-code extraction is incomplete");
  const cycles = extraction.postCodes.map(([postCode, title]) => {
    const amendment = extraction.corrigenda.find((item) => item.postCode === postCode);
    const sources = [
      evidenceSource(source, index.evidence, "DSSSB official vacancy and corrigendum archive", "HTML", "English"),
      evidenceSource(source, documents[0], `Advertisement 03/2026: ${postCode}`, "PDF", "English"),
      ...(amendment ? [evidenceSource(source, correctionEvidence.get(postCode)!, `Corrigendum for ${postCode}: ${amendment.summary}`, "scanned PDF", "English")] : []),
    ];
    return makeCycle({
      id: `dsssb-2026-${postCode.replace("/", "-")}`, sourceId: source.id, title, cycleLabel: `03/2026 · ${postCode}`,
      authority: source.authority, pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-DL"],
      scopeLabel: "Delhi government or local body recruitment; applicant residence conditions must be checked for this post",
      outcome: `Appointment to ${title}`, status: extraction.closesOn < today ? "closed" : extraction.opensOn > today ? "upcoming" : "uncertain",
      statusNote: `Official application window read from exact advertisement; founder review pending.${amendment ? ` ${amendment.summary}.` : ""}`,
      applicationWindow: { opensOn: extraction.opensOn, closesOn: extraction.closesOn, officialTimeZone: "Asia/Kolkata", cutoffLocalTime: extraction.cutoffLocalTime, precision: "minute", note: "Opening time 12:00 noon IST. Age and qualifications assessed as of application closing date. Each post code requires its own application." },
      qualifications: `Post-specific essential qualifications, experience and age limits appear in advertisement 03/2026 under post code ${postCode}; full alternatives require founder review.`,
      citizenshipRule: "Indian citizenship required by advertisement 03/2026 eligibility criterion 1(i). Other conditions still require post-specific review.",
      residenceRule: "Delhi hiring scope does not establish applicant domicile. Any post-specific residence or reservation rules require review.",
      selectionStages: ["DSSSB examination scheme depends on post code; Hindi and English comprehension are tested without a published standardized language level."],
      rules: applicantRules(extraction.advertisementUrl, postCode), sources,
      applicationUrl: "https://dsssbonline.nic.in/",
      changes: amendment ? [{ at: amendment.postCode === "28/26" ? "2026-07-22" : "2026-06-15", kind: "updated", summary: amendment.summary }] : [],
    });
  });
  return { cycles, evidence, warnings: ["Draft-only snapshot of DSSSB advertisement 03/2026. Archive also lists 01/2026, 02/2026 and other notices not extracted; Delhi recruitment coverage is incomplete.", "Scanned corrigenda for 28/26 and 33/26 were visually read and need founder confirmation. Critical dates/nationality/language apply only while all three official PDF hashes match. Post-specific qualification, age, residence and fee checks remain pending."] };
};
