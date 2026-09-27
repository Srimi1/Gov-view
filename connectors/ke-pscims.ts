/** Kenya PSCIMS active adverts. Drafts only; index and each detail must agree. */
import { civilDateIn } from "../lib/time.ts";
import type { OpportunityCycle } from "../lib/opportunities.ts";
import type { Connector, Evidence, SourceConfig } from "./types.ts";
import { dayFirstDate, decodeEntities, evidenceSource, makeCycle, stripTags } from "./util.ts";

const INDEX_URL = "https://pscims.publicservice.go.ke/jobs/ActiveJobsAdverts.aspx";

interface Advert {
  number: string; title: string; scale: string; department: string; vacancies: number;
  experienceYears: number; servingOnly: boolean; advertisedOn: string; closesOn: string;
}

const normalized = (value: string) => value.replace(/\s+/g, " ").trim();

export function parsePscIndex(html: string): Advert[] {
  const table = /<table\b[^>]*\bid="DataGrid2"[^>]*>([\s\S]*?)<\/table>/i.exec(html)?.[1];
  if (!table || !/ACTIVE ADVERTS/i.test(html)) throw new Error("PSCIMS active advert table missing; review required");
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].slice(1);
  if (/<td\b[^>]*\bcolspan=/i.test(rows.at(-1)?.[1] ?? "")) rows.pop(); // ASP.NET pager footer
  if (!rows.length) throw new Error("PSCIMS active advert table empty; review required");
  const adverts = rows.map((row) => {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => normalized(stripTags(cell[1])));
    if (cells.length !== 11 || !/Advert Details/.test(cells[10])) throw new Error("PSCIMS advert row changed; review required");
    const [, number, title, scale, department, vacancyText, yearsText, category, postedText, closeText] = cells;
    const advertisedOn = dayFirstDate(postedText);
    const closesOn = dayFirstDate(closeText);
    if (!/^[A-Z]?\d+\/20\d{2}$/.test(number) || !title || !department || !/^CSG \d+$/i.test(scale) ||
      !/^\d+$/.test(vacancyText) || Number(vacancyText) < 1 || !/^\d+$/.test(yearsText) ||
      !["Open", "For Serving Officers Only"].includes(category) || !advertisedOn || !closesOn || advertisedOn > closesOn) {
      throw new Error(`PSCIMS advert ${number || "unknown"} has changed or invalid fields; review required`);
    }
    return { number, title, scale, department, vacancies: Number(vacancyText), experienceYears: Number(yearsText),
      servingOnly: category === "For Serving Officers Only", advertisedOn, closesOn };
  });
  if (new Set(adverts.map((advert) => advert.number)).size !== adverts.length) throw new Error("PSCIMS duplicate advert numbers; review required");
  return adverts;
}

export function pscDetailUrl(number: string): string {
  const url = new URL("https://pscims.publicservice.go.ke/jobs/AdvertDetailsExt.aspx");
  url.searchParams.set("kpage", "ActiveAdverts.aspx");
  url.searchParams.set("kpx", number);
  return url.href;
}

function input(html: string, id: string): string {
  const tag = [...html.matchAll(/<input\b[^>]*>/gi)].find((match) => new RegExp(`\\bid="${id}"`, "i").test(match[0]))?.[0];
  const value = tag && /\bvalue="([^"]*)"/i.exec(tag)?.[1];
  if (value === undefined) throw new Error(`PSCIMS detail field ${id} missing; review required`);
  return normalized(decodeEntities(value));
}

function selectedServing(html: string): boolean {
  const radio = [...html.matchAll(/<input\b[^>]*>/gi)]
    .find((match) => /\bname="optforservingofficers"/i.test(match[0]) && /\bchecked="checked"/i.test(match[0]))?.[0];
  if (!radio) throw new Error("PSCIMS serving-officer selection missing; review required");
  if (/\bvalue="Y"/i.test(radio)) return true;
  if (/\bvalue="N"/i.test(radio)) return false;
  throw new Error("PSCIMS serving-officer value changed; review required");
}

export function parsePscDetail(html: string, advert: Advert): { requirements: string; terms: string } {
  const checks: [string, string][] = [
    ["lbladvert", advert.number], ["lblvote", advert.department], ["txtareaofspeciality", advert.title],
    ["txtjobscale", advert.scale], ["txtnumberofinterns", String(advert.vacancies)],
    ["txtnoofyears", String(advert.experienceYears)],
  ];
  for (const [id, expected] of checks) {
    if (input(html, id).toLowerCase() !== normalized(expected).toLowerCase()) {
      throw new Error(`PSCIMS ${advert.number} detail ${id} conflicts with active index; review required`);
    }
  }
  if (selectedServing(html) !== advert.servingOnly) throw new Error(`PSCIMS ${advert.number} serving-officer category conflicts; review required`);
  const rawRequirements = /<textarea\b[^>]*\bid="txtrequirements"[^>]*>([\s\S]*?)<\/textarea>/i.exec(html)?.[1];
  if (!rawRequirements) throw new Error(`PSCIMS ${advert.number} requirements missing; review required`);
  return { requirements: normalized(stripTags(rawRequirements)), terms: input(html, "txtTOS") };
}

