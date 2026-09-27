/** Bihar Technical Service Commission: complete archive pagination, recent-cycle drafts. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { EligibilityRules } from "../lib/eligibility/types.ts";
import type { Connector, Evidence } from "./types.ts";
import { civilDateIn, daysBetween } from "../lib/time.ts";
import { dayFirstDate, decodeEntities, evidenceSource, makeCycle, shortHash, stripTags } from "./util.ts";

export const BTSC_INDEX = "https://btsc.bihar.gov.in/recruitment?page=0";
const BASE = "https://btsc.bihar.gov.in";
export interface BtscEntry {
  number: string; title: string; opensOn: string; registrationClosesOn: string; closesOn: string; paymentClosesOn: string;
  documents: { url: string; title: string }[]; applicationUrl: string | null; listedClosed: boolean;
}

/** Keep only outer table rows; each document cell contains another table. */
function recruitmentRows(html: string): string[] {
  const clean = html.replace(/<!--[\s\S]*?-->/g, "");
  const header = clean.indexOf('id="view-counter-table-column"');
  const start = clean.lastIndexOf("<table", header);
  if (header < 0 || start < 0) throw new Error("BTSC recruitment table changed");
  const table = clean.slice(start);
  let depth = 0, rowStart = -1;
  const rows: string[] = [];
  for (const tag of table.matchAll(/<\/?(?:table|tr)\b[^>]*>/gi)) {
    if (/^<table\b/i.test(tag[0])) depth += 1;
    else if (/^<\/table/i.test(tag[0])) { depth -= 1; if (depth === 0) return rows; }
    else if (depth === 1 && /^<tr\b/i.test(tag[0])) rowStart = tag.index;
    else if (depth === 1 && /^<\/tr/i.test(tag[0]) && rowStart >= 0) { rows.push(table.slice(rowStart, tag.index + tag[0].length)); rowStart = -1; }
  }
  throw new Error("BTSC table is incomplete");
}

