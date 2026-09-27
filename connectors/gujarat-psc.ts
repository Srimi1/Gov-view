/** GPSC maritime special-drive ads 42/43: exact-document, founder-review drafts. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn, clockIn } from "../lib/time.ts";
import type { OpportunityCycle } from "../lib/opportunities.ts";
import type { Connector, Evidence } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Document { key: string; url: string; sha256: string }
interface Advertisement {
  number: string; title: string; detailUrl: string; experienceYears: number; ageLimit: number; disability: string; documents: Document[];
}
interface Extraction {
  dashboardUrl: string; applicationUrl: string; opensOn: string; opensAt: string; closesOn: string; closesAt: string;
  advertisements: Advertisement[];
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/gpsc-maritime-42-43-2026.json", import.meta.url), "utf8")) as Extraction;
export const GUJARAT_DASHBOARD = extraction.dashboardUrl;

function links(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)].map((match) => match[1].replace(/&amp;/g, "&"));
}

export function parseGujaratDashboard(html: string): Map<string, string> {
  if (!/Advertisement/i.test(stripTags(html))) throw new Error("GPSC advertisement dashboard identity changed");
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  const details = new Map<string, string>();
  for (const advertisement of extraction.advertisements) {
    const selected = rows.filter((row) => row.includes(`>${advertisement.number}</a>`));
    if (selected.length !== 1 || !stripTags(selected[0]).includes(advertisement.title.replace(", Class I", ", Class-1"))) throw new Error(`GPSC ${advertisement.number} dashboard row missing or changed`);
    const row = selected[0];
    const window = /<td\b[^>]*id="[^"]*_sDate_\d+"[^>]*>([\s\S]*?)<\/td>/i.exec(row);
    const normalized = stripTags(window?.[1] ?? "").replace(/\s+/g, " ");
    if (!normalized.includes("24-09-2026 02:00 PM") || !normalized.includes("08-10-2026 11:59 PM")) throw new Error(`GPSC ${advertisement.number} window changed; review required`);
    if (!/<td\b[^>]*id="[^"]*_totalpost_\d+"[^>]*>\s*1\s*<\/td>/i.test(row)) throw new Error(`GPSC ${advertisement.number} vacancy count changed`);
    const detail = links(row).find((url) => /^AdvertisementDetail\?no=\d+&tab=$/.test(url));
    const resolved = detail ? new URL(`${detail}Advertisement`, GUJARAT_DASHBOARD).href : "";
    if (resolved !== advertisement.detailUrl) throw new Error(`GPSC ${advertisement.number} detail link changed`);
    if (!links(row).includes(extraction.applicationUrl)) throw new Error(`GPSC ${advertisement.number} application link changed`);
    details.set(advertisement.number, resolved);
  }
  return details;
}

export function parseGujaratDetail(html: string, advertisement: Advertisement): Map<string, string> {
  const heading = /<h2\b[^>]*id="ctl14_hAdvt"[^>]*>([\s\S]*?)<\/h2>/i.exec(html);
  if (!heading || !stripTags(heading[1]).includes(advertisement.number) || !stripTags(html).includes(advertisement.title.replace(", Class I", ", Class-1"))) throw new Error(`GPSC ${advertisement.number} detail identity changed`);
  const attachments = [...html.matchAll(/<td\b[^>]*id="ctl14_MainStageList_othertab_0_attachments_\d+"[^>]*>[\s\S]{0,1000}?<a\b[^>]*href=['"]([^'"]+)['"]/gi)];
  if (attachments.length !== advertisement.documents.length) throw new Error(`GPSC ${advertisement.number} attachment set changed`);
  const urls = attachments.map((match) => {
    const href = match[1];
    const url = new URL(href, GUJARAT_DASHBOARD);
    if (url.origin !== "https://gpsc.gujarat.gov.in" || !/^\/Documents\/AdvertismentDocument\/(?:DA|RR)-\d+-2026\.pdf$/.test(url.pathname) || url.search || url.hash) throw new Error(`GPSC ${advertisement.number} attachment outside official archive`);
    return url.href;
  });
  if (new Set(urls).size !== urls.length || advertisement.documents.some((document) => !urls.includes(document.url))) throw new Error(`GPSC ${advertisement.number} PDF link changed`);
  return new Map(advertisement.documents.map((document) => [document.key, document.url]));
}

export const gujaratPsc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("GPSC exact official PDF bytes required");
  const dashboard = await fetchText(GUJARAT_DASHBOARD, { accept: "text/html" });
  if (dashboard.evidence.url !== GUJARAT_DASHBOARD) throw new Error("GPSC dashboard redirected; review required");
  const details = parseGujaratDashboard(dashboard.text);
  const evidence: Evidence[] = [dashboard.evidence];
  const cycles: OpportunityCycle[] = [];
  const today = civilDateIn("Asia/Kolkata", now);
  const clock = clockIn("Asia/Kolkata", now);
  const status: OpportunityCycle["status"] = today > extraction.closesOn || (today === extraction.closesOn && clock >= extraction.closesAt)
    ? "closed" : today < extraction.opensOn || (today === extraction.opensOn && clock < extraction.opensAt) ? "upcoming" : "uncertain";
  for (const advertisement of extraction.advertisements) {
    const detail = await fetchText(details.get(advertisement.number)!, { accept: "text/html" });
    if (detail.evidence.url !== advertisement.detailUrl) throw new Error(`GPSC ${advertisement.number} detail redirected`);
    const docs = parseGujaratDetail(detail.text, advertisement);
    evidence.push(detail.evidence);
    const pdfEvidence = new Map<string, Evidence>();
    for (const document of advertisement.documents) {
      const url = docs.get(document.key)!;
      const pdf = await fetchBytes(url, { accept: "application/pdf" });
      const hash = createHash("sha256").update(pdf.bytes).digest("hex");
      if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== url || pdf.evidence.sha256 !== hash || hash !== document.sha256) throw new Error(`GPSC ${advertisement.number} ${document.key} PDF changed; extracted fields withheld`);
      evidence.push(pdf.evidence);
      pdfEvidence.set(document.key, pdf.evidence);
    }
    const marine = advertisement.number.startsWith("42/");
    cycles.push(makeCycle({
      id: `gpsc-maritime-${advertisement.number.replace("/", "-")}`, sourceId: source.id,
      title: advertisement.title, cycleLabel: `GPSC advertisement ${advertisement.number}`,
      authority: source.authority, pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-GJ"],
      scopeLabel: "Gujarat Maritime Board special recruitment drive; selected applicant becomes board employee, not Gujarat Government employee",
      outcome: `One ${advertisement.title} board post; ${advertisement.disability}. Shared bilingual PDF covers two separately applied posts.`,
      status, statusNote: "Application window appears in official dashboard and bilingual notice; founder review pending.",
      applicationWindow: { opensOn: extraction.opensOn, closesOn: extraction.closesOn, cutoffLocalTime: extraction.closesAt, officialTimeZone: "Asia/Kolkata", precision: "minute", note: "Dashboard and bilingual detailed notice: applications 24 September 2026 at 14:00 through 8 October 2026 at 23:59. Asia/Kolkata is local Gujarat time; notice prints no timezone label." },
      qualifications: `Bachelor's in Marine or Mechanical Engineering; Marine Engineer Officer Class I competency certificate; at least ${advertisement.experienceYears} years after first competency certificate, including ${marine ? "one" : "four"} year${marine ? "" : "s"} as Chief or Second Engineer on a foreign-going ship. Basic computer knowledge and adequate Gujarati or Hindi (or both). Foreign degrees require validity/equivalency evidence (bilingual detailed notice pages 10–12).`,
      citizenshipRule: "Detailed advertisement states no national citizenship test. Foreign university degrees and experience may be considered with equivalency proof, but that does not establish permission for a foreign citizen to apply, sit selection, or take appointment; verify recruitment rules and authority decision.",
      residenceRule: "No general Gujarat domicile requirement identified for the unreserved vacancy; Gujarat-origin reservation and fee benefits are distinct from application eligibility. Founder must confirm against recruitment rules.",
      selectionStages: ["Objective preliminary test, generally Gujarati medium unless GPSC decides otherwise", "Application/document scrutiny", "Interview; preliminary test and interview each carry 50% weighted marks"],
      fee: "PwD applicants pay no application fee under detailed notice; other category/fee conditions require review.",
      salary: marine ? "Pay Matrix Level 12 (₹78,800–₹2,09,200)" : "Pay Matrix Level 13 (₹1,23,100–₹2,15,900)",
      rules: { complete: false, asOn: extraction.closesOn, manualChecks: [
        { stage: "apply", text: `Verify specific disability category and ${advertisement.disability} evidence; this is a PwD-only special recruitment drive (English detailed notice page 9).` },
        { stage: "apply", text: "Verify national citizenship/appointment permission from the scanned recruitment rules; foreign-degree equivalency alone does not prove it (detailed notice pages 12 and recruitment-rules PDF)." },
        { stage: "apply", text: `Verify Marine/Mechanical Engineering degree, Class I competency certificate, ${advertisement.experienceYears} years after first certificate, post qualification shipboard experience, and advertised age 21–${advertisement.ageLimit} with all experience/relaxation exceptions at 8 October 2026 (detailed notice pages 10–11).` },
        { stage: "selection", text: "Preliminary test is generally in Gujarati unless GPSC decides otherwise; confirm actual medium before examination. No formal language-proficiency level is printed (page 12)." },
        { stage: "outcome", text: "Verify adequate Gujarati or Hindi (or both), computer knowledge, foreign-degree equivalency where applicable, and board appointment conditions (pages 9–12)." },
      ] },
      venues: [{ kind: "unknown", name: "Preliminary test generally Gandhinagar/Ahmedabad; actual venue not yet published" }],
      sources: [
        evidenceSource(source, dashboard.evidence, "GPSC advertisement dashboard", "HTML", "English"),
        evidenceSource(source, detail.evidence, `GPSC ${advertisement.number} detail`, "HTML", "English"),
        ...advertisement.documents.map((document) => evidenceSource(source, pdfEvidence.get(document.key)!, `GPSC ${advertisement.number} ${document.key}`, "PDF", document.key === "detailed" ? "Gujarati/English" : "Gujarati")),
      ],
      applicationUrl: extraction.applicationUrl,
    }));
  }
  return { cycles, evidence, complete: false, warnings: [
    "Only GPSC maritime advertisements 42 and 43/2026-27 are staged; other Gujarat advertisements and authorities remain gaps.",
    "These are separate application numbers and one post each, though their detailed-document URLs have identical PDF bytes; no duplicate cycle is created from the shared document.",
    "Special drive requires specific disability type/range per post. National citizenship and appointment eligibility for foreign citizens are not stated in the detailed PDF; scanned recruitment rules need founder review.",
    "Adequate Gujarati or Hindi is required, and preliminary test is generally Gujarati medium unless GPSC decides otherwise. No formal language level or automatic equivalence is inferred.",
    "Actual examination venue is not announced; Gandhinagar/Ahmedabad in the notice is general practice, not an exam pin.",
  ] };
};
