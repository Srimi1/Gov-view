/** New York's public vacancy board. Draft-only until connector acceptance. */
import { isIsoDate } from "../lib/time.ts";
import type { LanguageRequirement } from "../lib/eligibility/types.ts";
import type { Connector } from "./types.ts";
import { decodeEntities, evidenceSource, makeCycle, stripTags } from "./util.ts";

export const NY_INDEX = "https://statejobs.ny.gov/public/vacancyTable.cfm";
const normalized = (text: string) => text.replace(/\s+/g, " ").trim();

/** This current vacancy feed uses US dates, with two-digit years in 2000–2099. */
export function nyDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{2}|20\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, month, day, year] = match;
  const iso = `${year.length === 2 ? `20${year}` : year}-${month}-${day}`;
  return isIsoDate(iso) ? iso : null;
}

export interface NyVacancy {
  id: string; title: string; agency: string; postedOn: string; closesOn: string | null; url: string;
}

export function parseNyIndex(html: string): NyVacancy[] {
  const table = /<table\b[^>]*id="vacancyTable"[^>]*>([\s\S]*?)<\/table>/i.exec(html)?.[1];
  if (!table || !/Deadline/.test(table) || !/Agency/.test(table)) throw new Error("StateJobsNY vacancy table changed");
  const entries = new Map<string, NyVacancy>();
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
    if (!cells.length) continue;
    if (cells.length !== 7) throw new Error("StateJobsNY column count changed");
    const [id, title, , posted, deadline, agency] = cells.map((cell) => normalized(stripTags(cell)));
    const href = /\bhref="([^"]+)"/i.exec(cells[1])?.[1];
    if (!href) throw new Error("StateJobsNY vacancy link missing");
    const url = new URL(decodeEntities(href), NY_INDEX);
    if (url.origin !== "https://statejobs.ny.gov" || url.username || url.password || url.pathname !== "/public/vacancyDetailsView.cfm" || url.searchParams.get("id") !== id || !/^\d+$/.test(id)) throw new Error("StateJobsNY vacancy identity or official link changed");
    const postedOn = nyDate(posted);
    const closesOn = nyDate(deadline);
    if (!postedOn || (!closesOn && !/^(?:until filled|continuous|ongoing)$/i.test(deadline)) || (closesOn && closesOn < postedOn) || !title || !agency) throw new Error(`StateJobsNY ${id}: identity or dates need review`);
    const entry = { id, title, agency, postedOn, closesOn, url: `${url.origin}${url.pathname}?id=${id}` };
    const old = entries.get(id);
    if (old && JSON.stringify(old) !== JSON.stringify(entry)) throw new Error(`Conflicting StateJobsNY rows: ${id}`);
    entries.set(id, entry);
  }
  if (!entries.size) throw new Error("No StateJobsNY vacancies parsed; preserve previous data");
  return [...entries.values()];
}

