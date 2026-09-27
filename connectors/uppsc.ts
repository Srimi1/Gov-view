/** UPPSC applications: named deadline fields plus current, explicitly labelled job alerts. */
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { dayFirstDate, decodeEntities, evidenceSource, makeCycle, slug, stripTags } from "./util.ts";

export const UPPSC_HOME = "https://uppsc.up.nic.in/";
export const UPPSC_INDEX = `${UPPSC_HOME}CandidatePages/Notifications.aspx`;
const ADVERT = /[AD]-\d+\/E-\d+\/\d{4}/i;
export interface UppscEntry {
  number: string; exam: string; notifiedOn: string; opensOn: string; closesOn: string;
  feeClosesOn: string | null; reconciliationClosesOn: string | null; modificationClosesOn: string | null;
}
export function parseUppscIndex(html: string) {
  const table = /<table\b[^>]*id="ctl00_MainContent_GridView1"[^>]*>([\s\S]*?)<\/table>/i.exec(html)?.[1];
  if (!table || !/Fee Reconciliation/.test(table)) throw new Error("UPPSC notification table changed");
  const entries = new Map<string, UppscEntry>();
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    if (!/<td\b/i.test(row[1])) continue;
    const field = (name: string) => {
      const value = new RegExp(`<span\\b[^>]*id="[^"]*_${name}"[^>]*>([\\s\\S]*?)<\\/span>`, "i").exec(row[1])?.[1];
      return value === undefined ? "" : stripTags(value);
    };
    const number = field("Lbl_Adv_number");
    const opensOn = dayFirstDate(field("Lbl_Gazette_Date"));
    const closesOn = dayFirstDate(field("Lbl_ApplicationFormRegistration_LastDate"));
    const notifiedOn = dayFirstDate(field("Lbl_adv_date"));
    if (!new RegExp(`^${ADVERT.source}$`, "i").test(number) || !opensOn || !closesOn || !notifiedOn || closesOn < opensOn) throw new Error("UPPSC advertisement identity or application dates need review");
    const entry: UppscEntry = { number, exam: field("Lbl_Exam_Name"), notifiedOn, opensOn, closesOn,
      feeClosesOn: dayFirstDate(field("Lbl_ApplicationFormFeeDeposition_LastDate")),
      reconciliationClosesOn: dayFirstDate(field("Lbl_ApplicationFormSubmission_LastDate")),
      modificationClosesOn: dayFirstDate(field("Lbl_ApplicationFormModification_LastDate")),
    };
    const old = entries.get(number);
    if (old && JSON.stringify(old) !== JSON.stringify(entry)) throw new Error(`Conflicting UPPSC application rows: ${number}`);
    entries.set(number, entry);
  }
  if (!entries.size) throw new Error("No UPPSC application rows parsed; preserve previous data");
  return [...entries.values()];
}

export function parseUppscLivePosts(html: string) {
  const posts = new Map<string, { number: string; title: string; postCode: string | null; reopened: boolean }>();
  for (const match of html.matchAll(/Live Advertisement\s*:-\s*<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attributes = match[1];
    const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attributes);
    if (!href) continue;
    const url = new URL(decodeEntities(href[1] ?? href[2] ?? href[3]), UPPSC_HOME);
    if (url.origin !== "https://uppsc.up.nic.in" || url.username || url.password || url.pathname !== "/CandidatePages/Notifications.aspx") continue;
    const text = stripTags(match[2]);
    const number = ADVERT.exec(text)?.[0].toUpperCase();
    if (!number) continue;
    const title = text.replace(/^CLICK HERE TO APPLY FOR\s*/i, "").replace(/\s*\.$/, "");
    const postCode = /\bS-\d+\/\d+\b/i.exec(text)?.[0].toUpperCase() ?? null;
    posts.set(`${number}:${title}`, { number, title, postCode, reopened: /\(REOPEN\)/i.test(text) });
  }
  return [...posts.values()];
}

export const uppsc: Connector = async ({ source, fetchText, now }) => {
  const index = await fetchText(UPPSC_INDEX, { accept: "text/html" });
  const home = await fetchText(UPPSC_HOME, { accept: "text/html" });
  const entries = parseUppscIndex(index.text);
  const posts = parseUppscLivePosts(home.text);
  const today = civilDateIn("Asia/Kolkata", now);
  const cycles = [];
  const warnings = ["Draft connector: only application rows with one unambiguous current job alert. Generic direct-recruitment advertisements are not guessed into individual jobs. Post qualifications, language and international eligibility need notice review."];
  for (const entry of entries) {
    const matching = posts.filter((post) => post.number === entry.number.toUpperCase());
    if (matching.length !== 1) { warnings.push(`${entry.number}: ${matching.length} current job alerts; resolve post identity before import`); continue; }
    const post = matching[0];
    const sources = [
      { ...evidenceSource(source, index.evidence, `Application dates: ${entry.number}`, "HTML", "English"), lastValidatedAt: null },
      { ...evidenceSource(source, home.evidence, `Current live advertisement: ${post.title}`, "HTML", "English"), lastValidatedAt: null },
    ];
    cycles.push(makeCycle({
      id: `uppsc-${slug(entry.number)}${post.postCode ? `-${slug(post.postCode)}` : ""}`, sourceId: source.id,
      title: post.title, cycleLabel: entry.number, authority: source.authority, pathway: "recruitment",
      jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-UP"],
      scopeLabel: "Uttar Pradesh direct recruitment; applicant domicile must be checked separately",
      status: entry.closesOn < today ? "closed" : entry.opensOn > today ? "upcoming" : entry.closesOn === today ? "uncertain" : "open",
      statusNote: `${post.reopened ? "Official alert marks this application reopened. " : ""}Dates and job alert extracted; exact notice, cutoff clock time and eligibility await review.`,
      outcome: post.title,
      applicationWindow: { opensOn: entry.opensOn, closesOn: entry.closesOn, cutoffLocalTime: null, precision: "date", officialTimeZone: null, note: `Official table gives dates without a cutoff clock time or governing time zone. Fee deadline: ${entry.feeClosesOn ?? "unknown"}; fee reconciliation: ${entry.reconciliationClosesOn ?? "unknown"}; correction deadline: ${entry.modificationClosesOn ?? "unknown"}. These do not replace the application deadline. Advertisement identifier is retained even when its year differs from the reopened window.` },
      citizenshipRule: "International eligibility needs verification from the post's advertisement and applicable service rules.",
      residenceRule: "Residence/domicile requirements have not been verified; Uttar Pradesh hiring scope alone is not a residence rule.",
      languageNote: "The application table and job alert do not state a language requirement or proficiency level. Check the exact advertisement and post rules; page language alone is not a candidate requirement.",
      rules: { complete: false, asOn: null, manualChecks: [
        { stage: "apply", text: "Read the exact advertisement for qualifications, age, nationality, residence, language, fees and any post-specific application conditions." },
        { stage: "selection", text: "Verify examination or interview stages, language and venue in the exact advertisement and later notices." },
        { stage: "outcome", text: "Verify appointment, citizenship/work authorisation and service-rule conditions for the specific post." },
      ] },
      applicationMethod: "online", sources, applicationUrl: UPPSC_INDEX,
    }));
  }
  if (!cycles.length) throw new Error("No UPPSC post identities could be matched; preserve previous records for review");
  return { cycles, evidence: [index.evidence, home.evidence], warnings };
};
