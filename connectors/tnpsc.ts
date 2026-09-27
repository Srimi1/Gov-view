/** Tamil Nadu's official application table, cross-checked with its exam dashboard. */
import { readFileSync } from "node:fs";
import type { EligibilityRules } from "../lib/eligibility/types.ts";
import { civilDateIn, daysBetween } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { dayFirstDate, decodeEntities, evidenceSource, makeCycle, stripTags } from "./util.ts";

export const TNPSC_INDEX = "https://apply.tnpscexams.in/notification?app_id=UElZMDAwMDAwMQ%3D%3D";
const normalizedNumber = (value: string) => value.replace(/^0+(?=\d)/, "");
const links = (html: string) => [...html.matchAll(/<a\b[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({ url: decodeEntities(match[1]), label: stripTags(match[2]) }));
function officialDocument(url: string) {
  const target = new URL(url, "https://tnpsc.gov.in");
  return target.protocol === "https:" && ["tnpsc.gov.in", "www.tnpsc.gov.in"].includes(target.hostname) && !target.port && !target.username && !target.password ? target : null;
}

export interface TnpscEntry {
  id: string; number: string; title: string; notifiedOn: string;
  opensOn: string; closesOn: string; paymentClosesOn: string | null;
  dashboardUrl: string; activity: string;
}

export function parseTnpscIndex(html: string, today?: string) {
  const table = /<table\b[^>]*id="example"[^>]*>([\s\S]*?)<\/table>/i.exec(html)?.[1];
  if (!table || !/Notification No\./.test(table) || !/Payment Last Date/.test(table)) throw new Error("TNPSC application table changed");
  const entries = new Map<string, TnpscEntry>();
  const warnings: string[] = [];
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]);
    if (!cells.length) continue;
    const number = stripTags(cells[0]);
    if (!/^\d+\/\d{4}$/.test(number) || cells.length !== 9) { warnings.push(`Unrecognized notification row: ${number}`); continue; }
    const notifiedOn = dayFirstDate(stripTags(cells[1]));
    const opensOn = dayFirstDate(stripTags(cells[3]));
    const closesOn = dayFirstDate(stripTags(cells[4]));
    // Old archive formats are outside the documented rolling collection window.
    if (today && closesOn && daysBetween(closesOn, today) > 60) continue;
    const link = links(cells[6]).find((link) => link.label === "English");
    const dashboard = link && officialDocument(link.url);
    if (!notifiedOn || !opensOn || !closesOn || closesOn < opensOn || !dashboard || dashboard.pathname.toLowerCase() !== "/web/examdashboard/index.aspx" || !dashboard.searchParams.get("notid")) {
      warnings.push(`Dates or dashboard need review: ${number}`); continue;
    }
    const entry: TnpscEntry = { id: `tnpsc-${number.split("/")[1]}-${Number(number.split("/")[0])}`, number: normalizedNumber(number), title: stripTags(cells[2]), notifiedOn, opensOn, closesOn, paymentClosesOn: dayFirstDate(stripTags(cells[5])), dashboardUrl: dashboard.href, activity: stripTags(cells[8]) };
    const old = entries.get(entry.id);
    if (old && JSON.stringify(old) !== JSON.stringify(entry)) throw new Error(`Conflicting TNPSC notification ${number}`);
    entries.set(entry.id, entry);
  }
  if (!entries.size) throw new Error("No TNPSC application rows parsed");
  return { entries: [...entries.values()], warnings };
}

export function parseTnpscDashboard(html: string, expected: TnpscEntry) {
  const text = stripTags(html).replace(/\s+/g, " ");
  const heading = /<h5\b[^>]*class="card-title"[^>]*>([\s\S]*?)<\/h5>/i.exec(html)?.[1];
  const number = heading && /(\d+\/\d{4})/.exec(stripTags(heading))?.[1];
  if (!number || normalizedNumber(number) !== expected.number) throw new Error("Dashboard belongs to a different application cycle");
  const start = /Date of commencement of receiving application\s*:\s*(\d{2}\.\d{2}\.\d{4})/i.exec(text);
  const end = /Last date and time for submission of online application\s*:\s*(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{1,2}):(\d{2})\s*([AP])\.?M/i.exec(text);
  if (!start || !end || dayFirstDate(start[1]) !== expected.opensOn || dayFirstDate(end[1]) !== expected.closesOn) throw new Error("TNPSC portal and dashboard dates conflict or cannot be read");
  const hour = Number(end[2]); const minute = Number(end[3]);
  if (hour < 1 || hour > 12 || minute > 59) throw new Error("Invalid dashboard cutoff time");
  const cutoff = `${String(hour % 12 + (end[4].toUpperCase() === "P" ? 12 : 0)).padStart(2, "0")}:${end[3]}`;
  const pdfs = links(html).map((link) => officialDocument(link.url)).filter((url) => url && /^\/document\/english\/.+\.pdf$/i.test(url.pathname));
  if (pdfs.length !== 1) throw new Error("Dashboard notification or amendment documents need review");
  return { cutoff, documentUrl: pdfs[0]!.href };
}