/** Similar postings can be reposts or location variants. Hold them for identity review. */
export function partitionNyVacancies(entries: NyVacancy[]) {
  const groups = new Map<string, NyVacancy[]>();
  for (const entry of entries) {
    const key = JSON.stringify([entry.title.toLowerCase(), entry.agency.toLowerCase(), entry.postedOn, entry.closesOn]);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return {
    candidates: [...groups.values()].filter((group) => group.length === 1).flat(),
    held: [...groups.values()].filter((group) => group.length > 1),
  };
}

export function parseNyDetail(html: string, entry: NyVacancy): Record<string, string> {
  const fields: Record<string, string> = Object.create(null);
  const wanted = new Set(["Vacancy ID", "Date Posted", "Applications Due", "Title", "Agency", "Minimum Qualifications", "Occupational Category", "Employment Type", "Appointment Type", "Salary Range"]);
  for (const row of html.matchAll(/<p\b[^>]*class="row"[^>]*>([\s\S]*?)<\/p>/gi)) {
    const match = /<span\b[^>]*class="leftCol"[^>]*>([\s\S]*?)<\/span>\s*<span\b[^>]*class="rightCol"[^>]*>([\s\S]*)<\/span>/i.exec(row[1]);
    if (!match) continue;
    const label = normalized(stripTags(match[1]));
    if (!wanted.has(label)) continue;
    const value = stripTags(match[2]);
    if (fields[label] !== undefined && fields[label] !== value) throw new Error(`StateJobsNY ${entry.id}: conflicting detail field ${label}`);
    fields[label] = value;
  }
  if (fields["Vacancy ID"] !== entry.id || normalized(fields.Title ?? "") !== entry.title || normalized(fields.Agency ?? "") !== entry.agency || nyDate(fields["Date Posted"] ?? "") !== entry.postedOn || !fields["Applications Due"] || nyDate(fields["Applications Due"]) !== entry.closesOn || !fields["Minimum Qualifications"]) throw new Error(`StateJobsNY ${entry.id}: index/detail identity, dates or qualifications mismatch`);
  if (!entry.closesOn && !/^(?:until filled|continuous|ongoing)$/i.test(fields["Applications Due"])) throw new Error(`StateJobsNY ${entry.id}: unknown detail deadline format`);
  return fields;
}

/** Exact, conditional clause for this job title; no language inferred from title alone. */
export function nyLanguageRules(entry: NyVacancy, qualifications: string): LanguageRequirement[] {
  if (entry.title !== "Offender Rehabilitation Coordinator (Spanish Language)") return [];
  const clause = "If you pass the examination for Offender Rehabilitation Coordinator (Spanish Language), you will be required to demonstrate your Spanish language proficiency at a level that will ensure your ability to perform properly the duties of the position. Only enough candidates to fill current vacancies will be called to the proficiency test.";
  if (!normalized(qualifications).includes(clause)) return [];
  return [{ language: "es", stage: "selection", requirement: "For the examination route, demonstrate Spanish proficiency sufficient for the duties when called for the proficiency test. The notice also describes a NY HELPS route without an examination; the applicable route requires review. No CEFR level is specified.", evidence: clause, sourceUrl: entry.url }];
}

export const nyStateJobs: Connector = async ({ source, fetchText, log }) => {
  const index = await fetchText(NY_INDEX, { accept: "text/html" });
  const entries = parseNyIndex(index.text);
  const { candidates, held } = partitionNyVacancies(entries);
  const cap = source.maxRecords ?? 30;
  if (!Number.isInteger(cap) || cap < 1 || cap > 100) throw new Error("StateJobsNY draft detail cap must be 1–100");
  const chosen = candidates.sort((a, b) => Number(/language|bilingual/i.test(b.title)) - Number(/language|bilingual/i.test(a.title)) || b.postedOn.localeCompare(a.postedOn) || Number(b.id) - Number(a.id)).slice(0, cap);
  const warnings = [
    "Draft sample only. Public vacancies do not establish foreign-citizen eligibility, visa sponsorship or residence requirements. First connector output requires founder review.",
    `${entries.length} vacancy IDs indexed, not a verified count of distinct application cycles. ${held.reduce((sum, group) => sum + group.length, 0)} IDs held for possible duplicate/repost identity review; ${candidates.length - chosen.length} other IDs not fetched because of the ${cap}-detail cap. Language-labelled titles are sampled first, then recent postings.`,
    "Posted dates are not application opening dates. Deadline times and official timezone are unspecified in these fields; status stays uncertain. Work addresses are not selection venues.",
    ...held.map((group) => `Possible duplicate/repost IDs held: ${group.map((entry) => entry.id).join(", ")} — ${group[0].title}`),
  ];
  const evidence = [index.evidence];
  const cycles = [];
  for (const entry of chosen) {
    try {
      const detail = await fetchText(entry.url, { accept: "text/html" });
      evidence.push(detail.evidence);
      const fields = parseNyDetail(detail.text, entry);
      const languages = nyLanguageRules(entry, fields["Minimum Qualifications"]);
      cycles.push(makeCycle({
        id: `ny-statejobs-${entry.id}`, sourceId: source.id, title: entry.title, cycleLabel: `Vacancy ${entry.id}`,
        authority: entry.agency, pathway: "recruitment", jurisdictionCode: "US", jurisdictionName: "United States", subdivisionCodes: ["US-NY"],
        scopeLabel: "New York State recruitment; applicant residence requirements need separate verification",
        status: "uncertain", statusNote: "Official index and detail fields agree; deadline timezone, full eligibility and application-cycle identity await founder review.",
        outcome: [fields["Occupational Category"], fields["Employment Type"], fields["Appointment Type"]].filter(Boolean).join(" · ") || entry.title,
        applicationWindow: { opensOn: null, closesOn: entry.closesOn, cutoffLocalTime: null, officialTimeZone: null, precision: entry.closesOn ? "date" : "unknown", note: `Posted ${entry.postedOn}; this is not an evidenced opening date. Applications due: ${fields["Applications Due"]}. Official cutoff time and timezone need verification.` },
        qualifications: fields["Minimum Qualifications"], salary: fields["Salary Range"] || undefined,
        citizenshipRule: "International-applicant eligibility and visa sponsorship have not been verified. A public vacancy listing is not proof that every nationality can apply.",
        residenceRule: "Residence conditions need verification from the specific post and applicable service rules.",
        rules: languages.length ? { asOn: null, complete: false, languages } : null,
        sources: [index, detail].map((document) => ({ ...evidenceSource(source, document.evidence, document === index ? "Public vacancy index" : `Vacancy ${entry.id}: ${entry.title}`, "HTML", "English"), lastValidatedAt: null })),
        applicationUrl: entry.url,
      }));
    } catch (error) {
      warnings.push(`Vacancy ${entry.id} withheld: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  log(`${cycles.length}/${chosen.length} sampled details parsed; ${entries.length} indexed vacancy IDs`);
  if (!cycles.length) throw new Error("No StateJobsNY details validated; preserve previous draft and published data");
  return { cycles, evidence, warnings, totalAvailable: entries.length };
};
