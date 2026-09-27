/**
 * USAJOBS (U.S. Office of Personnel Management) — official Search API.
 * Free, but needs an API key: request one at https://developer.usajobs.gov/apirequest/
 * and set USAJOBS_API_KEY and USAJOBS_EMAIL in the collector environment.
 * API coordinates describe duty locations, not exam venues.
 */
import type { EligibilityRules } from "../lib/eligibility/types.ts";
import type { OpportunityCycle } from "../lib/opportunities.ts";
import type { Connector, Evidence, SourceConfig } from "./types.ts";
import { MissingSecretError } from "./types.ts";
import { evidenceSource, itemHash, localDatePart, makeCycle } from "./util.ts";

const SEARCH = "https://data.usajobs.gov/api/search";

export interface UsaJob {
  PositionID: string;
  PositionTitle: string;
  PositionURI: string;
  ApplyURI?: string[];
  OrganizationName?: string;
  DepartmentName?: string;
  QualificationSummary?: string;
  PositionStartDate?: string;
  PublicationStartDate?: string;
  ApplicationCloseDate?: string;
  /** Duty locations, not examination or selection venues. */
  PositionLocation?: { LocationName?: string; CityName?: string; CountrySubDivisionCode?: string; Latitude?: number; Longitude?: number }[];
  PositionRemuneration?: { MinimumRange?: string; MaximumRange?: string; RateIntervalCode?: string }[];
  PositionSchedule?: { Name?: string }[];
  PositionOfferingType?: { Name?: string; Code?: string }[];
  UserArea?: { Details?: { WhoMayApply?: { Name?: string }; JobSummary?: string; LowGrade?: string; HighGrade?: string; TeleworkEligible?: boolean } };
}

