/**
 * USAJOBS (U.S. Office of Personnel Management) — official Search API.
 * Free, but needs an API key: request one at https://developer.usajobs.gov/apirequest/
 * and set USAJOBS_API_KEY and USAJOBS_EMAIL as GitHub Actions secrets.
 * Locations come with coordinates from the API itself.
 */
import type { EligibilityRules } from "../lib/eligibility/types.ts";
import type { OpportunityCycle, Venue } from "../lib/opportunities.ts";
import type { Connector, Evidence, SourceConfig } from "./types.ts";
import { MissingSecretError } from "./types.ts";
import { evidenceSource, localDatePart, makeCycle, regionAt } from "./util.ts";

const SEARCH = "https://data.usajobs.gov/api/search";

export interface UsaJob {
  PositionID: string;
  PositionTitle: string;
  PositionURI: string;
  ApplyURI?: string[];
  OrganizationName?: string;
  DepartmentName?: string;
  QualificationSummary?: string;
  PublicationStartDate?: string;
  ApplicationCloseDate?: string;
  PositionLocation?: { LocationName?: string; CityName?: string; CountrySubDivisionCode?: string; Latitude?: number; Longitude?: number }[];
  PositionRemuneration?: { MinimumRange?: string; MaximumRange?: string; RateIntervalCode?: string }[];
  PositionSchedule?: { Name?: string }[];
  UserArea?: { Details?: { WhoMayApply?: { Name?: string }; JobSummary?: string; LowGrade?: string; HighGrade?: string; TeleworkEligible?: boolean } };
}

const money = (value?: string) => (value ? `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "");

export function toCycle(job: UsaJob, source: SourceConfig, evidence: Evidence): OpportunityCycle {
  const who = job.UserArea?.Details?.WhoMayApply?.Name ?? "";
  const publicOpen = /u\.?s\.? citizens|public/i.test(who);
  const venues: Venue[] = (job.PositionLocation ?? []).map((location) => {
    const lat = Number(location.Latitude);
    const lon = Number(location.Longitude);
    if (/anywhere|remote|telework/i.test(location.LocationName ?? "")) return { kind: "online", name: location.LocationName ?? "Remote" };
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return { kind: "unknown", name: location.LocationName ?? "Location not given" };
    return { kind: "published", name: location.LocationName ?? "", city: location.CityName ?? location.LocationName ?? "", latitude: lat, longitude: lon, precision: "city", subdivision: regionAt("US", lat, lon) ?? undefined };
  });
  const pay = job.PositionRemuneration?.[0];
  const rules: EligibilityRules = {
    asOn: null,
    ...(/citizens/i.test(who) ? { nationality: { allowed: ["US"], evidence: `Who may apply: ${who}` } } : {}),
    manualChecks: publicOpen ? [] : [{ stage: "apply", text: `Open only to: ${who || "specific groups — see the announcement"}.` }],
  };
  return makeCycle({
    id: `usajobs-${job.PositionID.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`,
    title: job.PositionTitle,
    cycleLabel: job.PositionID,
    programme: job.DepartmentName ?? "Federal government",
    authority: [job.OrganizationName, job.DepartmentName].filter(Boolean).join(", "),
    pathway: "recruitment",
    status: "open",
    statusNote: job.UserArea?.Details?.JobSummary?.slice(0, 280) ?? "",
    jurisdictionCode: "US",
    jurisdictionName: "United States",
    subdivisionCodes: [...new Set(venues.flatMap((venue) => (venue.kind === "published" && venue.subdivision ? [venue.subdivision] : [])))],
    scopeLabel: "Federal government",
    outcome: `${job.PositionSchedule?.[0]?.Name ?? "Federal position"}${job.UserArea?.Details?.LowGrade ? ` · grade ${job.UserArea.Details.LowGrade}${job.UserArea.Details.HighGrade && job.UserArea.Details.HighGrade !== job.UserArea.Details.LowGrade ? `–${job.UserArea.Details.HighGrade}` : ""}` : ""}`,
    salary: pay ? `${money(pay.MinimumRange)}–${money(pay.MaximumRange)} ${pay.RateIntervalCode === "PA" ? "a year" : pay.RateIntervalCode === "PH" ? "an hour" : ""}`.trim() : undefined,
    applicationWindow: {
      opensOn: localDatePart(job.PublicationStartDate),
      closesOn: localDatePart(job.ApplicationCloseDate),
      // USAJOBS announcements close at 11:59 pm Eastern Time.
      officialTimeZone: "America/New_York",
      cutoffLocalTime: "23:59",
      precision: "minute",
    },
    qualifications: job.QualificationSummary?.slice(0, 600) ?? "See the announcement.",
    citizenshipRule: who || "See the announcement.",
    residenceRule: "No residence requirement stated.",
    selectionStages: ["Online application and assessment questionnaire", "Referral to hiring manager", "Interview", "Background check"],
    fee: "Free to apply.",
    rules,
    venues: venues.length ? venues : [{ kind: "unknown", name: "Location not given" }],
    sources: [evidenceSource(source, evidence, "USAJOBS announcement", "JSON", "English", job.PositionURI)],
    applicationUrl: job.ApplyURI?.[0] ?? job.PositionURI,
  });
}

export const usajobs: Connector = async ({ source, fetchText, env, log }) => {
  const key = env.USAJOBS_API_KEY;
  const email = env.USAJOBS_EMAIL;
  if (!key || !email) throw new MissingSecretError(["USAJOBS_API_KEY", "USAJOBS_EMAIL"].filter((name) => !env[name]));
  const cycles: OpportunityCycle[] = [];
  const evidence: Evidence[] = [];
  let page = 1;
  let pages = 1;
  do {
    // Hiring paths "public" = open to all U.S. citizens; the connector keeps every announcement and labels who may apply.
    const response = await fetchText(`${SEARCH}?ResultsPerPage=500&Page=${page}&SortField=OpenDate&SortDirection=Desc`, {
      accept: "application/json",
      headers: { Host: "data.usajobs.gov", "User-Agent": email, "Authorization-Key": key },
    });
    evidence.push({ ...response.evidence });
    const body = JSON.parse(response.text) as { SearchResult: { SearchResultItems: { MatchedObjectDescriptor: UsaJob }[]; UserArea?: { NumberOfPages?: string } } };
    for (const item of body.SearchResult.SearchResultItems) cycles.push(toCycle(item.MatchedObjectDescriptor, source, response.evidence));
    pages = Math.min(Number(body.SearchResult.UserArea?.NumberOfPages ?? 1), 40);
    page += 1;
  } while (page <= pages && (!source.maxRecords || cycles.length < source.maxRecords));
  log(`${cycles.length} announcements`);
  return { cycles: source.maxRecords ? cycles.slice(0, source.maxRecords) : cycles, evidence, warnings: [] };
};