export function parseBtscPage(html: string, pageUrl: string) {
  const entries: BtscEntry[] = [];
  for (const row of recruitmentRows(html)) {
    if (!/<td\b/i.test(row)) continue;
    const matches = [...row.matchAll(/<td\b[^>]*headers="([^"]+)"[^>]*>/gi)];
    const fields = new Map(matches.map((match, index) => [match[1], row.slice(match.index + match[0].length, matches[index + 1]?.index ?? row.length)]));
    if (fields.size !== 9 || matches.length !== 9) throw new Error("BTSC named columns changed");
    const raw = (name: string) => fields.get(`view-${name}-table-column`) ?? "";
    const field = (name: string) => stripTags(raw(name)).replace(/\s+/g, " ").trim();
    const numberMatch = /^(\d+)\/(\d{4})\.?$/.exec(field("title"));
    const number = numberMatch ? `${Number(numberMatch[1])}/${numberMatch[2]}` : field("title");
    const title = field("field-examination-name");
    const opensOn = dayFirstDate(field("field-registration-start-date"));
    const registrationClosesOn = dayFirstDate(field("field-registration-end-date"));
    const closesOn = dayFirstDate(field("field-application-last-date"));
    const paymentClosesOn = dayFirstDate(field("field-payment-last-day"));
    if (!/^\d+\/\d{4}$/.test(number) || !title || !opensOn || !registrationClosesOn || !closesOn || !paymentClosesOn || closesOn < opensOn || registrationClosesOn < opensOn) throw new Error(`BTSC ${number}: cycle identity or date fields need review`);
    const documents = [...raw("view").matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((link) => {
      const url = new URL(decodeEntities(link[1]).trim(), pageUrl);
      if (url.origin !== BASE || url.username || url.password || !url.pathname.startsWith("/sites/default/files/") || !/\.pdf$/i.test(url.pathname) || url.search || url.hash) throw new Error("BTSC document outside official archive");
      return { url: url.href, title: stripTags(link[2]) };
    });
    if (!documents.length) throw new Error(`BTSC ${number}: no official notice document`);
    const link = /<a\b[^>]*href="([^"]+)"/i.exec(raw("field-link"));
    let applicationUrl: string | null = null;
    if (link) {
      const url = new URL(decodeEntities(link[1]).trim(), pageUrl);
      if (url.protocol !== "https:" || !["btsc.pariksha.nic.in", "btsc.bihar.gov.in"].includes(url.hostname) || url.port || url.username || url.password) throw new Error("BTSC application link outside official services");
      applicationUrl = url.href;
    }
    entries.push({ number, title, opensOn, registrationClosesOn, closesOn, paymentClosesOn, documents: [...new Map(documents.map((doc) => [doc.url, doc])).values()], applicationUrl, listedClosed: /^Closed$/i.test(field("field-link")) });
  }
  if (!entries.length) throw new Error("No BTSC advertisement rows parsed; preserve previous records");
  if ([...html.matchAll(/<td\b[^>]*headers="view-counter-table-column"/gi)].length !== entries.length) throw new Error("BTSC parser did not account for every register row");
  const nextLinks = [...html.matchAll(/<a\b([^>]*)>/gi)].filter((match) => /\brel="next"/.test(match[1]));
  if (nextLinks.length > 1) throw new Error("BTSC pagination is ambiguous");
  let next: string | null = null;
  if (nextLinks.length) {
    const href = /href="([^"]+)"/.exec(nextLinks[0][1])?.[1];
    if (!href) throw new Error("BTSC next-page link missing");
    const url = new URL(decodeEntities(href), pageUrl);
    if (url.origin !== BASE || url.pathname !== "/recruitment" || url.username || url.password || url.hash || [...url.searchParams.keys()].some((key) => key !== "page") || !/^\d+$/.test(url.searchParams.get("page") ?? "") || Number(url.searchParams.get("page")) !== Number(new URL(pageUrl).searchParams.get("page") ?? 0) + 1) throw new Error("BTSC pagination changed or leaves official archive");
    next = url.href;
  }
  return { entries, next };
}

interface Extraction { number: string; documentUrl: string; sha256: string; opensOn: string; closesOn: string; qualifications: string; citizenshipRule: string; residenceRule: string; fee: string; salary: string; selectionStages: string[]; rules: EligibilityRules; warnings: string[] }
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/btsc-28-2026.json", import.meta.url), "utf8")) as Extraction;