const money = (value?: string) => (value ? `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "");

export function toCycle(job: UsaJob, source: SourceConfig, evidence: Evidence): OpportunityCycle {
  const who = job.UserArea?.Details?.WhoMayApply?.Name ?? "";
  const dutyLocations = [...new Set((job.PositionLocation ?? []).map((location) => location.LocationName?.trim()).filter((value): value is string => Boolean(value)))];
  const dutyLabel = dutyLocations.length ? `${dutyLocations.slice(0, 3).join("; ")}${dutyLocations.length > 3 ? `; and ${dutyLocations.length - 3} more` : ""}` : "not given in API summary";
  const offering = job.PositionOfferingType ?? [];
  const appointmentType = offering.length === 1 && offering[0].Code === "15317" && offering[0].Name === "Permanent" ? "permanent" as const : undefined;
  const pay = job.PositionRemuneration?.[0];
  const rules: EligibilityRules = {
    asOn: null,
    // Hiring-path labels alone do not establish citizenship or work authorization.
    manualChecks: [{ stage: "apply", text: `Verify the full announcement's citizenship, work authorization, residence and hiring-path requirements. API hiring-path label: ${who || "not supplied"}.` }],
  };
  return makeCycle({
    id: `usajobs-${job.PositionID.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`,
    title: job.PositionTitle,
    cycleLabel: job.PositionID,
    programme: job.DepartmentName ?? "Federal government",
    authority: [job.OrganizationName, job.DepartmentName].filter(Boolean).join(", "),
    pathway: "recruitment",
    ...(appointmentType ? { appointmentType } : {}),
    status: "open",
    statusNote: job.UserArea?.Details?.JobSummary?.slice(0, 280) ?? "",
    jurisdictionCode: "US",
    jurisdictionName: "United States",
    scopeLabel: `Federal recruitment. Published duty locations: ${dutyLabel}. Duty location does not identify an exam or selection venue.`,
    outcome: `${job.PositionSchedule?.[0]?.Name ?? "Federal position"}${job.UserArea?.Details?.LowGrade ? ` · grade ${job.UserArea.Details.LowGrade}${job.UserArea.Details.HighGrade && job.UserArea.Details.HighGrade !== job.UserArea.Details.LowGrade ? `–${job.UserArea.Details.HighGrade}` : ""}` : ""}${offering.length ? ` · work type: ${offering.map((item) => item.Name ?? "unspecified").join(", ")}` : ""}`,
    salary: pay ? `${money(pay.MinimumRange)}–${money(pay.MaximumRange)} ${pay.RateIntervalCode === "PA" ? "a year" : pay.RateIntervalCode === "PH" ? "an hour" : ""}`.trim() : undefined,
    applicationWindow: {
      opensOn: localDatePart(job.PositionStartDate),
      closesOn: localDatePart(job.ApplicationCloseDate),
      // USAJOBS Help Center says announcements expire at 11:59 pm Eastern Time.
      officialTimeZone: "America/New_York",
      cutoffLocalTime: "23:59",
      cutoffInclusive: true,
      precision: "minute",
      note: "USAJOBS Help Center says listings expire at 11:59 p.m. Eastern on the published close date; agencies may close, remove or cancel earlier. Confirm the full announcement before relying on its deadline.",
    },
    qualifications: job.QualificationSummary?.slice(0, 600) ?? "See the announcement.",
    citizenshipRule: `API hiring-path label: ${who || "not supplied"}. This summary does not verify citizenship or work authorization; check the full announcement. Open-to-public does not itself mean open to foreign citizens.`,
    residenceRule: "Residence conditions are not verified from the Search API summary. Published duty location is not a residence rule; check the full announcement.",
    languageNote: "No job-specific language level has been verified from this Search API summary; check the full announcement and required-document instructions.",
    selectionStages: ["Selection stages not verified from Search API summary; read the full announcement for assessments, interviews and appointment checks."],
    fee: "Application fee not verified from Search API summary; check full announcement.",
    rules,
    venues: [{ kind: "unknown", name: "Examination or selection venue not verified from Search API summary" }],
    sources: [{ ...evidenceSource(source, evidence, "USAJOBS announcement", "JSON", "English", job.PositionURI), itemSha256: itemHash(job) }],
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
  let totalAvailable: number | undefined;
  let continuation: string | undefined;
  do {
    // Keep each announcement's hiring-path label; it does not settle foreign eligibility.
    const response = await fetchText(`${SEARCH}?ResultsPerPage=500&Page=${page}&SortField=OpenDate&SortDirection=Desc`, {
      accept: "application/json",
      headers: { Host: "data.usajobs.gov", "User-Agent": email, "Authorization-Key": key },
    });
    evidence.push({ ...response.evidence });
    const body = JSON.parse(response.text) as { SearchResult?: { SearchResultItems?: { MatchedObjectDescriptor: UsaJob }[]; SearchResultCountAll?: string | number; UserArea?: { NumberOfPages?: string | number; SearchResultCountAll?: string | number } } };
    const search = body.SearchResult;
    if (!search || !Array.isArray(search.SearchResultItems)) throw new Error("USAJOBS search response missing items");
    const reportedTotal = Number(search.SearchResultCountAll ?? search.UserArea?.SearchResultCountAll);
    if (Number.isFinite(reportedTotal) && reportedTotal >= 0) totalAvailable = reportedTotal;
    const reportedPages = Number(search.UserArea?.NumberOfPages);
    pages = Number.isInteger(reportedPages) && reportedPages > 0 ? reportedPages : totalAvailable !== undefined ? Math.max(1, Math.ceil(totalAvailable / 500)) : 1;
    for (const [index, item] of search.SearchResultItems.entries()) {
      if (source.maxRecords && cycles.length >= source.maxRecords) { continuation = `${SEARCH}?ResultsPerPage=500&Page=${page}&offset=${index}`; break; }
      cycles.push(toCycle(item.MatchedObjectDescriptor, source, response.evidence));
    }
    if (!continuation && source.maxRecords && cycles.length >= source.maxRecords && page < pages) continuation = `${SEARCH}?ResultsPerPage=500&Page=${page + 1}`;
    page += 1;
  } while (!continuation && page <= pages && page <= 40);
  if (!continuation && page <= pages) continuation = `${SEARCH}?ResultsPerPage=500&Page=${page}`;
  log(`${cycles.length} announcements`);
  const complete = !continuation && (totalAvailable === undefined || cycles.length >= totalAvailable);
  return { cycles, evidence, totalAvailable, complete, continuation, warnings: complete ? [] : [`Partial USAJOBS snapshot: ${cycles.length} of ${totalAvailable ?? "unknown"} available; old records must be retained.`] };
};
