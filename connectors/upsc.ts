/**
 * Union Public Service Commission (India) — "Active Examinations".
 * Each exam page lists the notification date, last date for applications
 * (with time) and the notification PDF. Parsing is deterministic.
 */
import type { EligibilityRules } from "../lib/eligibility/types.ts";
import { civilDateIn, daysBetween } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { clockTime, dayFirstDate, decodeEntities, evidenceSource, makeCycle, slug, stripTags } from "./util.ts";

const BASE = "https://www.upsc.gov.in";
const LIST = `${BASE}/examinations/active-exams`;

export function parseActiveList(html: string): { title: string; url: string }[] {
  // The page keeps an old list inside an HTML comment; ignore it.
  const clean = html.replace(/<!--[\s\S]*?-->/g, "");
  const start = clean.indexOf("view-content");
  const section = start >= 0 ? clean.slice(start) : clean;
  const results: { title: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const match of section.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]{0,400}?)<\/a>/g)) {
    const href = match[1];
    const label = stripTags(match[2]);
    if (label.length < 8) continue;
    if (!/examination|exam\b|ldce|service/i.test(label) || /question|cut-?off|answer|marks|syllabus|calendar|forthcoming|demo/i.test(label)) continue;
    const url = new URL(href, `${BASE}/examinations/`).toString();
    if (!url.startsWith(`${BASE}/examinations/`) || seen.has(url)) continue;
    seen.add(url);
    results.push({ title: label, url });
  }
  return results;
}

export interface UpscExam {
  name: string;
  notifiedOn: string | null;
  examStartsOn: string | null;
  lastDate: string | null;
  lastTime: string | null;
  notificationUrl: string | null;
}

export function parseExamPage(html: string): UpscExam | null {
  const text = stripTags(html).replace(/\n/g, " ");
  const field = (label: string) => {
    const match = new RegExp(`${label}\\s*:?\\s*(.{0,60}?)(?=Date of|Duration of|Last Date|Download|Name of|$)`, "i").exec(text);
    return match ? match[1].trim() : null;
  };
  const name = field("Name of Examination");
  if (!name) return null;
  const last = field("Last Date for Receipt of Applications");
  const pdf = /href="([^"]+\.pdf)"/i.exec(html.slice(html.indexOf("Name of Examination")));
  return {
    name: decodeEntities(name),
    notifiedOn: dayFirstDate(field("Date of Notification")),
    examStartsOn: dayFirstDate(field("Date of Commencement of Examination")),
    lastDate: dayFirstDate(last),
    lastTime: clockTime(last?.replace(/^\S+/, "")),
    notificationUrl: pdf ? new URL(pdf[1], BASE).toString() : null,
  };
}

/** Rules every UPSC exam shares; age and qualification limits vary by exam and are added in review. */
function commonRules(): EligibilityRules {
  return {
    asOn: null,
    nationality: {
      allowed: ["IN"],
      conditional: ["NP", "BT"],
      evidence: "UPSC notices: a citizen of India, or a subject of Nepal or Bhutan (and certain others) with a certificate of eligibility. Some services are open to Indian citizens only — check the notice.",
    },
  };
}

export const upsc: Connector = async ({ source, fetchText, now, log }) => {
  const list = await fetchText(LIST, { accept: "text/html" });
  const exams = parseActiveList(list.text);
  log(`${exams.length} active examinations listed`);
  const today = civilDateIn("Asia/Kolkata", now);
  const cycles = [];
  const evidence = [list.evidence];
  const warnings: string[] = [];
  for (const exam of exams) {
    try {
      const page = await fetchText(exam.url, { accept: "text/html" });
      evidence.push(page.evidence);
      const parsed = parseExamPage(page.text);
      // Main-exam pages have a different layout and are only for candidates already in the process.
      if (!parsed) { warnings.push(`No application details on ${exam.url}`); continue; }
      // Skip exams whose applications closed more than 60 days ago; they stay "active" for results only.
      if (parsed.lastDate && daysBetween(parsed.lastDate, today) > 60) continue;
      // Active exams whose application window has closed are listed for admit cards and results.
      const status = parsed.lastDate && parsed.lastDate < today ? "closed" : "open";
      const sources = [evidenceSource(source, page.evidence, `Exam page: ${parsed.name}`, "HTML", "English", exam.url)];
      if (parsed.notificationUrl) {
        sources.push({ ...sources[0], id: `${sources[0].id}:pdf`, title: "Notification (PDF)", format: "PDF", url: parsed.notificationUrl });
      }
      cycles.push(makeCycle({
        id: `upsc-${slug(parsed.name)}`,
        title: parsed.name,
        cycleLabel: /\d{4}/.exec(parsed.name)?.[0] ?? "",
        authority: "Union Public Service Commission",
        pathway: "recruitment",
        status,
        statusNote: status === "open" ? "Apply online through UPSC's One Time Registration portal." : "Applications closed; the exam is still in progress.",
        jurisdictionCode: "IN",
        jurisdictionName: "India",
        scopeLabel: "All-India recruitment",
        outcome: "Appointment to central government services and posts",
        applicationWindow: {
          opensOn: parsed.notifiedOn,
          closesOn: parsed.lastDate,
          officialTimeZone: "Asia/Kolkata",
          cutoffLocalTime: parsed.lastTime,
          precision: parsed.lastTime ? "minute" : parsed.lastDate ? "date" : "unknown",
          note: parsed.examStartsOn ? `The exam begins on ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${parsed.examStartsOn}T12:00:00Z`))}.` : undefined,
        },
        qualifications: "Varies by exam — see the notification.",
        citizenshipRule: "Citizen of India; some services also admit subjects of Nepal/Bhutan with a certificate of eligibility.",
        residenceRule: "No residence requirement.",
        selectionStages: /\(Preliminary\)/i.test(parsed.name) ? ["Preliminary exam", "Main exam", "Interview / personality test"] : /\(Main\)/i.test(parsed.name) ? ["Main exam", "Interview / personality test"] : ["Written exam", "Interview (if applicable)"],
        fee: "See the notification (fee exemptions for women, SC/ST and PwBD candidates are common).",
        rules: commonRules(),
        venues: [{ kind: "unknown", name: "Exam centres are listed in the notification" }],
        sources,
        applicationUrl: status === "open" ? "https://upsconline.gov.in/upsc/OTRP/" : null,
      }));
    } catch (error) {
      warnings.push(`${exam.url}: ${(error as Error).message}`);
    }
  }
  return { cycles, evidence, warnings };
};