export const btsc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  const records = new Map<string, { entry: BtscEntry; evidence: Evidence }>();
  const conflicts = new Set<string>();
  const evidence: Evidence[] = [];
  const warnings = ["Draft connector: complete paginated recruitment register, retaining cycles whose application deadline is within the last 60 days or later. Separate news/corrigendum feeds and individual department recruitment remain coverage gaps. Scanned notices require original-language review."];
  let next: string | null = BTSC_INDEX;
  let pages = 0;
  while (next) {
    if (++pages > 20) throw new Error("BTSC archive exceeds 20-page bound; preserve previous records and review pagination");
    const fetched = await fetchText(next, { accept: "text/html" });
    evidence.push(fetched.evidence);
    const parsed = parseBtscPage(fetched.text, next);
    for (const entry of parsed.entries) {
      const old = records.get(entry.number);
      if (old && JSON.stringify(old.entry) !== JSON.stringify(entry)) {
        conflicts.add(entry.number);
        warnings.push(`Conflicting BTSC identifier ${entry.number}: "${old.entry.title}" (${old.entry.opensOn}–${old.entry.closesOn}) versus "${entry.title}" (${entry.opensOn}–${entry.closesOn}). All rows for this identifier withheld; no inferred correction to the advertisement year.`);
        continue;
      }
      records.set(entry.number, { entry, evidence: fetched.evidence });
    }
    next = parsed.next;
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const recent = [...records.values()].filter(({ entry }) => !conflicts.has(entry.number) && daysBetween(entry.closesOn, today) <= 60);
  const cycles = [];
  for (const { entry, evidence: pageEvidence } of recent) {
    const sources = [{ ...evidenceSource(source, pageEvidence, `Recruitment register: ${entry.number}`, "HTML", "English"), lastValidatedAt: null }];
    let matchedExtraction: Extraction | null = null;
    for (const document of entry.documents) {
      try {
        if (!fetchBytes) throw new Error("Exact-byte PDF fetching unavailable");
        const pdf = await fetchBytes(document.url, { accept: "application/pdf" });
        if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("Document is not a PDF");
        evidence.push(pdf.evidence);
        sources.push({ ...evidenceSource(source, pdf.evidence, `${entry.number}: ${document.title}`, "PDF", "Original language pending review"), lastValidatedAt: null });
        if (entry.number === extraction.number && entry.documents.length === 1 && document.url === extraction.documentUrl && pdf.evidence.url === document.url && createHash("sha256").update(pdf.bytes).digest("hex") === extraction.sha256 && pdf.evidence.sha256 === extraction.sha256 && entry.opensOn === extraction.opensOn && entry.closesOn === extraction.closesOn) matchedExtraction = extraction;
      } catch (error) {
        warnings.push(`${entry.number}: ${error instanceof Error ? error.message : String(error)}; document fields withheld`);
        sources.push({ id: `${source.id}:document:${shortHash(document.url)}`, title: document.title, authority: source.authority, format: "PDF", language: "Not verified", url: document.url, lastSuccessfulFetchAt: null, lastValidatedAt: null, verificationStatus: "pending-review" });
      }
    }
    if (entry.number === extraction.number && !matchedExtraction) warnings.push(`${entry.number}: expected notice hash, document set or dates changed; old applicant-rule extraction withheld`);
    if (matchedExtraction) warnings.push(...matchedExtraction.warnings);
    cycles.push(makeCycle({
      id: `btsc-${entry.number.split("/")[1]}-${Number(entry.number.split("/")[0])}`, sourceId: source.id,
      title: entry.title, cycleLabel: entry.number, authority: source.authority, pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-BR"],
      status: entry.listedClosed ? "closed" : "uncertain", statusNote: "Official recruitment-register dates extracted; scanned notice, amendments and eligibility require founder review.",
      scopeLabel: "Bihar technical recruitment; domicile benefits and nationality are separate conditions",
      outcome: entry.title.replace(/^Advertisement for regular appointment to the post of\s*/i, "Appointment as "),
      applicationWindow: { opensOn: entry.opensOn, closesOn: entry.closesOn, officialTimeZone: null, cutoffLocalTime: null, precision: "date", note: `Registration deadline: ${entry.registrationClosesOn}. Payment deadline: ${entry.paymentClosesOn}. Application deadline remains separate. Cutoff time and official timezone require notice verification.` },
      qualifications: matchedExtraction?.qualifications ?? "Scanned/linked official notice requires qualification extraction and review.",
      citizenshipRule: matchedExtraction?.citizenshipRule ?? "International eligibility has not been extracted from this notice; do not infer it from the hiring jurisdiction.",
      residenceRule: matchedExtraction?.residenceRule ?? "Residence and reservation conditions require original-notice review.",
      fee: matchedExtraction?.fee ?? "Fee requires original-notice review.", salary: matchedExtraction?.salary,
      selectionStages: matchedExtraction?.selectionStages ?? [],
      rules: matchedExtraction?.rules ?? null, sources, applicationUrl: entry.applicationUrl,
    }));
  }
  if (!cycles.length) throw new Error("No current/recent BTSC cycles resolved; preserve previous records for review");
  warnings.push(`${pages} register pages and ${records.size} distinct advertisement identifiers checked; ${conflicts.size} conflicting identifiers withheld, ${recent.length} unambiguous identifiers within the retention window. This is not complete Bihar government coverage.`);
  return { cycles, evidence, warnings };
};
