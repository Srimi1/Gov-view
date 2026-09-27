/** RPSC's advertisement archive. Amendments belong to their original cycle. */
import type { SourceEvidence } from "../lib/opportunities.ts";
import { civilDateIn, daysBetween } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { dayFirstDate, decodeEntities, evidenceSource, makeCycle, shortHash, stripTags } from "./util.ts";

export const RPSC_INDEX = "https://rpsc.rajasthan.gov.in/advertisements";
export interface RpscNotice {
  releasedOn: string; exam: string; description: string; url: string;
  kind: "advertisement" | "corrigendum"; number: string; withdrawn: boolean;
}
const examKey = (value: string) => value.replace(/\(ADVT\. WITHDRAWN\)/gi, "").replace(/\s+/g, " ").trim().toUpperCase();

export function parseRpscNotices(html: string, today?: string): RpscNotice[] {
  const table = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map((match) => match[1]).find((table) => /Release Date/.test(table) && /Description \/ Details/.test(table));
  if (!table) throw new Error("RPSC advertisement table changed");
  const notices = new Map<string, RpscNotice>();
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
    if (!cells.length) continue;
    if (cells.length !== 5) throw new Error("Unexpected RPSC row shape");
    const releasedOn = dayFirstDate(stripTags(cells[1]));
    const exam = stripTags(cells[2]);
    const description = stripTags(cells[3]);
    const identity = /^(Advt\.?|Corrigendum)(?: No\.?)?\s*(\d+\/\d{4}-\d{2})\b/i.exec(description);
    // Historical entries use several non-standard numbering schemes. Preserve them
    // as a measured parser gap by failing if they enter the recent collection window.
    if (!releasedOn) throw new Error("RPSC release date cannot be read");
    if (!identity) {
      if (today && daysBetween(releasedOn, today) <= 180) throw new Error(`Recent RPSC notice numbering needs review: ${description}`);
      continue;
    }
    const href = /href=['"]([^'"]+)['"]/i.exec(cells[4])?.[1];
    if (!href) throw new Error("RPSC notice has no document link");
    const url = new URL(decodeEntities(href), RPSC_INDEX);
    if (url.origin !== "https://rpsc.rajasthan.gov.in" || url.username || url.password || !/^\/Static\/RecruitmentAdvertisements\/[A-Z0-9-]+\.pdf$/i.test(url.pathname)) throw new Error("RPSC document link is outside the official archive");
    const notice: RpscNotice = { releasedOn, exam, description, url: url.href, number: identity[2], kind: /^Advt/i.test(identity[1]) ? "advertisement" : "corrigendum", withdrawn: /ADVT\. WITHDRAWN/i.test(exam) };
    // One corrigendum PDF can cover several exam groups; retain each association.
    const key = `${examKey(exam)}:${url.href}`;
    const old = notices.get(key);
    if (old && JSON.stringify(old) !== JSON.stringify(notice)) throw new Error("Conflicting rows for the same RPSC document");
    notices.set(key, notice);
  }
  if (!notices.size) throw new Error("No numbered RPSC notices parsed");
  return [...notices.values()];
}

export function groupRpscCycles(notices: RpscNotice[], today: string) {
  const byExam = new Map<string, RpscNotice[]>();
  for (const notice of notices) {
    const key = examKey(notice.exam);
    byExam.set(key, [...(byExam.get(key) ?? []), notice]);
  }
  const groups: { original: RpscNotice; notices: RpscNotice[] }[] = [];
  const warnings: string[] = [];
  for (const rows of byExam.values()) {
    if (!rows.some((row) => daysBetween(row.releasedOn, today) >= 0 && daysBetween(row.releasedOn, today) <= 180)) continue;
    const originals = rows.filter((row) => row.kind === "advertisement");
    if (originals.length !== 1) { warnings.push(`${rows[0].exam}: ${originals.length} original advertisements; amendment association needs review`); continue; }
    groups.push({ original: originals[0], notices: rows.sort((a, b) => a.releasedOn.localeCompare(b.releasedOn)) });
  }
  const ids = groups.map((group) => group.original.number);
  if (new Set(ids).size !== ids.length) throw new Error("RPSC advertisement number maps to multiple exam groups");
  return { groups, warnings };
}

export const rpsc: Connector = async ({ source, fetchText, now }) => {
  const fetched = await fetchText(RPSC_INDEX, { accept: "text/html" });
  const today = civilDateIn("Asia/Kolkata", now);
  const notices = parseRpscNotices(fetched.text, today);
  const { groups, warnings } = groupRpscCycles(notices, today);
  if (!groups.length) throw new Error("No recent RPSC cycles resolved; preserve previous records for review");
  const cycles = groups.map(({ original, notices }) => {
    const withdrawn = notices.some((notice) => notice.withdrawn);
    const documents: SourceEvidence[] = notices.map((notice) => ({
      id: `${source.id}:document:${shortHash(notice.url, 16)}`, title: notice.description,
      authority: source.authority, language: "Not verified", format: "PDF", url: notice.url,
      fetchStatus: "linked", lastSuccessfulFetchAt: null, lastValidatedAt: null, verificationStatus: "pending-review",
    }));
    return makeCycle({
      id: `rpsc-${original.number.replaceAll("/", "-")}`, sourceId: source.id,
      title: original.exam, cycleLabel: original.number, authority: source.authority,
      pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-RJ"],
      scopeLabel: "Rajasthan recruitment; applicant domicile must be checked separately",
      status: withdrawn ? "cancelled" : "uncertain",
      statusNote: withdrawn ? "Official archive explicitly labels this advertisement withdrawn. Check the withdrawal notice; founder review pending." : "Advertisement and corrections identified. Application window and current status require PDF review.",
      outcome: `Recruitment for ${original.exam}`,
      applicationWindow: { opensOn: null, closesOn: null, officialTimeZone: "Asia/Kolkata", cutoffLocalTime: null, precision: "unknown", note: `Advertisement released ${original.releasedOn}. Release dates are not application dates.` },
      citizenshipRule: "International applicant eligibility has not been verified from this advertisement and applicable rules.",
      residenceRule: "Residence and domicile conditions have not been extracted from the notice.",
      sources: [{ ...evidenceSource(source, fetched.evidence, "Official advertisement and corrigendum index", "HTML", "English"), lastValidatedAt: null }, ...documents],
      applicationUrl: null,
    });
  });
  return { cycles, evidence: [fetched.evidence], warnings: [...warnings, "Draft archive connector: only cycles with notices released within 180 days. PDFs are linked but not fetched or verified. Unknown application windows are never marked open."] };
};