function proposal(advert: Advert, detail: { requirements: string; terms: string }, source: SourceConfig,
  indexEvidence: Evidence, detailEvidence: Evidence, now: Date): OpportunityCycle {
  const today = civilDateIn("Africa/Nairobi", now);
  const status = today < advert.advertisedOn || today === advert.closesOn ? "uncertain" as const
    : today > advert.closesOn ? "closed" as const : "open" as const;
  const category = advert.servingOnly ? "For Serving Officers Only" : "Open";
  return makeCycle({
    id: `ke-pscims-${advert.number.toLowerCase().replace("/", "-")}`, sourceId: source.id,
    title: `${advert.title} — ${advert.department}`, programme: "Kenya PSCIMS recruitment",
    cycleLabel: `Advert ${advert.number} · ${advert.scale} · ${category}`,
    authority: source.authority, pathway: "recruitment", jurisdictionCode: "KE", jurisdictionName: "Kenya",
    scopeLabel: `Kenya national public-service advert. ${category} is portal applicant category, not nationality or work-location evidence.`,
    outcome: `${advert.vacancies} advertised ${advert.vacancies === 1 ? "vacancy" : "vacancies"}. Portal terms of service: ${detail.terms}; appointment type requires confirmation.`,
    status,
    statusNote: `PSCIMS active index lists closing date ${advert.closesOn}. No cutoff clock or official timezone printed. Index/detail checked; founder review pending.`,
    applicationWindow: { opensOn: null, closesOn: advert.closesOn, cutoffLocalTime: null, officialTimeZone: null,
      precision: "date", note: `Index advert date ${advert.advertisedOn} is not proven application opening. Cutoff clock and official timezone are not printed.` },
    qualifications: `Official detail's requirements for appointment: ${detail.requirements} Advert index lists ${advert.experienceYears} years of experience. Founder must confirm which conditions govern application, selection and appointment.`,
    citizenshipRule: `No nationality permission established by checked PSCIMS index/detail. Portal label “${category}” does not establish permission for foreign citizens.`,
    residenceRule: "No applicant residence, immigration or right-to-work condition established by checked index/detail; verify with PSC and applicable service rules.",
    languageNote: "No standardized language proficiency level extracted from checked index/detail. Review role-specific requirements and governing service rules before a language verdict.",
    selectionStages: ["Apply through official PSCIMS portal", "Commission screening and selection steps require notice-level verification", "Appointment subject to governing public-service rules"],
    fee: "Application fee not established by checked index/detail.",
    rules: { complete: false, asOn: null, manualChecks: [
      { stage: "apply", text: `${advert.servingOnly ? "Advert limits applications to serving officers. " : "Portal marks advert Open to external applicants. "}Confirm whether international applicants may apply, plus role-specific qualifications and service status.` },
      { stage: "selection", text: "Confirm selection stages, language expectations, qualification recognition and exam or interview access with PSC." },
      { stage: "outcome", text: "Confirm foreign-citizen appointment permission, right to work, service status and final requirements for this public-service post." },
    ] },
    venues: [{ kind: "unknown", name: "Selection venue not published in checked index/detail" }],
    sources: [
      evidenceSource(source, indexEvidence, "PSCIMS active advert register", "HTML", "English"),
      evidenceSource(source, detailEvidence, `PSCIMS advert ${advert.number} — ${advert.title}`, "HTML", "English"),
    ],
    applicationMethod: "online", applicationUrl: pscDetailUrl(advert.number),
  });
}

export const kePscims: Connector = async ({ source, fetchText, now }) => {
  const index = await fetchText(INDEX_URL, { accept: "text/html" });
  if (index.evidence.url !== INDEX_URL) throw new Error("PSCIMS active index redirected; review required");
  const adverts = parsePscIndex(index.text);
  const cap = Math.max(1, source.maxRecords ?? adverts.length);
  const cycles: OpportunityCycle[] = [];
  const evidence = [index.evidence];
  for (const advert of adverts.slice(0, cap)) {
    const url = pscDetailUrl(advert.number);
    const page = await fetchText(url, { accept: "text/html" });
    if (page.evidence.url !== url) throw new Error(`PSCIMS ${advert.number} detail redirected; review required`);
    const detail = parsePscDetail(page.text, advert);
    evidence.push(page.evidence);
    cycles.push(proposal(advert, detail, source, index.evidence, page.evidence, now));
  }
  return { cycles, evidence, totalAvailable: adverts.length, complete: adverts.length <= cap,
    ...(adverts.length > cap ? { continuation: `PSCIMS active index: ${adverts.length - cap} uncollected rows after ${cycles.at(-1)?.cycleLabel}` } : {}),
    warnings: [
      `PSCIMS index contained ${adverts.length} active adverts; ${cycles.length} index/detail pairs checked.`,
      "Open is a portal applicant category, not a foreign-citizen permission; serving-officer-only status is separate from nationality.",
      "Requirements are labelled for appointment. Recruitment rules, amendments, fees, language levels, work sites and official cutoff time/zone need founder review.",
      "Active index alone cannot establish cancellations or comprehensive Kenya public recruitment coverage.",
    ] };
};