interface DraftExtraction { cycleId: string; documentUrl: string; sha256: string; rules: EligibilityRules }
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/tnpsc-2026-8.json", import.meta.url), "utf8")) as DraftExtraction;

export const tnpsc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  const index = await fetchText(TNPSC_INDEX, { accept: "text/html" });
  const today = civilDateIn("Asia/Kolkata", now);
  const parsed = parseTnpscIndex(index.text, today);
  const entries = parsed.entries.filter((entry) => daysBetween(entry.closesOn, today) <= 60);
  const evidence = [index.evidence];
  const cycles = [];
  const warnings = [...parsed.warnings, "Draft connector: notice-specific post qualifications and international eligibility require review. Closed cycles retained for 60 days; portal coverage only."];
  for (const entry of entries) {
    let cutoff: string | null = null;
    let rules: EligibilityRules | null = null;
    let conflict = false;
    const sources = [{ ...evidenceSource(source, index.evidence, `Application table: ${entry.number}`, "HTML", "English", TNPSC_INDEX), lastValidatedAt: null }];
    try {
      const dashboard = await fetchText(entry.dashboardUrl, { accept: "text/html" });
      evidence.push(dashboard.evidence);
      const details = parseTnpscDashboard(dashboard.text, entry);
      cutoff = details.cutoff;
      sources.push({ ...evidenceSource(source, dashboard.evidence, `Exam dashboard: ${entry.number}`, "HTML", "English"), lastValidatedAt: null });
      if (entry.id === extraction.cycleId && details.documentUrl === extraction.documentUrl && fetchBytes) {
        const pdf = await fetchBytes(details.documentUrl, { accept: "application/pdf" });
        evidence.push(pdf.evidence);
        sources.push({ ...evidenceSource(source, pdf.evidence, `Notification ${entry.number}: language clauses 4.4 and 6.5`, "PDF", "English"), lastValidatedAt: null });
        if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.sha256 !== extraction.sha256) {
          warnings.push(`${entry.id}: notification changed; previous language extraction withheld`);
          conflict = true;
        } else rules = extraction.rules;
      }
    } catch (error) {
      conflict = true;
      warnings.push(`${entry.id}: ${(error as Error).message}`);
    }
    cycles.push(makeCycle({
      id: entry.id, sourceId: source.id, title: entry.title, cycleLabel: entry.number,
      authority: source.authority, pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-TN"],
      status: conflict ? "uncertain" : entry.closesOn < today ? "closed" : entry.opensOn > today ? "upcoming" : "open",
      statusNote: conflict ? "Source conflict or failed document check; founder review required." : "Official application dates extracted; notice and eligibility review pending.",
      scopeLabel: "Tamil Nadu recruitment; applicant domicile must be checked separately",
      outcome: "Appointment to one of the posts covered by this recruitment examination",
      applicationWindow: { opensOn: entry.opensOn, closesOn: entry.closesOn, cutoffLocalTime: cutoff, officialTimeZone: "Asia/Kolkata", precision: cutoff ? "minute" : "date", note: `Notified ${entry.notifiedOn}.${entry.paymentClosesOn ? ` Fee-payment deadline: ${entry.paymentClosesOn}; this is separate from the application deadline.` : ""}` },
      citizenshipRule: "International applicant eligibility needs verification against the notification and TNPSC Instructions to Applicants.",
      residenceRule: "Residence and domicile conditions have not been extracted; state hiring scope does not establish eligibility.",
      rules, sources, applicationUrl: TNPSC_INDEX,
    }));
  }
  if (!cycles.length) throw new Error("No current/recent TNPSC cycles parsed; preserve previous records pending review");
  return { cycles, evidence, warnings };
};
